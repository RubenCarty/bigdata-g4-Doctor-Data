package payments

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/url"
	"testing"
)

func signKrAnswer(krAnswer, password string) string {
	mac := hmac.New(sha256.New, []byte(password))
	mac.Write([]byte(krAnswer))
	return hex.EncodeToString(mac.Sum(nil))
}

// TestVerifyWebhookSignature_RoundTrip cubre el camino feliz de la IPN: kr-answer +
// kr-hash firmados con la contraseña de la API REST (no la clave HMAC-SHA-256, esa es para
// el retorno del navegador) deben verificar y mapear orderStatus=PAID a "paid".
func TestVerifyWebhookSignature_RoundTrip(t *testing.T) {
	g := &IzipayGateway{Password: "testpassword_abc123"}

	krAnswer := `{"orderStatus":"PAID","orderDetails":{"orderId":"abc-123"}}`
	hash := signKrAnswer(krAnswer, g.Password)

	form := url.Values{}
	form.Set("kr-answer", krAnswer)
	form.Set("kr-hash", hash)

	event, err := g.VerifyWebhookSignature([]byte(form.Encode()), nil)
	if err != nil {
		t.Fatalf("verification failed: %v", err)
	}
	if event.GatewayRef != "abc-123" {
		t.Fatalf("expected gateway ref abc-123, got %s", event.GatewayRef)
	}
	if event.Status != "paid" {
		t.Fatalf("expected status paid, got %s", event.Status)
	}
}

// TestVerifyWebhookSignature_TamperedHash cubre que un kr-hash que no corresponde al
// kr-answer (o a la contraseña activa) se rechaza, sin importar lo que diga orderStatus.
func TestVerifyWebhookSignature_TamperedHash(t *testing.T) {
	g := &IzipayGateway{Password: "testpassword_abc123"}

	krAnswer := `{"orderStatus":"PAID","orderDetails":{"orderId":"abc-123"}}`
	form := url.Values{}
	form.Set("kr-answer", krAnswer)
	form.Set("kr-hash", "garbage")

	if _, err := g.VerifyWebhookSignature([]byte(form.Encode()), nil); err == nil {
		t.Fatal("expected error for tampered hash, got nil")
	}
}

// TestVerifyWebhookSignature_UnpaidMapsToFailed cubre que cualquier orderStatus distinto de
// PAID (con firma válida) mapea a "failed", no a "paid".
func TestVerifyWebhookSignature_UnpaidMapsToFailed(t *testing.T) {
	g := &IzipayGateway{Password: "testpassword_abc123"}

	krAnswer := `{"orderStatus":"UNPAID","orderDetails":{"orderId":"abc-123"}}`
	hash := signKrAnswer(krAnswer, g.Password)

	form := url.Values{}
	form.Set("kr-answer", krAnswer)
	form.Set("kr-hash", hash)

	event, err := g.VerifyWebhookSignature([]byte(form.Encode()), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if event.Status != "failed" {
		t.Fatalf("expected failed, got %s", event.Status)
	}
}
