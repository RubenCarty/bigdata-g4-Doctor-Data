package handlers

import (
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
	"doctordata-backend-go/internal/payments"
)

// BillingWebhookHandler — recibe la confirmación de pago de la pasarela (sin JWT; se
// autentica verificando la firma del payload dentro del propio handler).
type BillingWebhookHandler struct {
	db      *gorm.DB
	gateway payments.PaymentGateway
}

func NewBillingWebhookHandler(db *gorm.DB, gateway payments.PaymentGateway) *BillingWebhookHandler {
	return &BillingWebhookHandler{db: db, gateway: gateway}
}

// POST /billing/webhook/izipay
func (h *BillingWebhookHandler) HandleIzipayWebhook(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	headers := map[string]string{}
	for k := range c.Request.Header {
		headers[k] = c.Request.Header.Get(k)
	}

	event, err := h.gateway.VerifyWebhookSignature(body, headers)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid signature"})
		return
	}

	// A partir de aquí siempre se responde 200 (práctica estándar de webhooks) para evitar
	// que la pasarela reintente indefinidamente por un bug interno posterior a la firma.
	applyPaymentEvent(h.db, event)
	c.JSON(http.StatusOK, gin.H{"received": true})
}

// POST /billing/webhook/stub-confirm — solo registrada cuando PAYMENT_GATEWAY != izipay.
func (h *BillingWebhookHandler) HandleStubConfirm(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid body"})
		return
	}

	event, err := h.gateway.VerifyWebhookSignature(body, nil)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid payload"})
		return
	}

	applyPaymentEvent(h.db, event)
	c.JSON(http.StatusOK, gin.H{"received": true})
}

// applyPaymentEvent actualiza todas las UserSubscription que comparten el GatewayRef del
// evento. Si el pago incluyó un código de descuento, recién aquí se incrementa
// DiscountCode.TimesRedeemed (no en el checkout — ver billing.go). Función de paquete (no
// método) porque BillingHandler.CreateCheckout también la usa directo, sin pasar por ningún
// webhook, cuando el carrito queda en S/ 0.00 tras un descuento 100% — Izipay rechaza cobros
// por ese monto, así que ese caso nunca llega a tocar la pasarela (ver comentario ahí).
func applyPaymentEvent(db *gorm.DB, event *payments.WebhookEvent) {
	if event == nil || event.GatewayRef == "" {
		return
	}

	var subs []models.UserSubscription
	if err := db.Preload("Plan").Where("payment_gateway_ref = ?", event.GatewayRef).Find(&subs).Error; err != nil {
		return
	}

	switch event.Status {
	case "paid":
		now := time.Now()
		if event.Token != "" && len(subs) > 0 {
			db.Model(&models.User{}).Where("id = ?", subs[0].UserID).
				Update("payment_token", crypto.EncryptedString(event.Token))
		}
		planCounts := map[string]int{}
		for _, sub := range subs {
			periodEnd := now.AddDate(0, 1, 0)
			if sub.Plan.BillingPeriod == models.BillingAnnual {
				periodEnd = now.AddDate(1, 0, 0)
			}
			db.Model(&models.UserSubscription{}).Where("id = ?", sub.ID).Updates(map[string]interface{}{
				"status":       models.SubscriptionActive,
				"paid_at":      now,
				"period_start": now,
				"period_end":   periodEnd,
			})
			if sub.DiscountCodeID != nil {
				db.Model(&models.DiscountCode{}).
					Where("id = ?", *sub.DiscountCodeID).
					UpdateColumn("times_redeemed", gorm.Expr("times_redeemed + 1"))
			}
			// Boleta automática de seguimiento — no es la boleta electrónica en sí (SUNAT no
			// está integrado todavía), es el registro interno de "esto se vendió" para que el
			// contador sepa qué le falta emitir manualmente por el portal de SUNAT y un admin
			// pueda marcarla como enviada después (ver AdminSalesHandler).
			db.Create(&models.Boleta{
				UserSubscriptionID: sub.ID,
				UserID:             sub.UserID,
				AmountCents:        sub.FinalPriceCents,
				Status:             models.BoletaPending,
			})
			planCounts[sub.Plan.Name]++
		}
		if len(subs) > 0 {
			items := make([]map[string]interface{}, 0, len(planCounts))
			for name, qty := range planCounts {
				items = append(items, map[string]interface{}{"plan_name": name, "quantity": qty})
			}
			logAuditEvent(db, models.AuditSubscriptionPurchased, subs[0].UserID, auditOpts{
				Metadata: map[string]interface{}{"items": items},
			})
		}
	case "failed", "cancelled":
		for _, sub := range subs {
			db.Model(&models.UserSubscription{}).Where("id = ?", sub.ID).Update("status", models.SubscriptionFailed)
		}
	}
}
