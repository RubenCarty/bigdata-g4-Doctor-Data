package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
	"doctordata-backend-go/internal/payments"
)

// BillingHandler — endpoints autenticados de suscripciones/checkout del propio usuario.
type BillingHandler struct {
	db      *gorm.DB
	gateway payments.PaymentGateway
}

func NewBillingHandler(db *gorm.DB, gateway payments.PaymentGateway) *BillingHandler {
	return &BillingHandler{db: db, gateway: gateway}
}

// GET /me/subscriptions
func (h *BillingHandler) ListMySubscriptions(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var subs []models.UserSubscription
	h.db.Preload("Plan").Where("user_id = ?", userID).Order("created_at desc").Find(&subs)
	c.JSON(http.StatusOK, subs)
}

// GET /me/subscriptions/capacity
func (h *BillingHandler) GetMyCapacity(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	total, used := computeCapacity(h.db, userID)
	c.JSON(http.StatusOK, gin.H{
		"total_capacity":     total,
		"used_capacity":      used,
		"remaining_capacity": total - used,
	})
}

// GET /me/subscriptions/:id
func (h *BillingHandler) GetSubscriptionStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var sub models.UserSubscription
	if err := h.db.Preload("Plan").Where("id = ? AND user_id = ?", id, userID).First(&sub).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "suscripción no encontrada"})
		return
	}
	c.JSON(http.StatusOK, sub)
}

// POST /me/subscriptions/checkout
func (h *BillingHandler) CreateCheckout(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		Items []struct {
			PlanID   uuid.UUID `json:"plan_id"  binding:"required"`
			Quantity int       `json:"quantity" binding:"required,min=1"`
		} `json:"items" binding:"required,min=1"`
		DiscountCode string `json:"discount_code"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// 1. Cargar planes referenciados y calcular subtotal.
	type unit struct {
		plan models.SubscriptionPlan
	}
	var units []unit
	var cartItems []planQty
	for _, item := range req.Items {
		var plan models.SubscriptionPlan
		if err := h.db.Where("id = ? AND is_active = true", item.PlanID).First(&plan).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "plan inválido o inactivo"})
			return
		}
		cartItems = append(cartItems, planQty{Plan: plan, Quantity: item.Quantity})
		for i := 0; i < item.Quantity; i++ {
			units = append(units, unit{plan: plan})
		}
	}
	subtotalCents, eligibleCents := computeSubtotals(cartItems)

	// 2. Resolver código de descuento (opcional). Se calcula solo sobre eligibleCents —
	// los planes con AllowsDiscounts=false (ej. "Fundador") no reducen su precio aunque
	// compartan carrito con planes que sí lo permiten.
	var discountCode *models.DiscountCode
	var discountAmountCents int64
	if req.DiscountCode != "" {
		dc, err := resolveActiveDiscountCode(h.db, req.DiscountCode, time.Now())
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
			return
		}
		if dc == nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_or_expired_code"})
			return
		}
		if dc.MaxRedemptions != nil && dc.TimesRedeemed >= *dc.MaxRedemptions {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid_or_expired_code"})
			return
		}
		if userAlreadyRedeemedCode(h.db, userID, dc.ID) {
			c.JSON(http.StatusBadRequest, gin.H{"error": "discount_code_already_used"})
			return
		}
		if eligibleCents == 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "code_not_applicable_to_selected_plans"})
			return
		}
		discountCode = dc
		discountAmountCents = computeDiscountAmount(dc, eligibleCents)
	}

	// 3. Crear una UserSubscription (pending_payment) por unidad comprada. El descuento se
	// aplica únicamente a la primera fila ELEGIBLE (AllowsDiscounts=true) — simplificación
	// documentada, sin prorrateo entre varias filas en este MVP. Nunca se le asigna a una
	// fila de un plan no elegible (ej. "Fundador"), aunque sea la primera del carrito.
	orderRef := uuid.NewString()
	subscriptionIDs := make([]uuid.UUID, 0, len(units))
	totalFinalCents := subtotalCents - discountAmountCents
	discountAssigned := false

	for _, u := range units {
		sub := models.UserSubscription{
			UserID:             userID,
			SubscriptionPlanID: u.plan.ID,
			Status:             models.SubscriptionPendingPayment,
			CoveredCapacity:    u.plan.CoveredCapacity,
			PriceCents:         u.plan.PriceCents,
			FinalPriceCents:    u.plan.PriceCents,
		}
		if !discountAssigned && discountCode != nil && u.plan.AllowsDiscounts {
			sub.DiscountCodeID = &discountCode.ID
			sub.DiscountAmountCents = discountAmountCents
			sub.FinalPriceCents = u.plan.PriceCents - discountAmountCents
			discountAssigned = true
		}
		if err := h.db.Create(&sub).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la suscripción"})
			return
		}
		subscriptionIDs = append(subscriptionIDs, sub.ID)
	}

	// 4. Carrito en S/ 0.00 (descuento de 100%): Izipay rechaza cobros por ese monto, así que
	// nunca lo intentamos — se activa directo, sin pasar por ninguna pasarela, reusando la
	// misma lógica que un webhook de pago exitoso (applyPaymentEvent, en billing_webhook.go)
	// para no duplicar la activación/Boleta/incremento de TimesRedeemed en dos lugares.
	if totalFinalCents == 0 {
		h.db.Model(&models.UserSubscription{}).
			Where("id IN ?", subscriptionIDs).
			Update("payment_gateway_ref", orderRef)
		applyPaymentEvent(h.db, &payments.WebhookEvent{GatewayRef: orderRef, Status: "paid"})
		c.JSON(http.StatusCreated, gin.H{
			"already_paid":     true,
			"subscription_ids": subscriptionIDs,
		})
		return
	}

	// 5. Iniciar la sesión de pago con la pasarela. orderRef es nuestra referencia interna;
	// session.GatewayRef es la referencia que la pasarela usará al notificar el webhook, así
	// que es la que se guarda en PaymentGatewayRef para poder correlacionarlas.
	metadata := map[string]string{"user_id": userID.String()}
	session, err := h.gateway.CreateCheckoutSession(c.Request.Context(), orderRef, totalFinalCents, "PEN", metadata)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"error": "no se pudo iniciar el pago"})
		return
	}

	h.db.Model(&models.UserSubscription{}).
		Where("id IN ?", subscriptionIDs).
		Update("payment_gateway_ref", session.GatewayRef)

	// Nota: DiscountCode.TimesRedeemed NO se incrementa aquí — se incrementa recién cuando
	// el webhook confirma el pago (ver billing_webhook.go), para no penalizar códigos por
	// carritos abandonados o pagos fallidos.

	c.JSON(http.StatusCreated, gin.H{
		"checkout_url":     session.RedirectURL,
		"form_token":       session.FormToken,
		"public_key":       session.PublicKey,
		"subscription_ids": subscriptionIDs,
	})
}
