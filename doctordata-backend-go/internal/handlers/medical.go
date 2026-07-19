package handlers

import (
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

type MedicalHandler struct {
	db *gorm.DB
}

func NewMedicalHandler(db *gorm.DB) *MedicalHandler {
	return &MedicalHandler{db: db}
}

// GET /me/medical-profile
func (h *MedicalHandler) GetMyMedicalProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var profile models.PractitionerProfile
	if err := h.db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no_profile"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

// PUT /me/medical-profile — upsert con datos del carné CMP
func (h *MedicalHandler) UpdateMyMedicalProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		FirstName        string `json:"first_name"`
		LastName         string `json:"last_name"`
		CMPNumber        string `json:"cmp_number"`
		ExpeditionDate   string `json:"expedition_date"`   // YYYY-MM-DD
		RevalidationDate string `json:"revalidation_date"` // YYYY-MM-DD
		Specialty        string `json:"specialty"`
		Position         string `json:"position"`
		Institution      string `json:"institution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if strings.TrimSpace(req.FirstName) == "" || strings.TrimSpace(req.LastName) == "" || strings.TrimSpace(req.CMPNumber) == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "first_name, last_name y cmp_number son obligatorios"})
		return
	}

	updates := map[string]interface{}{
		"first_name":     crypto.EncryptedString(req.FirstName),
		"last_name":      crypto.EncryptedString(req.LastName),
		"cmp_number":     crypto.EncryptedString(req.CMPNumber),
		"license_number": crypto.EncryptedString(req.CMPNumber),
		"specialty":      req.Specialty,
		"position":       req.Position,
		"institution":    req.Institution,
	}

	if req.ExpeditionDate != "" {
		if t, err := time.Parse("2006-01-02", req.ExpeditionDate); err == nil {
			updates["expedition_date"] = crypto.NewEncryptedTime(&t)
		}
	}
	if req.RevalidationDate != "" {
		if t, err := time.Parse("2006-01-02", req.RevalidationDate); err == nil {
			updates["revalidation_date"] = crypto.NewEncryptedTime(&t)
		}
	}

	var existing models.PractitionerProfile
	err := h.db.Where("user_id = ?", userID).First(&existing).Error

	if err != nil {
		// No existe: crear con validation_status = pending
		t := parseDate(req.ExpeditionDate)
		rv := parseDate(req.RevalidationDate)
		profile := models.PractitionerProfile{
			UserID:           userID,
			FirstName:        crypto.EncryptedString(req.FirstName),
			LastName:         crypto.EncryptedString(req.LastName),
			CMPNumber:        crypto.EncryptedString(req.CMPNumber),
			LicenseNumber:    crypto.EncryptedString(req.CMPNumber),
			ExpeditionDate:   crypto.NewEncryptedTime(t),
			RevalidationDate: crypto.NewEncryptedTime(rv),
			Specialty:        req.Specialty,
			Position:         req.Position,
			Institution:      req.Institution,
			ValidationStatus: models.ValidationPending,
			IsActive:         false,
		}
		if err2 := h.db.Create(&profile).Error; err2 != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "error al crear el perfil médico"})
			return
		}
		c.JSON(http.StatusCreated, profile)
		return
	}

	// Existe y no está aprobado: se puede editar
	if existing.ValidationStatus == models.ValidationApproved {
		// Solo actualizar campos no críticos
		h.db.Model(&existing).Updates(map[string]interface{}{
			"specialty":   req.Specialty,
			"position":    req.Position,
			"institution": req.Institution,
		})
		c.JSON(http.StatusOK, gin.H{"message": "solo se actualizaron especialidad e institución (perfil ya validado)"})
		return
	}

	// Pending o rejected: actualizar todo y volver a pending
	updates["validation_status"] = models.ValidationPending
	h.db.Model(&existing).Updates(updates)
	c.JSON(http.StatusOK, gin.H{"message": "perfil actualizado — en espera de validación"})
}

// POST /me/medical-profile/upload/photo — sube foto personal
func (h *MedicalHandler) UploadProfilePhoto(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	url, err := saveUpload(c, "photo", "profiles", userID.String())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.PractitionerProfile{}).Where("user_id = ?", userID).
		Update("profile_photo_url", url)
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// POST /me/medical-profile/upload/card — sube foto del carné CMP
func (h *MedicalHandler) UploadCMPCard(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	url, err := saveUpload(c, "card", "cards", userID.String())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.PractitionerProfile{}).Where("user_id = ?", userID).
		Update("cmp_card_url", url)
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// ── Admin ────────────────────────────────────────────────────────────────────

type AdminMedicalHandler struct {
	db *gorm.DB
}

func NewAdminMedicalHandler(db *gorm.DB) *AdminMedicalHandler {
	return &AdminMedicalHandler{db: db}
}

// GET /admin/doctors — lista todos los profesionales con su email
func (h *AdminMedicalHandler) ListDoctors(c *gin.Context) {
	status := c.Query("status") // optional filter: pending, approved, rejected

	type DoctorView struct {
		models.PractitionerProfile
		Email string `json:"email"`
	}

	var profiles []models.PractitionerProfile
	q := h.db.Preload("User")
	if status != "" {
		q = q.Where("validation_status = ?", status)
	}
	q.Order("created_at desc").Find(&profiles)

	// Enrich with email
	result := make([]map[string]interface{}, 0, len(profiles))
	for _, p := range profiles {
		var user models.User
		h.db.Select("id, email, is_doctor, is_admin").Where("id = ?", p.UserID).First(&user)
		item := map[string]interface{}{
			"id":                p.ID,
			"user_id":           p.UserID,
			"email":             user.Email,
			"is_doctor":         user.IsDoctor,
			"first_name":        p.FirstName,
			"last_name":         p.LastName,
			"cmp_number":        p.CMPNumber,
			"expedition_date":   p.ExpeditionDate,
			"revalidation_date": p.RevalidationDate,
			"profile_photo_url": p.ProfilePhotoURL,
			"cmp_card_url":      p.CMPCardURL,
			"validation_status": p.ValidationStatus,
			"validation_notes":  p.ValidationNotes,
			"specialty":         p.Specialty,
			"position":          p.Position,
			"institution":       p.Institution,
			"created_at":        p.CreatedAt,
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

// PUT /admin/doctors/:id/validate — aprobar o rechazar
func (h *AdminMedicalHandler) ValidateDoctor(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		Action string `json:"action" binding:"required"` // approve | reject
		Notes  string `json:"notes"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile models.PractitionerProfile
	if err := h.db.First(&profile, "id = ?", id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "perfil no encontrado"})
		return
	}
	actorID := c.MustGet("user_id").(uuid.UUID)

	switch req.Action {
	case "approve":
		h.db.Model(&profile).Updates(map[string]interface{}{
			"validation_status": models.ValidationApproved,
			"validation_notes":  req.Notes,
			"is_active":         true,
		})
		// Activar is_doctor en el usuario
		h.db.Model(&models.User{}).Where("id = ?", profile.UserID).Update("is_doctor", true)
		logAuditEvent(h.db, models.AuditDoctorValidated, actorID, auditOpts{TargetUserID: &profile.UserID})
		c.JSON(http.StatusOK, gin.H{"message": "médico aprobado"})

	case "reject":
		h.db.Model(&profile).Updates(map[string]interface{}{
			"validation_status": models.ValidationRejected,
			"validation_notes":  req.Notes,
			"is_active":         false,
		})
		h.db.Model(&models.User{}).Where("id = ?", profile.UserID).Update("is_doctor", false)
		logAuditEvent(h.db, models.AuditDoctorRejected, actorID, auditOpts{TargetUserID: &profile.UserID})
		c.JSON(http.StatusOK, gin.H{"message": "médico rechazado"})

	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "action debe ser 'approve' o 'reject'"})
	}
}

// ── Legacy (mantener compatibilidad) ─────────────────────────────────────────

// POST /medical/activate — activación rápida legacy (sin fotos)
func (h *MedicalHandler) Activate(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		LicenseNumber string `json:"license_number" binding:"required"`
		Specialty     string `json:"specialty"`
		Institution   string `json:"institution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.db.Model(&models.User{}).Where("id = ?", userID).Update("is_doctor", true)

	profile := models.PractitionerProfile{
		UserID:           userID,
		LicenseNumber:    crypto.EncryptedString(req.LicenseNumber),
		CMPNumber:        crypto.EncryptedString(req.LicenseNumber),
		Specialty:        req.Specialty,
		Institution:      req.Institution,
		IsActive:         true,
		ValidationStatus: models.ValidationApproved,
	}
	h.db.Where(models.PractitionerProfile{UserID: userID}).
		Assign(models.PractitionerProfile{
			LicenseNumber:    crypto.EncryptedString(req.LicenseNumber),
			CMPNumber:        crypto.EncryptedString(req.LicenseNumber),
			IsActive:         true,
			ValidationStatus: models.ValidationApproved,
		}).
		FirstOrCreate(&profile)

	c.JSON(http.StatusOK, gin.H{"message": "medical profile activated", "profile": profile})
}

func (h *MedicalHandler) GetProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var profile models.PractitionerProfile
	if err := h.db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "medical profile not found"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

func (h *MedicalHandler) UpdateProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	var req struct {
		LicenseNumber string `json:"license_number"`
		Specialty     string `json:"specialty"`
		Institution   string `json:"institution"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.PractitionerProfile{}).Where("user_id = ?", userID).
		Updates(map[string]interface{}{
			"license_number": crypto.EncryptedString(req.LicenseNumber),
			"specialty":      req.Specialty,
			"institution":    req.Institution,
		})
	c.JSON(http.StatusOK, gin.H{"message": "profile updated"})
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func parseDate(s string) *time.Time {
	if s == "" {
		return nil
	}
	t, err := time.Parse("2006-01-02", s)
	if err != nil {
		return nil
	}
	return &t
}

const maxUploadSize = 20 << 20 // 20 MB entrada (se reduce a ≤1 MB al procesar)

func saveUpload(c *gin.Context, field, subdir, prefix string) (string, error) {
	c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxUploadSize)

	fh, err := c.FormFile(field)
	if err != nil {
		return "", fmt.Errorf("campo '%s' requerido", field)
	}

	// Aceptar cualquier formato de imagen
	mime := fh.Header.Get("Content-Type")
	if !isImageMIME(mime) {
		return "", fmt.Errorf("solo se permiten archivos de imagen")
	}

	src, err := fh.Open()
	if err != nil {
		return "", fmt.Errorf("error al abrir el archivo")
	}
	defer src.Close()

	// Redimensionar y comprimir a JPEG ≤1 MB
	data, err := toJPEG(src)
	if err != nil {
		return "", err
	}

	dir := filepath.Join("uploads", subdir)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return "", fmt.Errorf("error al crear directorio de uploads")
	}

	filename := fmt.Sprintf("%s_%d.jpg", prefix, time.Now().UnixNano())
	dst := filepath.Join(dir, filename)
	if err := os.WriteFile(dst, data, 0644); err != nil {
		return "", fmt.Errorf("error al guardar la imagen")
	}

	return "/uploads/" + subdir + "/" + filename, nil
}
