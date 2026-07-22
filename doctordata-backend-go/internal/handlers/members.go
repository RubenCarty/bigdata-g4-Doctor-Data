package handlers

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/email"
	"doctordata-backend-go/internal/models"
)

// MemberHandler — gestiona los perfiles de personas cubiertas por la cuenta pagadora
// (ManagedByUserID), acotado por la capacidad comprada (ver computeCapacity).
type MemberHandler struct {
	db *gorm.DB
}

func NewMemberHandler(db *gorm.DB) *MemberHandler {
	return &MemberHandler{db: db}
}

type memberRequest struct {
	FirstName                    string            `json:"first_name"`
	LastName                     string            `json:"last_name"`
	BirthDate                    *string           `json:"birth_date"`
	Gender                       models.FHIRGender `json:"gender"`
	Phone                        string            `json:"phone"`
	Email                        string            `json:"email"`
	DocumentType                 string            `json:"document_type"`
	DocumentNumber               string            `json:"document_number"`
	AddressStreet                string            `json:"address_street"`
	AddressCity                  string            `json:"address_city"`
	AddressState                 string            `json:"address_state"`
	AddressCountry               string            `json:"address_country"`
	AddressPostalCode            string            `json:"address_postal_code"`
	BloodType                    models.BloodType  `json:"blood_type"`
	HealthInsurance              string            `json:"health_insurance"`
	IsSmoker                     bool              `json:"is_smoker"`
	IsAlcoholConsumer            bool              `json:"is_alcohol_consumer"`
	HasPsychologicalConditions   bool              `json:"has_psychological_conditions"`
	EmergencyContactName         string            `json:"emergency_contact_name"`
	EmergencyContactPhone        string            `json:"emergency_contact_phone"`
	EmergencyContactRelationship string            `json:"emergency_contact_relationship"`
}

// GET /me/members
func (h *MemberHandler) ListMyMembers(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var members []models.PatientProfile
	h.db.Where("managed_by_user_id = ?", userID).Order("created_at asc").Find(&members)
	c.JSON(http.StatusOK, members)
}

// POST /me/members
func (h *MemberHandler) AddMember(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req memberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	total, used := computeCapacity(h.db, userID)
	if used >= total {
		c.JSON(http.StatusConflict, gin.H{
			"error":          "capacity_exceeded",
			"total_capacity": total,
			"used_capacity":  used,
		})
		return
	}

	member := models.PatientProfile{
		ManagedByUserID:              &userID,
		FirstName:                    crypto.EncryptedString(req.FirstName),
		LastName:                     crypto.EncryptedString(req.LastName),
		Gender:                       crypto.EncryptedString(req.Gender),
		Phone:                        crypto.EncryptedString(req.Phone),
		Email:                        crypto.EncryptedString(req.Email),
		DocumentType:                 crypto.EncryptedString(req.DocumentType),
		DocumentNumber:               crypto.EncryptedString(req.DocumentNumber),
		AddressStreet:                crypto.EncryptedString(req.AddressStreet),
		AddressCity:                  crypto.EncryptedString(req.AddressCity),
		AddressState:                 crypto.EncryptedString(req.AddressState),
		AddressCountry:               crypto.EncryptedString(req.AddressCountry),
		AddressPostalCode:            crypto.EncryptedString(req.AddressPostalCode),
		BloodType:                    crypto.EncryptedString(req.BloodType),
		HealthInsurance:              crypto.EncryptedString(req.HealthInsurance),
		IsSmoker:                     crypto.EncryptedBool(req.IsSmoker),
		IsAlcoholConsumer:            crypto.EncryptedBool(req.IsAlcoholConsumer),
		HasPsychologicalConditions:   crypto.EncryptedBool(req.HasPsychologicalConditions),
		EmergencyContactName:         crypto.EncryptedString(req.EmergencyContactName),
		EmergencyContactPhone:        crypto.EncryptedString(req.EmergencyContactPhone),
		EmergencyContactRelationship: crypto.EncryptedString(req.EmergencyContactRelationship),
	}
	if req.BirthDate != nil && *req.BirthDate != "" {
		if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			member.BirthDate = crypto.NewEncryptedTime(&t)
		}
	}

	if err := h.db.Create(&member).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create member"})
		return
	}
	logAuditEvent(h.db, models.AuditPatientAdded, userID, auditOpts{SubjectPatientProfileID: &member.ID})
	c.JSON(http.StatusCreated, member)
}

// PUT /me/members/:id
func (h *MemberHandler) UpdateMember(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var member models.PatientProfile
	if err := h.db.Where("id = ? AND managed_by_user_id = ?", id, userID).First(&member).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	var req memberRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	updates := map[string]interface{}{
		"first_name":                     crypto.EncryptedString(req.FirstName),
		"last_name":                      crypto.EncryptedString(req.LastName),
		"gender":                         crypto.EncryptedString(req.Gender),
		"phone":                          crypto.EncryptedString(req.Phone),
		"email":                          crypto.EncryptedString(req.Email),
		"document_type":                  crypto.EncryptedString(req.DocumentType),
		"document_number":                crypto.EncryptedString(req.DocumentNumber),
		"address_street":                 crypto.EncryptedString(req.AddressStreet),
		"address_city":                   crypto.EncryptedString(req.AddressCity),
		"address_state":                  crypto.EncryptedString(req.AddressState),
		"address_country":                crypto.EncryptedString(req.AddressCountry),
		"address_postal_code":            crypto.EncryptedString(req.AddressPostalCode),
		"blood_type":                     crypto.EncryptedString(req.BloodType),
		"health_insurance":               crypto.EncryptedString(req.HealthInsurance),
		"is_smoker":                      crypto.EncryptedBool(req.IsSmoker),
		"is_alcohol_consumer":            crypto.EncryptedBool(req.IsAlcoholConsumer),
		"has_psychological_conditions":   crypto.EncryptedBool(req.HasPsychologicalConditions),
		"emergency_contact_name":         crypto.EncryptedString(req.EmergencyContactName),
		"emergency_contact_phone":        crypto.EncryptedString(req.EmergencyContactPhone),
		"emergency_contact_relationship": crypto.EncryptedString(req.EmergencyContactRelationship),
	}
	if req.BirthDate != nil && *req.BirthDate != "" {
		if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
			updates["birth_date"] = crypto.NewEncryptedTime(&t)
		}
	}

	if err := h.db.Model(&member).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update member"})
		return
	}
	c.JSON(http.StatusOK, member)
}

// PUT /me/members/:id/life-status — marca/desmarca a una persona cubierta como fallecida o
// desaparecida (ver isValidLifeStatus en patient.go y el comentario en el modelo).
func (h *MemberHandler) UpdateMemberLifeStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !isValidLifeStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status debe ser 'deceased', 'missing' o vacío"})
		return
	}

	res := h.db.Model(&models.PatientProfile{}).Where("id = ? AND managed_by_user_id = ?", id, userID).
		Update("life_status", crypto.EncryptedString(req.Status))
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "actualizado"})
}

// POST /me/members/:id/upload/photo — sube foto de perfil de una persona cubierta. Antes de
// esto no existía forma de subir foto para nadie que no fuera el propio titular (solo
// /me/patient/upload/photo).
func (h *MemberHandler) UploadMemberPhoto(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var member models.PatientProfile
	if err := h.db.Select("id").Where("id = ? AND managed_by_user_id = ?", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}

	url, err := saveUpload(c, "photo", "patients", id.String())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.db.Model(&models.PatientProfile{}).Where("id = ?", id).
		Update("profile_photo_url", url).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al guardar la URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// DELETE /me/members/:id — soft delete, libera capacidad
func (h *MemberHandler) RemoveMember(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	res := h.db.Where("managed_by_user_id = ?", userID).Delete(&models.PatientProfile{}, "id = ?", id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "member removed"})
}

// POST /me/members/:id/nominate-doctor — le crea una cuenta real a una persona cubierta que es
// médico, para que pueda iniciar sesión por su cuenta y ejercer como tal (is_doctor requiere
// login propio — ver internal/middleware/subscription.go SubscriptionPayerID para cómo su
// perfil sigue contando contra la capacidad de quien lo administra, no la suya propia). NO
// activa is_doctor de inmediato: solo da acceso para que complete /me/medical-profile y pase
// por la misma validación de carné CMP que cualquier otro médico (ver AdminMedicalHandler.
// ValidateDoctor) — nominar a alguien por error nunca vuelve a esa persona médico sin que un
// admin lo valide.
func (h *MemberHandler) NominateDoctor(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var member models.PatientProfile
	if err := h.db.Where("id = ? AND managed_by_user_id = ?", id, userID).First(&member).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "member not found"})
		return
	}
	if member.UserID != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "esta persona ya tiene una cuenta vinculada"})
		return
	}
	memberEmail := string(member.Email)
	if memberEmail == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "agrega primero el correo de esta persona"})
		return
	}

	var existing models.User
	if err := h.db.Select("id").Where("email = ?", memberEmail).First(&existing).Error; err == nil {
		c.JSON(http.StatusConflict, gin.H{"error": "ese correo ya tiene una cuenta en DoctorData — escribe a contacto@mydoctordata.net para vincularla"})
		return
	}

	// Contraseña inicial inutilizable a propósito — nadie puede iniciar sesión con esto, solo
	// existe porque PasswordHash es not null; se reemplaza en cuanto la persona define la suya
	// con el token de abajo (mismo mecanismo que ForgotPassword/ResetPassword).
	randomPassword := make([]byte, 32)
	if _, err := rand.Read(randomPassword); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la cuenta"})
		return
	}
	hash, err := bcrypt.GenerateFromPassword(randomPassword, bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la cuenta"})
		return
	}

	tokenBytes := make([]byte, 32)
	if _, err := rand.Read(tokenBytes); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la cuenta"})
		return
	}
	resetToken := hex.EncodeToString(tokenBytes)
	expires := time.Now().Add(1 * time.Hour)

	newUser := models.User{
		Email:                  memberEmail,
		PasswordHash:           string(hash),
		EmailVerified:          true,
		PasswordResetToken:     &resetToken,
		PasswordResetExpiresAt: &expires,
	}
	if err := h.db.Create(&newUser).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear la cuenta"})
		return
	}
	h.db.Model(&member).Update("user_id", newUser.ID)

	frontendBaseURL := os.Getenv("FRONTEND_BASE_URL")
	if frontendBaseURL == "" {
		frontendBaseURL = "http://localhost:3000"
	}
	subject := "Te nombraron médico en DoctorData"
	body := fmt.Sprintf(
		"Hola,\n\nTe agregaron como médico en una cuenta de DoctorData. Para empezar, define tu "+
			"contraseña acá (vence en 1 hora):\n\n%s/forgot-password?token=%s\n\nDespués de "+
			"iniciar sesión, completa tu perfil médico (carné CMP) para que un administrador "+
			"valide tu colegiatura.",
		frontendBaseURL, resetToken,
	)
	if !email.IsConfigured() {
		log.Printf("[members] SMTP no configurado — invitación de médico para %s: %s", memberEmail, body)
	} else if err := email.Send(memberEmail, subject, body); err != nil {
		log.Printf("[members] fallo al enviar invitación de médico a %s: %v", memberEmail, err)
	}

	logAuditEvent(h.db, models.AuditDoctorNominated, userID, auditOpts{
		TargetUserID:            &newUser.ID,
		SubjectPatientProfileID: &member.ID,
	})

	c.JSON(http.StatusOK, gin.H{"message": "invitación enviada"})
}
