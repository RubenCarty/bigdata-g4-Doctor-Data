package handlers

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/email"
	"doctordata-backend-go/internal/models"
)

// PartnershipHandler — formulario de "Alianzas y convenios" del index (público) y su
// bandeja de revisión para admin. No usa PaymentGateway ni crea nada más: un admin que
// decide seguir adelante crea el DiscountCode correspondiente a mano en /admin/discount-codes.
type PartnershipHandler struct {
	db *gorm.DB
}

func NewPartnershipHandler(db *gorm.DB) *PartnershipHandler {
	return &PartnershipHandler{db: db}
}

// POST /public/partnership-requests — sin autenticación.
func (h *PartnershipHandler) Create(c *gin.Context) {
	var req struct {
		CompanyName        string `json:"company_name" binding:"required"`
		ContactName        string `json:"contact_name" binding:"required"`
		Email              string `json:"email"         binding:"required,email"`
		Phone              string `json:"phone"`
		EstimatedEmployees int    `json:"estimated_employees"`
		Message            string `json:"message"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pr := models.PartnershipRequest{
		CompanyName:        req.CompanyName,
		ContactName:        req.ContactName,
		Email:              req.Email,
		Phone:              req.Phone,
		EstimatedEmployees: req.EstimatedEmployees,
		Message:            req.Message,
		Status:             models.PartnershipPending,
	}
	if err := h.db.Create(&pr).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al enviar la solicitud"})
		return
	}
	go notifyPartnershipRequest(pr)
	c.JSON(http.StatusCreated, gin.H{"message": "solicitud recibida"})
}

// notifyPartnershipRequest envía dos correos — uno a nosotros (contacto@mydoctordata.net)
// avisando de la nueva solicitud, y uno a la empresa confirmando que la recibimos y que la
// vamos a contactar. Best-effort y en su propia goroutine a propósito: un correo puede
// tardar (conexión SMTP + STARTTLS) y un fallo de envío (o SMTP sin configurar todavía en
// este entorno) nunca debe demorar ni bloquear la respuesta al formulario — la solicitud ya
// quedó guardada en la base de datos antes de llegar acá.
func notifyPartnershipRequest(pr models.PartnershipRequest) {
	if !email.IsConfigured() {
		log.Printf("[partnership] SMTP no configurado — se omite el envío de correos para la solicitud de %s", pr.CompanyName)
		return
	}

	notifyTo := os.Getenv("CONTACT_NOTIFY_EMAIL")
	if notifyTo == "" {
		notifyTo = "contacto@mydoctordata.net"
	}
	internalBody := fmt.Sprintf(
		"Nueva solicitud de convenio recibida.\n\n"+
			"Empresa: %s\n"+
			"Contacto: %s\n"+
			"Correo: %s\n"+
			"Teléfono: %s\n"+
			"Colaboradores aproximados: %d\n"+
			"Mensaje: %s\n",
		pr.CompanyName, pr.ContactName, pr.Email, pr.Phone, pr.EstimatedEmployees, pr.Message,
	)
	if err := email.Send(notifyTo, "Nueva solicitud de convenio — "+pr.CompanyName, internalBody); err != nil {
		log.Printf("[partnership] fallo al notificar a %s: %v", notifyTo, err)
	}

	confirmBody := fmt.Sprintf(
		"Hola %s,\n\n"+
			"Recibimos la solicitud de convenio de %s. Nuestro equipo la va a revisar y se "+
			"pondrá en contacto contigo pronto.\n\n"+
			"Saludos,\nEquipo DoctorData",
		pr.ContactName, pr.CompanyName,
	)
	if err := email.Send(pr.Email, "Recibimos tu solicitud de convenio con DoctorData", confirmBody); err != nil {
		log.Printf("[partnership] fallo al confirmar a %s: %v", pr.Email, err)
	}
}

// GET /admin/partnership-requests
func (h *PartnershipHandler) List(c *gin.Context) {
	var reqs []models.PartnershipRequest
	h.db.Order("created_at desc").Find(&reqs)
	c.JSON(http.StatusOK, reqs)
}

// PUT /admin/partnership-requests/:id — solo permite mover el estado de seguimiento.
func (h *PartnershipHandler) UpdateStatus(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Status models.PartnershipRequestStatus `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if req.Status != models.PartnershipPending && req.Status != models.PartnershipContacted && req.Status != models.PartnershipClosed {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status debe ser 'pending', 'contacted' o 'closed'"})
		return
	}

	res := h.db.Model(&models.PartnershipRequest{}).Where("id = ?", id).Update("status", req.Status)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "solicitud no encontrada"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "estado actualizado"})
}
