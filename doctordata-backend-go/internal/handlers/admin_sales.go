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

// AdminSalesHandler — boletas (seguimiento automático de venta de suscripciones) y facturas
// (convenios empresariales, cargadas a mano) para el panel de administración. Montado bajo
// middleware.RequireAccounting() (is_accounting o is_admin — ver internal/server/routes.go),
// no RequireAdmin() como el resto de /admin/*: es justo lo que necesita ver una cuenta de
// Contabilidad sin acceso al resto del panel.
//
// izipayFeeRate/igvRate son las tasas reales que confirmó el dueño del producto: 3.44% +
// 0.69% de Izipay, y 18% de IGV ya incluido en el precio que paga el cliente (no se suma
// aparte). Se usan solo para el desglose de GetSalesStats — no se guardan por boleta.
const (
	izipayFeeRate = 0.0344 + 0.0069
	igvRate       = 0.18
)

type AdminSalesHandler struct {
	db *gorm.DB
}

func NewAdminSalesHandler(db *gorm.DB) *AdminSalesHandler {
	return &AdminSalesHandler{db: db}
}

// ── Boletas ──────────────────────────────────────────────────────────────────────────────

// GET /admin/boletas — ?status=pending|sent para filtrar
func (h *AdminSalesHandler) ListBoletas(c *gin.Context) {
	var boletas []models.Boleta
	q := h.db.Preload("User.PatientProfile").Preload("UserSubscription.Plan").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&boletas)

	// Mismo patrón que AdminUsersHandler.ListUsers para armar patient_name: descifra
	// FirstName/LastName del PatientProfile del comprador. Queda vacío si todavía no llenó
	// sus datos personales (compró la suscripción antes de cargar su perfil).
	for i := range boletas {
		if p := boletas[i].User.PatientProfile; p != nil {
			name := strings.TrimSpace(string(p.FirstName) + " " + string(p.LastName))
			boletas[i].PatientName = name
			boletas[i].PatientDocumentNumber = string(p.DocumentNumber)
		}
	}

	c.JSON(http.StatusOK, boletas)
}

// PUT /admin/boletas/:id — marca la boleta como enviada (o la vuelve a pendiente) y guarda
// el número real que asignó SUNAT cuando el contador la emite manualmente por su portal.
func (h *AdminSalesHandler) UpdateBoleta(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Status       models.BoletaStatus `json:"status" binding:"required"`
		BoletaNumber string              `json:"boleta_number"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != models.BoletaPending && req.Status != models.BoletaSent {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status debe ser 'pending' o 'sent'"})
		return
	}

	updates := map[string]interface{}{"status": req.Status}
	if req.Status == models.BoletaSent {
		now := time.Now()
		updates["sent_at"] = now
		if req.BoletaNumber != "" {
			updates["boleta_number"] = req.BoletaNumber
		}
	} else {
		updates["sent_at"] = nil
	}

	res := h.db.Model(&models.Boleta{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "boleta no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "actualizado"})
}

// ── Facturas ─────────────────────────────────────────────────────────────────────────────

// GET /admin/facturas — ?status=pending|sent|paid para filtrar, mismo patrón que ListBoletas
func (h *AdminSalesHandler) ListFacturas(c *gin.Context) {
	var facturas []models.Factura
	q := h.db.Preload("PartnershipRequest").Order("created_at desc")
	if status := c.Query("status"); status != "" {
		q = q.Where("status = ?", status)
	}
	q.Find(&facturas)
	c.JSON(http.StatusOK, facturas)
}

// POST /admin/facturas — un admin/super admin la carga a mano (número, empresa, monto).
func (h *AdminSalesHandler) CreateFactura(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		InvoiceNumber        string  `json:"invoice_number" binding:"required"`
		CompanyName          string  `json:"company_name"   binding:"required"`
		RUC                  string  `json:"ruc"`
		AmountCents          int64   `json:"amount_cents"   binding:"required,min=1"`
		Description          string  `json:"description"`
		PartnershipRequestID *string `json:"partnership_request_id"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	factura := models.Factura{
		InvoiceNumber:   req.InvoiceNumber,
		CompanyName:     req.CompanyName,
		RUC:             req.RUC,
		AmountCents:     req.AmountCents,
		Description:     req.Description,
		Status:          models.FacturaPending,
		CreatedByUserID: userID,
	}
	if req.PartnershipRequestID != nil && *req.PartnershipRequestID != "" {
		if prID, err := uuid.Parse(*req.PartnershipRequestID); err == nil {
			factura.PartnershipRequestID = &prID
		}
	}

	if err := h.db.Create(&factura).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la factura"})
		return
	}
	c.JSON(http.StatusCreated, factura)
}

// PUT /admin/facturas/:id
func (h *AdminSalesHandler) UpdateFactura(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		InvoiceNumber string               `json:"invoice_number" binding:"required"`
		CompanyName   string               `json:"company_name"   binding:"required"`
		RUC           string               `json:"ruc"`
		AmountCents   int64                `json:"amount_cents"   binding:"required,min=1"`
		Description   string               `json:"description"`
		Status        models.FacturaStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != models.FacturaPending && req.Status != models.FacturaSent && req.Status != models.FacturaPaid {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status debe ser 'pending', 'sent' o 'paid'"})
		return
	}

	res := h.db.Model(&models.Factura{}).Where("id = ?", id).Updates(map[string]interface{}{
		"invoice_number": req.InvoiceNumber,
		"company_name":   req.CompanyName,
		"ruc":            req.RUC,
		"amount_cents":   req.AmountCents,
		"description":    req.Description,
		"status":         req.Status,
	})
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "factura no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "actualizado"})
}

// DELETE /admin/facturas/:id
func (h *AdminSalesHandler) DeleteFactura(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}
	res := h.db.Delete(&models.Factura{}, "id = ?", id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al eliminar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "factura no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "eliminado"})
}

// ── Estadísticas de venta ────────────────────────────────────────────────────────────────

// GET /admin/sales-stats — últimos 30 días, calculado SOLO sobre Boleta (suscripciones) para
// los totales/desglose por plan/serie diaria. Las Factura de convenios se dejan afuera de
// esos números a propósito: son montos grandes y poco frecuentes (ej. S/69,000 de un solo
// convenio) que distorsionarían por completo un promedio o gráfico pensado para la venta
// recurrente de suscripciones — sí van en su propia clave "facturas" del mismo response,
// pero como una serie completamente separada (para un segundo gráfico, no para sumarse a
// los totales de boletas de arriba).
func (h *AdminSalesHandler) GetSalesStats(c *gin.Context) {
	since := time.Now().AddDate(0, 0, -30)

	var boletas []models.Boleta
	h.db.Preload("UserSubscription.Plan").Where("created_at >= ?", since).Find(&boletas)

	var totalRevenue int64
	// byPlan se agrupa por SubscriptionPlanID (no por nombre): el catálogo real tiene pares
	// de planes que comparten el mismo Name pero son productos distintos (precio regular vs.
	// precio "Fundador" de lanzamiento, ej. "Personal anual" a S/179 y a S/159) — agrupar por
	// nombre los fusionaría en una sola barra y ocultaría justo la comparación que se busca
	// ("¿cuál plan pega mejor?"). planLabel desambigua agregando el promo_label cuando existe.
	byPlan := map[uuid.UUID]*gin.H{}
	planOrder := []uuid.UUID{}
	// dailyRevenue acumula por fecha (YYYY-MM-DD) para el gráfico de tendencia — se
	// inicializa con los 30 días en cero para que el gráfico siempre tenga el eje completo,
	// no solo los días en que hubo venta.
	dailyRevenue := map[string]int64{}
	dailyCount := map[string]int{}
	dailyOrder := make([]string, 0, 30)
	for i := 29; i >= 0; i-- {
		day := time.Now().AddDate(0, 0, -i).Format("2006-01-02")
		dailyRevenue[day] = 0
		dailyCount[day] = 0
		dailyOrder = append(dailyOrder, day)
	}

	for _, b := range boletas {
		totalRevenue += b.AmountCents
		plan := b.UserSubscription.Plan
		planID := b.UserSubscription.SubscriptionPlanID
		planLabel := plan.Name
		if planLabel == "" {
			planLabel = "Plan desconocido"
		} else if plan.PromoLabel != "" {
			planLabel = planLabel + " — " + plan.PromoLabel
		}
		if _, ok := byPlan[planID]; !ok {
			byPlan[planID] = &gin.H{"plan_name": planLabel, "count": 0, "revenue_cents": int64(0)}
			planOrder = append(planOrder, planID)
		}
		entry := byPlan[planID]
		(*entry)["count"] = (*entry)["count"].(int) + 1
		(*entry)["revenue_cents"] = (*entry)["revenue_cents"].(int64) + b.AmountCents

		day := b.CreatedAt.Format("2006-01-02")
		if _, ok := dailyRevenue[day]; ok {
			dailyRevenue[day] += b.AmountCents
			dailyCount[day]++
		}
	}

	byPlanList := make([]gin.H, 0, len(planOrder))
	for _, id := range planOrder {
		byPlanList = append(byPlanList, *byPlan[id])
	}

	dailyList := make([]gin.H, 0, len(dailyOrder))
	for _, day := range dailyOrder {
		dailyList = append(dailyList, gin.H{"date": day, "revenue_cents": dailyRevenue[day], "count": dailyCount[day]})
	}

	igvCents := int64(float64(totalRevenue) - float64(totalRevenue)/(1+igvRate))
	izipayFeeCents := int64(float64(totalRevenue) * izipayFeeRate)
	netCents := totalRevenue - igvCents - izipayFeeCents

	// Facturas — TODAS (no solo últimos 30 días): son tan poco frecuentes que una ventana de
	// 30 días normalmente mostraría el gráfico vacío. Se agrupan por empresa para el segundo
	// gráfico (de barras horizontales, una por convenio).
	var facturas []models.Factura
	h.db.Order("created_at desc").Find(&facturas)
	var facturaTotal int64
	byCompany := map[string]*gin.H{}
	companyOrder := []string{}
	for _, f := range facturas {
		facturaTotal += f.AmountCents
		if _, ok := byCompany[f.CompanyName]; !ok {
			byCompany[f.CompanyName] = &gin.H{"company_name": f.CompanyName, "count": 0, "amount_cents": int64(0)}
			companyOrder = append(companyOrder, f.CompanyName)
		}
		entry := byCompany[f.CompanyName]
		(*entry)["count"] = (*entry)["count"].(int) + 1
		(*entry)["amount_cents"] = (*entry)["amount_cents"].(int64) + f.AmountCents
	}
	byCompanyList := make([]gin.H, 0, len(companyOrder))
	for _, name := range companyOrder {
		byCompanyList = append(byCompanyList, *byCompany[name])
	}

	c.JSON(http.StatusOK, gin.H{
		"period_days":            30,
		"boletas_count":          len(boletas),
		"total_revenue_cents":    totalRevenue,
		"total_igv_cents":        igvCents,
		"total_izipay_fee_cents": izipayFeeCents,
		"net_cents":              netCents,
		"by_plan":                byPlanList,
		"daily":                  dailyList,
		"facturas": gin.H{
			"count":       len(facturas),
			"total_cents": facturaTotal,
			"by_company":  byCompanyList,
		},
	})
}
