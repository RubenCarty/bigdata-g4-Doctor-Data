package payments

import (
	"os"

	"gorm.io/gorm"
)

// NewGatewayFromEnv selecciona la implementación de PaymentGateway según la variable de
// entorno PAYMENT_GATEWAY (stub|izipay). Por defecto usa el stub, para que el entorno local
// funcione sin credenciales reales. db solo lo usa IzipayGateway (necesita el email del
// comprador para CreatePayment) — StubGateway no lo necesita.
func NewGatewayFromEnv(db *gorm.DB) PaymentGateway {
	frontendBaseURL := os.Getenv("FRONTEND_BASE_URL")
	if frontendBaseURL == "" {
		frontendBaseURL = "http://localhost:3000"
	}

	switch os.Getenv("PAYMENT_GATEWAY") {
	case "izipay":
		return NewIzipayGateway(
			db,
			os.Getenv("IZIPAY_SHOP_ID"),
			os.Getenv("IZIPAY_TEST_PASSWORD"),
			os.Getenv("IZIPAY_PRODUCTION_PASSWORD"),
			os.Getenv("IZIPAY_TEST_PUBLIC_KEY"),
			os.Getenv("IZIPAY_PRODUCTION_PUBLIC_KEY"),
			os.Getenv("IZIPAY_TEST_HMAC_KEY"),
			os.Getenv("IZIPAY_PRODUCTION_HMAC_KEY"),
			os.Getenv("IZIPAY_CTX_MODE"),
			frontendBaseURL,
		)
	default:
		return NewStubGateway(frontendBaseURL)
	}
}
