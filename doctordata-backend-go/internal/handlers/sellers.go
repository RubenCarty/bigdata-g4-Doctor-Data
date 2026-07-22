package handlers

import (
	"net/http"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// SellerHandler — leaderboard de comisiones y códigos de descuento propios para el rol
// Ventas (is_sales). Montado bajo middleware.RequireSales() (is_sales o is_admin), grupo
// aparte de /admin/* — ver internal/server/routes.go.
//
// La comisión de una venta individual (B2C) es 10% fijo del final_price_cents de la
// UserSubscription pagada — misma tasa que la calculadora de convenios B2B, confirmada con
// el dueño del producto. Se atribuye a un vendedor únicamente vía
// DiscountCode.ReferringUserID (ya existía en el modelo, nunca se había usado para nada).
type SellerHandler struct {
	db *gorm.DB
}

func NewSellerHandler(db *gorm.DB) *SellerHandler {
	return &SellerHandler{db: db}
}

// sellerCodeValidityDays — cuánto dura vigente un código creado por un vendedor. Fijo, no
// expuesto en el form (mantiene la herramienta simple: solo código + porcentaje).
const sellerCodeValidityDays = 365

// LeaderboardEntry — una fila del ranking de vendedores.
type LeaderboardEntry struct {
	SellerID        uuid.UUID `json:"seller_id"`
	Email           string    `json:"email"`
	CommissionCents int64     `json:"commission_cents"`
	SalesCount      int64     `json:"sales_count"`
}

// GET /admin/sellers/leaderboard — top 10 vendedores por comisión de los últimos 30 días.
// Ventana móvil automática (siempre "hoy menos 30 días"), recalculada en cada request, sin
// estado guardado — así lo pidió el dueño del producto explícitamente.
func (h *SellerHandler) GetLeaderboard(c *gin.Context) {
	since := time.Now().AddDate(0, 0, -30)

	var rows []LeaderboardEntry
	err := h.db.Table("user_subscriptions AS us").
		Select("dc.referring_user_id AS seller_id, u.email AS email, "+
			"SUM((us.final_price_cents * 10) / 100) AS commission_cents, COUNT(*) AS sales_count").
		Joins("JOIN discount_codes dc ON dc.id = us.discount_code_id").
		Joins("JOIN users u ON u.id = dc.referring_user_id").
		Where("us.paid_at IS NOT NULL AND us.paid_at >= ? AND dc.referring_user_id IS NOT NULL", since).
		Group("dc.referring_user_id, u.email").
		Order("commission_cents DESC").
		Limit(10).
		Scan(&rows).Error
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al calcular el leaderboard"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"since": since, "leaderboard": rows})
}

// GET /admin/sellers/discount-codes — solo los códigos propios del vendedor que llama (no ve
// los de otros vendedores; eso lo ve un admin sin filtrar en AdminDiscounts.jsx).
func (h *SellerHandler) ListMyDiscountCodes(c *gin.Context) {
	callerID := c.MustGet("user_id").(uuid.UUID)

	var codes []models.DiscountCode
	h.db.Where("referring_user_id = ?", callerID).Order("created_at desc").Find(&codes)
	c.JSON(http.StatusOK, codes)
}

// POST /admin/sellers/discount-codes — crea un código propio, acotado. El servidor fuerza
// todo lo sensible (tipo, rango de porcentaje, a quién se atribuye, vigencia) — el body solo
// puede elegir el texto del código y el porcentaje.
//
// A diferencia de los códigos que crea un admin (donde el mismo texto puede repetirse a
// propósito en varias ventanas de vigencia, ver models.DiscountCode), acá el texto tiene que
// ser único en TODA la tabla — si Ricardo ya creó "SANPEDRO", Julio no puede crear otro
// "SANPEDRO": el código deja de identificar de forma inequívoca a quién referir la venta. El
// primero que lo registra se lo queda.
func (h *SellerHandler) CreateMyDiscountCode(c *gin.Context) {
	callerID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		Code       string `json:"code"        binding:"required"`
		PercentOff int    `json:"percent_off" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.PercentOff < 1 || req.PercentOff > 50 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "percent_off debe estar entre 1 y 50"})
		return
	}

	code := strings.ToUpper(strings.TrimSpace(req.Code))
	if code == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "code requerido"})
		return
	}

	var existing int64
	h.db.Model(&models.DiscountCode{}).Where("code = ?", code).Count(&existing)
	if existing > 0 {
		c.JSON(http.StatusConflict, gin.H{"error": "code_already_taken"})
		return
	}

	now := time.Now()
	dc := models.DiscountCode{
		Code:            code,
		Type:            models.DiscountPercentage,
		PercentOff:      req.PercentOff,
		ValidFrom:       now,
		ValidUntil:      now.AddDate(0, 0, sellerCodeValidityDays),
		IsActive:        true,
		ReferringUserID: &callerID,
	}
	if err := h.db.Create(&dc).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear el código"})
		return
	}
	logAuditEvent(h.db, models.AuditDiscountCodeCreated, callerID, auditOpts{
		Metadata: map[string]interface{}{"code": dc.Code, "type": string(dc.Type), "created_by_seller": true},
	})

	c.JSON(http.StatusCreated, gin.H{"discount_code": dc})
}
