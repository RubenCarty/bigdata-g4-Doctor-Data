package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// AdminBillingHandler — CRUD de planes de suscripción y códigos de descuento. Montado bajo
// middleware.RequireAdmin() (no requiere super admin: gestionar planes/descuentos es una
// capacidad de is_admin según el dueño del producto).
type AdminBillingHandler struct {
	db *gorm.DB
}

func NewAdminBillingHandler(db *gorm.DB) *AdminBillingHandler {
	return &AdminBillingHandler{db: db}
}

// ── Planes ──────────────────────────────────────────────────────────────────────────────

// GET /admin/plans — incluye planes inactivos (vista de administración)
func (h *AdminBillingHandler) ListPlans(c *gin.Context) {
	var plans []models.SubscriptionPlan
	h.db.Order("sort_order asc, price_cents asc").Find(&plans)
	c.JSON(http.StatusOK, plans)
}

// POST /admin/plans
func (h *AdminBillingHandler) CreatePlan(c *gin.Context) {
	var req struct {
		Name              string               `json:"name"             binding:"required"`
		Description       string               `json:"description"`
		BillingPeriod     models.BillingPeriod `json:"billing_period"   binding:"required"`
		CoveredCapacity   int                  `json:"covered_capacity" binding:"required,min=1"`
		PriceCents        int64                `json:"price_cents"      binding:"required,min=1"`
		Currency          string               `json:"currency"`
		IsActive          *bool                `json:"is_active"`
		IsFeatured        *bool                `json:"is_featured"`
		AllowsDiscounts   *bool                `json:"allows_discounts"`
		SortOrder         int                  `json:"sort_order"`
		PromoLabel        string               `json:"promo_label"`
		AvailableUntil    *time.Time           `json:"available_until"`
		RenewalPriceCents *int64               `json:"renewal_price_cents"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.BillingPeriod != models.BillingMonthly && req.BillingPeriod != models.BillingAnnual {
		c.JSON(http.StatusBadRequest, gin.H{"error": "billing_period debe ser 'monthly' o 'annual'"})
		return
	}

	plan := models.SubscriptionPlan{
		Name:              req.Name,
		Description:       req.Description,
		BillingPeriod:     req.BillingPeriod,
		CoveredCapacity:   req.CoveredCapacity,
		PriceCents:        req.PriceCents,
		Currency:          req.Currency,
		IsActive:          true,
		AllowsDiscounts:   true,
		SortOrder:         req.SortOrder,
		PromoLabel:        req.PromoLabel,
		AvailableUntil:    req.AvailableUntil,
		RenewalPriceCents: req.RenewalPriceCents,
	}
	if req.Currency == "" {
		plan.Currency = "PEN"
	}
	if req.IsActive != nil {
		plan.IsActive = *req.IsActive
	}
	if req.IsFeatured != nil {
		plan.IsFeatured = *req.IsFeatured
	}
	if req.AllowsDiscounts != nil {
		plan.AllowsDiscounts = *req.AllowsDiscounts
	}

	// Select("*") fuerza a GORM a incluir todos los campos en el INSERT — sin esto, un bool
	// explícitamente en false (ej. allows_discounts: false) coincide con su zero-value de Go
	// y, como la columna tiene gorm:"default:...", GORM lo omite del INSERT y la base aplica
	// su default en su lugar, ignorando silenciosamente lo que el admin pidió.
	if err := h.db.Select("*").Create(&plan).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear el plan"})
		return
	}
	c.JSON(http.StatusCreated, plan)
}

// PUT /admin/plans/:id
func (h *AdminBillingHandler) UpdatePlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Name              *string               `json:"name"`
		Description       *string               `json:"description"`
		BillingPeriod     *models.BillingPeriod `json:"billing_period"`
		CoveredCapacity   *int                  `json:"covered_capacity"`
		PriceCents        *int64                `json:"price_cents"`
		Currency          *string               `json:"currency"`
		IsActive          *bool                 `json:"is_active"`
		IsFeatured        *bool                 `json:"is_featured"`
		AllowsDiscounts   *bool                 `json:"allows_discounts"`
		SortOrder         *int                  `json:"sort_order"`
		PromoLabel        *string               `json:"promo_label"`
		AvailableUntil    *time.Time            `json:"available_until"`
		RenewalPriceCents *int64                `json:"renewal_price_cents"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Name != nil {
		updates["name"] = *req.Name
	}
	if req.Description != nil {
		updates["description"] = *req.Description
	}
	if req.BillingPeriod != nil {
		if *req.BillingPeriod != models.BillingMonthly && *req.BillingPeriod != models.BillingAnnual {
			c.JSON(http.StatusBadRequest, gin.H{"error": "billing_period debe ser 'monthly' o 'annual'"})
			return
		}
		updates["billing_period"] = *req.BillingPeriod
	}
	if req.CoveredCapacity != nil {
		updates["covered_capacity"] = *req.CoveredCapacity
	}
	if req.PriceCents != nil {
		updates["price_cents"] = *req.PriceCents
	}
	if req.Currency != nil {
		updates["currency"] = *req.Currency
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.IsFeatured != nil {
		updates["is_featured"] = *req.IsFeatured
	}
	if req.AllowsDiscounts != nil {
		updates["allows_discounts"] = *req.AllowsDiscounts
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}
	if req.PromoLabel != nil {
		updates["promo_label"] = *req.PromoLabel
	}
	if req.AvailableUntil != nil {
		updates["available_until"] = *req.AvailableUntil
	}
	if req.RenewalPriceCents != nil {
		updates["renewal_price_cents"] = *req.RenewalPriceCents
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sin campos para actualizar"})
		return
	}

	res := h.db.Model(&models.SubscriptionPlan{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "plan actualizado"})
}

// DELETE /admin/plans/:id — soft delete (las UserSubscription existentes conservan su FK)
func (h *AdminBillingHandler) DeletePlan(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	res := h.db.Delete(&models.SubscriptionPlan{}, "id = ?", id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al eliminar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "plan no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "plan eliminado"})
}

// ── Códigos de descuento ────────────────────────────────────────────────────────────────

// GET /admin/discount-codes?code= — filtra por texto de código para revisar todas las
// ventanas de vigencia que comparten el mismo texto.
func (h *AdminBillingHandler) ListDiscountCodes(c *gin.Context) {
	code := c.Query("code")
	var codes []models.DiscountCode
	q := h.db.Order("code asc, valid_from desc")
	if code != "" {
		q = q.Where("code = ?", code)
	}
	q.Find(&codes)
	c.JSON(http.StatusOK, codes)
}

// POST /admin/discount-codes — NO rechaza texto de código duplicado a propósito: el mismo
// texto puede tener varias ventanas de vigencia con reglas distintas (fijo/porcentual).
func (h *AdminBillingHandler) CreateDiscountCode(c *gin.Context) {
	var req struct {
		Code            string              `json:"code"          binding:"required"`
		Type            models.DiscountType `json:"type"          binding:"required"`
		AmountCents     int64               `json:"amount_cents"`
		PercentOff      int                 `json:"percent_off"`
		ValidFrom       time.Time           `json:"valid_from"    binding:"required"`
		ValidUntil      time.Time           `json:"valid_until"   binding:"required"`
		MaxRedemptions  *int                `json:"max_redemptions"`
		ReferringUserID *uuid.UUID          `json:"referring_user_id"`
		Notes           string              `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Type != models.DiscountFixed && req.Type != models.DiscountPercentage {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type debe ser 'fixed' o 'percentage'"})
		return
	}
	if req.Type == models.DiscountFixed && req.AmountCents <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "amount_cents debe ser mayor a 0 para descuentos fijos"})
		return
	}
	if req.Type == models.DiscountPercentage && (req.PercentOff < 1 || req.PercentOff > 100) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "percent_off debe estar entre 1 y 100"})
		return
	}
	if !req.ValidFrom.Before(req.ValidUntil) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "valid_from debe ser anterior a valid_until"})
		return
	}

	dc := models.DiscountCode{
		Code:            req.Code,
		Type:            req.Type,
		AmountCents:     req.AmountCents,
		PercentOff:      req.PercentOff,
		ValidFrom:       req.ValidFrom,
		ValidUntil:      req.ValidUntil,
		IsActive:        true,
		MaxRedemptions:  req.MaxRedemptions,
		ReferringUserID: req.ReferringUserID,
		Notes:           req.Notes,
	}
	if err := h.db.Create(&dc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear el código"})
		return
	}
	logAuditEvent(h.db, models.AuditDiscountCodeCreated, c.MustGet("user_id").(uuid.UUID), auditOpts{
		Metadata: map[string]interface{}{"code": dc.Code, "type": string(dc.Type)},
	})

	resp := gin.H{"discount_code": dc}

	// Aviso no bloqueante si hay otro registro activo con el mismo texto y ventana solapada.
	var overlapCount int64
	h.db.Model(&models.DiscountCode{}).
		Where("id <> ? AND code = ? AND is_active = true AND valid_from <= ? AND valid_until >= ?",
			dc.ID, dc.Code, dc.ValidUntil, dc.ValidFrom).
		Count(&overlapCount)
	if overlapCount > 0 {
		resp["warning"] = "overlapping_window_same_code"
	}

	c.JSON(http.StatusCreated, resp)
}

// PUT /admin/discount-codes/:id
func (h *AdminBillingHandler) UpdateDiscountCode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Code            *string              `json:"code"`
		Type            *models.DiscountType `json:"type"`
		AmountCents     *int64               `json:"amount_cents"`
		PercentOff      *int                 `json:"percent_off"`
		ValidFrom       *time.Time           `json:"valid_from"`
		ValidUntil      *time.Time           `json:"valid_until"`
		IsActive        *bool                `json:"is_active"`
		MaxRedemptions  *int                 `json:"max_redemptions"`
		ReferringUserID *uuid.UUID           `json:"referring_user_id"`
		Notes           *string              `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{}
	if req.Code != nil {
		updates["code"] = *req.Code
	}
	if req.Type != nil {
		if *req.Type != models.DiscountFixed && *req.Type != models.DiscountPercentage {
			c.JSON(http.StatusBadRequest, gin.H{"error": "type debe ser 'fixed' o 'percentage'"})
			return
		}
		updates["type"] = *req.Type
	}
	if req.AmountCents != nil {
		updates["amount_cents"] = *req.AmountCents
	}
	if req.PercentOff != nil {
		updates["percent_off"] = *req.PercentOff
	}
	if req.ValidFrom != nil {
		updates["valid_from"] = *req.ValidFrom
	}
	if req.ValidUntil != nil {
		updates["valid_until"] = *req.ValidUntil
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}
	if req.MaxRedemptions != nil {
		updates["max_redemptions"] = *req.MaxRedemptions
	}
	if req.ReferringUserID != nil {
		updates["referring_user_id"] = *req.ReferringUserID
	}
	if req.Notes != nil {
		updates["notes"] = *req.Notes
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sin campos para actualizar"})
		return
	}

	res := h.db.Model(&models.DiscountCode{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "código no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "código actualizado"})
}

// DELETE /admin/discount-codes/:id — soft delete
func (h *AdminBillingHandler) DeleteDiscountCode(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	res := h.db.Delete(&models.DiscountCode{}, "id = ?", id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al eliminar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "código no encontrado"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "código eliminado"})
}
