package models

import (
	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// ValidationStatus — estado de validación del perfil del profesional de salud.
type ValidationStatus string

const (
	ValidationPending  ValidationStatus = "pending"
	ValidationApproved ValidationStatus = "approved"
	ValidationRejected ValidationStatus = "rejected"
)

// PractitionerProfile — profesional de salud (alineado con FHIR Practitioner).
// El flujo de activación requiere subir el carné CMP y esperar validación manual por admin.
// La identidad del carné CMP está cifrada en reposo; ValidationStatus queda en texto plano
// porque internal/handlers/medical.go (AdminMedicalHandler.ListDoctors) filtra por él.
type PractitionerProfile struct {
	BaseModel
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;uniqueIndex;not null"`

	// Datos del carné CMP — cifrados
	FirstName        crypto.EncryptedString `json:"first_name"                  gorm:"type:text;not null"`
	LastName         crypto.EncryptedString `json:"last_name"                   gorm:"type:text;not null"`
	CMPNumber        crypto.EncryptedString `json:"cmp_number"                  gorm:"type:text;not null"`
	ExpeditionDate   crypto.EncryptedTime   `json:"expedition_date,omitempty" gorm:"type:text"`
	RevalidationDate crypto.EncryptedTime   `json:"revalidation_date,omitempty" gorm:"type:text"`

	// Fotos
	ProfilePhotoURL string `json:"profile_photo_url,omitempty"` // foto personal
	CMPCardURL      string `json:"cmp_card_url,omitempty"`      // foto del carné CMP

	// Validación por admin
	ValidationStatus ValidationStatus `json:"validation_status" gorm:"type:varchar(20);default:'pending'"`
	ValidationNotes  string           `json:"validation_notes,omitempty"`

	// Campos adicionales de perfil médico
	Specialty   string `json:"specialty,omitempty"`
	Position    string `json:"position,omitempty"`    // Ej: Director de Geriatría, Médico Asistente
	Institution string `json:"institution,omitempty"`
	IsActive    bool   `json:"is_active" gorm:"default:true"`

	// Compatibilidad con campo legacy (LicenseNumber = CMPNumber) — cifrado también,
	// porque duplica el mismo valor sensible que CMPNumber.
	LicenseNumber crypto.EncryptedString `json:"license_number" gorm:"type:text"`

	User            User             `json:"-"                      gorm:"foreignKey:UserID"`
	Appointments    []Appointment    `json:"appointments,omitempty" gorm:"foreignKey:PractitionerProfileID"`
	MedicalLeaves   []MedicalLeave   `json:"medical_leaves,omitempty" gorm:"foreignKey:PractitionerProfileID"`
	ClinicalRecords []ClinicalRecord `json:"clinical_records,omitempty" gorm:"foreignKey:PractitionerProfileID"`
}
