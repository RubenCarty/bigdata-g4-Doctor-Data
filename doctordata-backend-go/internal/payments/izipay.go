package payments

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// IzipayGateway implementa el flujo Embedded/"Krypton" de Izipay — que en realidad corre
// sobre la plataforma Lyra/Micuentaweb (mismo motor que Systempay/PayZen en otros países).
// Confirmado contra ejemplos oficiales reales de izipay-pe (código leído directo del repo,
// no inferido de documentación de prosa):
//
//	https://github.com/izipay-pe/Server-FormToken-Javascript
//	https://github.com/izipay-pe/Embedded-PaymentForm-Nodejs
//	https://github.com/izipay-pe/obtener-credenciales-de-conexion
//
// El backend pide un formToken a la API REST (CreatePayment); el FRONTEND arma el formulario
// de pago embebido con ese token + la clave pública, usando kr-payment-form.min.js — nunca
// hay redirección a una página hospedada de Izipay (a diferencia del flujo "Redirect" viejo
// que tenía esta misma pasarela antes — vads_*/HTML auto-submit — que resultó ser el flujo
// equivocado para las credenciales que mandó el técnico). El resultado llega por dos caminos:
//  1. KR.onSubmit en el navegador (solo UX — confirma rápido, no es la fuente de verdad).
//  2. La notificación IPN aparte, servidor a servidor (la fuente de verdad real) — ver
//     VerifyWebhookSignature, conectada en POST /billing/webhook/izipay. Se configura A MANO
//     en el Back Office Vendedor, necesita un dominio público (no funciona en local).
const (
	izipayAPIBaseURL        = "https://api.micuentaweb.pe"
	izipayCreatePaymentPath = "/api-payment/V4/Charge/CreatePayment"
)

type IzipayGateway struct {
	db *gorm.DB

	ShopID    string
	Password  string // contraseña de la API REST (test o producción, según CtxMode) — Basic Auth y clave de verificación de la IPN
	PublicKey string // clave pública (test o producción) — va al frontend para armar el widget embebido
	HMACKey   string // clave HMAC-SHA-256 (test o producción) — verifica kr-hash en el retorno del navegador (no en la IPN)
	CtxMode   string // "TEST" o "PRODUCTION"

	FrontendBaseURL string
}

// NewIzipayGateway arma el gateway a partir de las credenciales de test/producción y el modo
// activo — así cambiar de test a producción es solo cambiar IZIPAY_CTX_MODE.
func NewIzipayGateway(db *gorm.DB, shopID, testPassword, prodPassword, testPublicKey, prodPublicKey, testHMACKey, prodHMACKey, ctxMode, frontendBaseURL string) *IzipayGateway {
	if ctxMode == "" {
		ctxMode = "TEST"
	}
	password, publicKey, hmacKey := testPassword, testPublicKey, testHMACKey
	if ctxMode == "PRODUCTION" {
		password, publicKey, hmacKey = prodPassword, prodPublicKey, prodHMACKey
	}
	return &IzipayGateway{
		db:              db,
		ShopID:          shopID,
		Password:        password,
		PublicKey:       publicKey,
		HMACKey:         hmacKey,
		CtxMode:         ctxMode,
		FrontendBaseURL: frontendBaseURL,
	}
}

// CreateCheckoutSession pide un formToken real a la API REST de Izipay (Basic Auth
// shopID:password) — nunca confía en un monto del cliente, usa el que ya calculó
// BillingHandler.CreateCheckout desde la base de datos. El shape exacto del request/response
// está confirmado contra Embedded-PaymentForm-Nodejs, pero no probado todavía contra el
// sandbox real (pendiente credenciales — ver plan de verificación); si la API rechaza el
// request, el body de error completo queda en el log del servidor para ajustar el payload.
func (g *IzipayGateway) CreateCheckoutSession(ctx context.Context, orderRef string, amountCents int64, currency string, metadata map[string]string) (*CheckoutSession, error) {
	var email string
	if userIDStr, ok := metadata["user_id"]; ok {
		var user models.User
		if err := g.db.Select("email").Where("id = ?", userIDStr).First(&user).Error; err == nil {
			email = user.Email
		}
	}

	reqBody, err := json.Marshal(map[string]interface{}{
		"amount":   amountCents,
		"currency": currency,
		"orderId":  orderRef,
		"customer": map[string]interface{}{
			"email": email,
		},
	})
	if err != nil {
		return nil, fmt.Errorf("izipay: error al armar el request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, izipayAPIBaseURL+izipayCreatePaymentPath, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("izipay: error al armar el request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Basic "+base64.StdEncoding.EncodeToString([]byte(g.ShopID+":"+g.Password)))

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("izipay: error al contactar la API: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("izipay: error al leer la respuesta: %w", err)
	}

	var parsed struct {
		Status string `json:"status"`
		Answer struct {
			FormToken string `json:"formToken"`
		} `json:"answer"`
	}
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("izipay: respuesta inválida de la API (%d): %s", resp.StatusCode, string(respBody))
	}
	if parsed.Status != "SUCCESS" {
		return nil, fmt.Errorf("izipay: CreatePayment devolvió status=%q: %s", parsed.Status, string(respBody))
	}

	return &CheckoutSession{
		FormToken:  parsed.Answer.FormToken,
		PublicKey:  g.PublicKey,
		GatewayRef: orderRef,
	}, nil
}

// VerifyWebhookSignature — usada por POST /billing/webhook/izipay (la IPN real). El body
// viene application/x-www-form-urlencoded con dos campos: kr-answer (un JSON como string) y
// kr-hash. Se verifica con HMAC-SHA256(kr-answer, Password) — la CONTRASEÑA de la API REST,
// no la clave HMAC-SHA-256 (esa es para el retorno del navegador vía KR.onSubmit, no para la
// IPN — confirmado contra el código de ejemplo oficial; Izipay permite elegir esto en la
// regla de notificación del Back Office, así que toca reconfirmar apenas llegue la primera
// IPN real de una compra de prueba).
func (g *IzipayGateway) VerifyWebhookSignature(body []byte, headers map[string]string) (*WebhookEvent, error) {
	values, err := url.ParseQuery(string(body))
	if err != nil {
		return nil, fmt.Errorf("izipay: no se pudo parsear el body de la IPN: %w", err)
	}
	krAnswer := values.Get("kr-answer")
	krHash := values.Get("kr-hash")
	if krAnswer == "" || krHash == "" {
		return nil, fmt.Errorf("izipay: la IPN no trae kr-answer/kr-hash")
	}

	mac := hmac.New(sha256.New, []byte(g.Password))
	mac.Write([]byte(krAnswer))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(expected), []byte(krHash)) {
		return nil, fmt.Errorf("izipay: firma inválida en la IPN")
	}

	var answer struct {
		OrderStatus  string `json:"orderStatus"`
		OrderDetails struct {
			OrderID string `json:"orderId"`
		} `json:"orderDetails"`
	}
	if err := json.Unmarshal([]byte(krAnswer), &answer); err != nil {
		return nil, fmt.Errorf("izipay: kr-answer inválido: %w", err)
	}

	status := "failed"
	if answer.OrderStatus == "PAID" {
		status = "paid"
	}

	return &WebhookEvent{
		GatewayRef: answer.OrderDetails.OrderID,
		Status:     status,
		RawPayload: body,
	}, nil
}

// ChargeRenewal — cobro recurrente (sin que el cliente vuelva a ingresar la tarjeta) usando
// un token ya registrado. Sigue sin implementar: lo que se confirmó contra los ejemplos
// oficiales de izipay-pe fue el flujo de UN pago (CreatePayment), no tokenización/cargos
// recurrentes — antes de implementar esto de verdad, confirmar con el técnico de Izipay:
//  1. ¿La afiliación soporta cargos recurrentes/token (MIT — "merchant initiated
//     transactions")? De ser así, ¿es el mismo endpoint CreatePayment con un parámetro
//     adicional (ej. formAction=REGISTER_PAY, patrón típico en la familia Lyra), o uno
//     distinto?
//  2. ¿Qué credencial autentica ese endpoint — la misma contraseña de la API REST de hoy, o
//     una separada para cargos recurrentes?
//  3. ¿Hay alguna restricción normativa peruana sobre cargos recurrentes sin confirmación del
//     titular en cada cobro que debamos respetar?
//
// Devuelve error a propósito en vez de simular éxito — un correo de "se cobró tu tarjeta" sin
// que el cobro haya ocurrido de verdad sería un problema serio de confianza con el cliente.
func (g *IzipayGateway) ChargeRenewal(ctx context.Context, token string, amountCents int64, currency, orderRef string) (*ChargeResult, error) {
	return nil, fmt.Errorf("izipay: cobro recurrente todavía no implementado — ver comentario de ChargeRenewal en internal/payments/izipay.go")
}
