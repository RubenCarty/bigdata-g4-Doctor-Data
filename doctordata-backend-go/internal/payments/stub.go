package payments

import (
	"context"
	"encoding/json"
	"fmt"
)

// StubGateway simula una pasarela de pago sin hacer llamadas externas. Se usa en
// desarrollo local (PAYMENT_GATEWAY=stub, valor por defecto) para poder probar el flujo
// completo de compra sin credenciales reales de Izipay.
//
// CreateCheckoutSession devuelve una RedirectURL que apunta a la propia pantalla de pago
// simulado del frontend (/checkout/stub); esa pantalla llama de vuelta a
// POST /billing/webhook/stub-confirm para simular la confirmación de la pasarela.
type StubGateway struct {
	FrontendBaseURL string
}

func NewStubGateway(frontendBaseURL string) *StubGateway {
	return &StubGateway{FrontendBaseURL: frontendBaseURL}
}

func (g *StubGateway) CreateCheckoutSession(ctx context.Context, orderRef string, amountCents int64, currency string, metadata map[string]string) (*CheckoutSession, error) {
	return &CheckoutSession{
		RedirectURL: fmt.Sprintf("%s/checkout/stub?order_ref=%s&amount_cents=%d&currency=%s", g.FrontendBaseURL, orderRef, amountCents, currency),
		GatewayRef:  "stub_" + orderRef,
	}, nil
}

func (g *StubGateway) VerifyWebhookSignature(body []byte, headers map[string]string) (*WebhookEvent, error) {
	var payload struct {
		GatewayRef string `json:"gateway_ref"`
		Status     string `json:"status"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, err
	}
	// Token simulado — así el flujo completo de renovación automática (internal/renewal) se
	// puede probar de punta a punta en local/QA sin credenciales reales de Izipay.
	return &WebhookEvent{GatewayRef: payload.GatewayRef, Status: payload.Status, Token: "stub_token_" + payload.GatewayRef, RawPayload: body}, nil
}

// ChargeRenewal simula un cobro de renovación siempre exitoso — el stub nunca falla, para
// poder probar el resto del pipeline (creación de la fila renovada, boleta, correo) sin
// depender de que la pasarela real ya esté lista.
func (g *StubGateway) ChargeRenewal(ctx context.Context, token string, amountCents int64, currency, orderRef string) (*ChargeResult, error) {
	return &ChargeResult{Success: true, GatewayRef: "stub_renewal_" + orderRef}, nil
}
