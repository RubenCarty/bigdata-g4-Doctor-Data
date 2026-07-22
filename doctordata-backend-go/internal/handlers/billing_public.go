package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/middleware"
	"doctordata-backend-go/internal/models"
)

// BillingPublicHandler — endpoints sin autenticación para que la página de precios (previa
// al registro) pueda listar planes y previsualizar descuentos.
type BillingPublicHandler struct {
	db *gorm.DB
}

func NewBillingPublicHandler(db *gorm.DB) *BillingPublicHandler {
	return &BillingPublicHandler{db: db}
}

// GET /public/plans
func (h *BillingPublicHandler) ListActivePlans(c *gin.Context) {
	var plans []models.SubscriptionPlan
	h.db.Where("is_active = true AND (available_until IS NULL OR available_until > ?)", time.Now()).
		Order("sort_order asc, price_cents asc").Find(&plans)
	c.JSON(http.StatusOK, plans)
}

// POST /public/discount-codes/preview
func (h *BillingPublicHandler) PreviewDiscount(c *gin.Context) {
	var req struct {
		Code  string `json:"code" binding:"required"`
		Items []struct {
			PlanID   uuid.UUID `json:"plan_id"  binding:"required"`
			Quantity int       `json:"quantity" binding:"required,min=1"`
		} `json:"items" binding:"required,min=1"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var items []planQty
	for _, item := range req.Items {
		var plan models.SubscriptionPlan
		if err := h.db.Where("id = ? AND is_active = true", item.PlanID).First(&plan).Error; err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "plan inválido o inactivo"})
			return
		}
		items = append(items, planQty{Plan: plan, Quantity: item.Quantity})
	}
	subtotalCents, eligibleCents := computeSubtotals(items)

	dc, err := resolveActiveDiscountCode(h.db, req.Code, time.Now())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if dc == nil {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "invalid_or_expired_code"})
		return
	}
	if dc.MaxRedemptions != nil && dc.TimesRedeemed >= *dc.MaxRedemptions {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "invalid_or_expired_code"})
		return
	}
	if eligibleCents == 0 {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "code_not_applicable_to_selected_plans"})
		return
	}
	if uid, ok := middleware.OptionalUserID(c); ok && userAlreadyRedeemedCode(h.db, uid, dc.ID) {
		c.JSON(http.StatusOK, gin.H{"valid": false, "error": "discount_code_already_used"})
		return
	}

	discountAmountCents := computeDiscountAmount(dc, eligibleCents)

	c.JSON(http.StatusOK, gin.H{
		"valid":                 true,
		"discount_type":         dc.Type,
		"subtotal_cents":        subtotalCents,
		"discount_amount_cents": discountAmountCents,
		"final_amount_cents":    subtotalCents - discountAmountCents,
	})
}
