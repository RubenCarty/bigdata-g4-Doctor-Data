package payments

import "context"

// CheckoutSession es el resultado de iniciar un cobro con la pasarela. RedirectURL se usa
// para un flujo de redirección a página hospedada (StubGateway); FormToken + PublicKey son
// del flujo real de Izipay (Embedded/Krypton, confirmado contra sus ejemplos oficiales) — el
// frontend arma el formulario embebido con esos dos valores, sin redirigir a ningún lado.
type CheckoutSession struct {
	RedirectURL string
	FormToken   string
	PublicKey   string
	GatewayRef  string
}

// WebhookEvent es la notificación de la pasarela ya normalizada. Status se normaliza a
// "paid" / "failed" / "cancelled" por cada implementación concreta. Token viene poblado solo
// cuando el pago registró una tarjeta reusable (ver ChargeRenewal) — vacío en un pago normal.
type WebhookEvent struct {
	GatewayRef string
	Status     string
	Token      string
	RawPayload []byte
}

// ChargeResult es el resultado de intentar cobrar una renovación con una tarjeta ya
// registrada (sin que el cliente vuelva a ingresarla).
type ChargeResult struct {
	Success     bool
	GatewayRef  string
	RawResponse []byte
}

// PaymentGateway abstrae la pasarela de pago para que el resto del sistema (checkout,
// webhook, renovaciones) no dependa de los detalles concretos de Izipay u otro proveedor.
type PaymentGateway interface {
	CreateCheckoutSession(ctx context.Context, orderRef string, amountCents int64, currency string, metadata map[string]string) (*CheckoutSession, error)
	VerifyWebhookSignature(body []byte, headers map[string]string) (*WebhookEvent, error)
	// ChargeRenewal cobra una renovación automática usando un token de tarjeta ya
	// registrado (User.PaymentToken) — ver internal/renewal.
	ChargeRenewal(ctx context.Context, token string, amountCents int64, currency, orderRef string) (*ChargeResult, error)
}
