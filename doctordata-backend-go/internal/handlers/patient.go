package handlers

import (
	"errors"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	qrcode "github.com/skip2/go-qrcode"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

type PatientHandler struct {
	db *gorm.DB
}

func NewPatientHandler(db *gorm.DB) *PatientHandler {
	return &PatientHandler{db: db}
}

// GET /me/patient — perfil del paciente del usuario autenticado
func (h *PatientHandler) GetMyProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var profile models.PatientProfile
	if err := h.db.Where("user_id = ?", userID).First(&profile).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "no_profile"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

// PUT /me/patient — crea o actualiza el perfil del paciente (upsert)
func (h *PatientHandler) UpdateMyProfile(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		FirstName                    string            `json:"first_name"`
		LastName                     string            `json:"last_name"`
		BirthDate                    *string           `json:"birth_date"`
		Gender                       models.FHIRGender `json:"gender"`
		Phone                        string            `json:"phone"`
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
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var profile models.PatientProfile
	err := h.db.Where("user_id = ?", userID).First(&profile).Error

	if errors.Is(err, gorm.ErrRecordNotFound) {
		// Crear perfil nuevo. ManagedByUserID = UserID: el perfil propio del titular
		// cuenta contra su propia capacidad comprada (ver computeCapacity).
		profile.UserID = &userID
		profile.ManagedByUserID = &userID
		profile.FirstName = crypto.EncryptedString(req.FirstName)
		profile.LastName = crypto.EncryptedString(req.LastName)
		profile.Gender = crypto.EncryptedString(req.Gender)
		profile.Phone = crypto.EncryptedString(req.Phone)
		profile.DocumentType = crypto.EncryptedString(req.DocumentType)
		profile.DocumentNumber = crypto.EncryptedString(req.DocumentNumber)
		profile.AddressStreet = crypto.EncryptedString(req.AddressStreet)
		profile.AddressCity = crypto.EncryptedString(req.AddressCity)
		profile.AddressState = crypto.EncryptedString(req.AddressState)
		profile.AddressCountry = crypto.EncryptedString(req.AddressCountry)
		profile.AddressPostalCode = crypto.EncryptedString(req.AddressPostalCode)
		profile.BloodType = crypto.EncryptedString(req.BloodType)
		profile.HealthInsurance = crypto.EncryptedString(req.HealthInsurance)
		profile.IsSmoker = crypto.EncryptedBool(req.IsSmoker)
		profile.IsAlcoholConsumer = crypto.EncryptedBool(req.IsAlcoholConsumer)
		profile.HasPsychologicalConditions = crypto.EncryptedBool(req.HasPsychologicalConditions)
		profile.EmergencyContactName = crypto.EncryptedString(req.EmergencyContactName)
		profile.EmergencyContactPhone = crypto.EncryptedString(req.EmergencyContactPhone)
		profile.EmergencyContactRelationship = crypto.EncryptedString(req.EmergencyContactRelationship)

		if req.BirthDate != nil && *req.BirthDate != "" {
			if t, err := time.Parse("2006-01-02", *req.BirthDate); err == nil {
				profile.BirthDate = crypto.NewEncryptedTime(&t)
			}
		}

		if err := h.db.Create(&profile).Error; err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create profile"})
			return
		}
		logAuditEvent(h.db, models.AuditPatientAdded, userID, auditOpts{SubjectPatientProfileID: &profile.ID})
		c.JSON(http.StatusCreated, profile)
		return
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	// Actualizar perfil existente
	updates := map[string]interface{}{
		"first_name":                     crypto.EncryptedString(req.FirstName),
		"last_name":                      crypto.EncryptedString(req.LastName),
		"gender":                         crypto.EncryptedString(req.Gender),
		"phone":                          crypto.EncryptedString(req.Phone),
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
		if t, parseErr := time.Parse("2006-01-02", *req.BirthDate); parseErr == nil {
			updates["birth_date"] = crypto.NewEncryptedTime(&t)
		}
	}

	if err := h.db.Model(&profile).Updates(updates).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to update profile"})
		return
	}
	c.JSON(http.StatusOK, profile)
}

// POST /me/patient/upload/photo — sube foto de perfil del paciente
func (h *PatientHandler) UploadProfilePhoto(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)
	url, err := saveUpload(c, "photo", "patients", userID.String())
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	if err := h.db.Model(&models.PatientProfile{}).Where("user_id = ?", userID).
		Update("profile_photo_url", url).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al guardar la URL"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"url": url})
}

// isValidLifeStatus — "" (normal), "deceased" o "missing", nada más.
func isValidLifeStatus(s string) bool {
	return s == "" || s == "deceased" || s == "missing"
}

// PUT /me/patient/life-status — marca/desmarca al propio titular como fallecido o
// desaparecido. Endpoint aparte del resto del perfil a propósito (ver comentario en el
// modelo): es una acción puntual, no un campo más de un formulario.
func (h *PatientHandler) UpdateMyLifeStatus(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		Status string `json:"status"`
	}
	if err := c.ShouldBindJSON(&req); err != nil || !isValidLifeStatus(req.Status) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "status debe ser 'deceased', 'missing' o vacío"})
		return
	}

	res := h.db.Model(&models.PatientProfile{}).Where("user_id = ?", userID).
		Update("life_status", crypto.EncryptedString(req.Status))
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "no_profile"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "actualizado"})
}

// GET /me/qr — devuelve el código QR del paciente como imagen PNG. Sin ?patient_profile_id=
// genera el QR del propio titular; con él, el de una persona cubierta que administre (las
// personas cubiertas no tienen user_id/login propio, así que su QR apunta a
// /patient/profile/:id en vez de /patient/:userId — ver PatientPublicProfileByID).
func (h *PatientHandler) GetMyQR(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var profile models.PatientProfile
	if pid := c.Query("patient_profile_id"); pid != "" {
		targetID, err := uuid.Parse(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "patient_profile_id inválido"})
			return
		}
		if err := h.db.Select("id, user_id").Where("id = ? AND managed_by_user_id = ?", targetID, userID).First(&profile).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "no administras este perfil"})
			return
		}
	} else {
		if err := h.db.Select("id, user_id").Where("user_id = ?", userID).First(&profile).Error; err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "no_profile"})
			return
		}
	}

	// El header Origin del browser NO es confiable acá: en un request same-origin GET (el
	// caso real desde que el frontend y /api quedaron bajo el mismo dominio en QA/producción
	// — ver Caddyfile) los browsers simplemente no lo mandan, y esto caía siempre al
	// fallback de localhost:3000 — el QR quedaba apuntando a localhost aunque la página se
	// sirviera desde qa.mydoctordata.net. FRONTEND_BASE_URL es la misma variable que ya usa
	// internal/payments/factory.go para lo mismo (dónde vive el frontend de verdad).
	frontendOrigin := os.Getenv("FRONTEND_BASE_URL")
	if frontendOrigin == "" {
		frontendOrigin = "http://localhost:3000"
	}
	var qrURL string
	if profile.UserID != nil {
		qrURL = frontendOrigin + "/patient/" + profile.UserID.String()
	} else {
		qrURL = frontendOrigin + "/patient/profile/" + profile.ID.String()
	}

	png, err := qrcode.Encode(qrURL, qrcode.Medium, 256)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate QR"})
		return
	}

	c.Header("Content-Type", "image/png")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "image/png", png)
}

// GET /patients/:id — vista de un paciente filtrada por rol del solicitante
func (h *PatientHandler) GetPatientByID(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}

	isDoctor, _ := c.Get("is_doctor")
	isAdmin, _ := c.Get("is_admin")
	hasFullAccess := isDoctor.(bool) || isAdmin.(bool)

	var profile models.PatientProfile

	query := h.db
	if hasFullAccess {
		query = query.
			Preload("AllergyIntolerances").
			Preload("Conditions").
			Preload("Appointments").
			Preload("MedicalLeaves").
			Preload("ClinicalRecords")
	}

	if err := query.First(&profile, "id = ?", patientID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "patient not found"})
		return
	}

	if !hasFullAccess {
		c.JSON(http.StatusOK, gin.H{
			"id":                           profile.ID,
			"first_name":                   profile.FirstName,
			"last_name":                    profile.LastName,
			"gender":                       profile.Gender,
			"blood_type":                   profile.BloodType,
			"is_smoker":                    profile.IsSmoker,
			"is_alcohol_consumer":          profile.IsAlcoholConsumer,
			"has_psychological_conditions": profile.HasPsychologicalConditions,
		})
		return
	}

	c.JSON(http.StatusOK, profile)
}
