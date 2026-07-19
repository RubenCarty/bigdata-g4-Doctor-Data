package handlers

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

type PublicHandler struct {
	db *gorm.DB
}

func NewPublicHandler(db *gorm.DB) *PublicHandler {
	return &PublicHandler{db: db}
}

// GET /public/patient/:userId — sin autenticación.
// Devuelve perfil básico + alergias del paciente identificado por su user UUID. Solo sirve
// para el titular de la cuenta (tiene user_id propio) — las personas cubiertas usan
// PatientPublicProfileByID en su lugar (ver GetMyQR, que decide cuál URL codificar).
// El médico que escanea el QR recibe también el patient_profile_id para llamar
// a los endpoints /patients/:id/* con su token de doctor.
func (h *PublicHandler) PatientPublicProfile(c *gin.Context) {
	userID, err := uuid.Parse(c.Param("userId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id de usuario inválido"})
		return
	}

	var profile models.PatientProfile
	if err := h.db.
		Preload("AllergyIntolerances").
		Preload("Conditions").
		Where("user_id = ?", userID).
		First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "perfil de paciente no encontrado"})
		return
	}

	c.JSON(http.StatusOK, publicProfileJSON(&profile))
}

// GET /public/patient-profile/:profileId — sin autenticación. Misma respuesta que
// PatientPublicProfile, pero buscando por patient_profile_id en vez de user_id — la única
// forma de llegar al perfil de una persona cubierta, que no tiene cuenta/login propio.
func (h *PublicHandler) PatientPublicProfileByID(c *gin.Context) {
	profileID, err := uuid.Parse(c.Param("profileId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id de perfil inválido"})
		return
	}

	var profile models.PatientProfile
	if err := h.db.
		Preload("AllergyIntolerances").
		Preload("Conditions").
		Where("id = ?", profileID).
		First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "perfil de paciente no encontrado"})
		return
	}

	c.JSON(http.StatusOK, publicProfileJSON(&profile))
}

func publicProfileJSON(profile *models.PatientProfile) gin.H {
	return gin.H{
		"patient_profile_id":           profile.ID,
		"first_name":                   profile.FirstName,
		"last_name":                    profile.LastName,
		"birth_date":                   profile.BirthDate,
		"gender":                       profile.Gender,
		"blood_type":                   profile.BloodType,
		"health_insurance":             profile.HealthInsurance,
		"is_smoker":                    profile.IsSmoker,
		"is_alcohol_consumer":          profile.IsAlcoholConsumer,
		"has_psychological_conditions": profile.HasPsychologicalConditions,
		"profile_photo_url":            profile.ProfilePhotoURL,
		"allergies":                    profile.AllergyIntolerances,
		// Condiciones de salud (diabetes, cardiopatías, etc.) también van sin autenticación
		// a propósito — es exactamente la información que un transeúnte necesita para
		// informar a emergencias (106) al escanear el QR, no solo las alergias.
		"conditions":                     profile.Conditions,
		"emergency_contact_name":         profile.EmergencyContactName,
		"emergency_contact_phone":        profile.EmergencyContactPhone,
		"emergency_contact_relationship": profile.EmergencyContactRelationship,
		// "" (normal) | "deceased" | "missing" — cambia por completo la vista del perfil
		// público, ver PatientProfile.jsx en el frontend.
		"life_status": profile.LifeStatus,
	}
}

// GET /public/stats — sin autenticación. Números de confianza para el index ("más de N
// usuarios", etc). Cada métrica solo se incluye en la respuesta si supera 10 — mostrar
// "3 usuarios" no genera confianza y expone el tamaño real (todavía pequeño) del piloto.
func (h *PublicHandler) GetStats(c *gin.Context) {
	var totalUsers, activeSubscriptions, approvedDoctors, coveredProfiles int64
	var allergies, conditions, appointments, medicalLeaves, clinicalRecords int64

	h.db.Model(&models.User{}).Count(&totalUsers)
	h.db.Model(&models.UserSubscription{}).
		Where("status = ? AND period_end > ?", models.SubscriptionActive, time.Now()).
		Count(&activeSubscriptions)
	h.db.Model(&models.PractitionerProfile{}).Where("validation_status = ?", models.ValidationApproved).Count(&approvedDoctors)
	h.db.Model(&models.PatientProfile{}).Count(&coveredProfiles)
	h.db.Model(&models.AllergyIntolerance{}).Count(&allergies)
	h.db.Model(&models.Condition{}).Count(&conditions)
	h.db.Model(&models.Appointment{}).Count(&appointments)
	h.db.Model(&models.MedicalLeave{}).Count(&medicalLeaves)
	h.db.Model(&models.ClinicalRecord{}).Count(&clinicalRecords)
	medicalRecordsShared := allergies + conditions + appointments + medicalLeaves + clinicalRecords

	stats := gin.H{}
	if totalUsers > 10 {
		stats["users"] = totalUsers
	}
	if activeSubscriptions > 10 {
		stats["active_subscriptions"] = activeSubscriptions
	}
	if approvedDoctors > 10 {
		stats["approved_doctors"] = approvedDoctors
	}
	if coveredProfiles > 10 {
		stats["covered_profiles"] = coveredProfiles
	}
	if medicalRecordsShared > 10 {
		stats["medical_records_shared"] = medicalRecordsShared
	}
	c.JSON(http.StatusOK, stats)
}
