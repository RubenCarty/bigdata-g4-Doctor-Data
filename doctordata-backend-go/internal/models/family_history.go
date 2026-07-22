package models

import (
	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// FamilyHistory — antecedente médico de un familiar del paciente (FHIR FamilyMemberHistory,
// simplificado: solo relación + condición + notas, sin el modelado completo de FHIR). Mismo
// criterio de visibilidad que Condition — el titular/persona cubierta lo escribe (autoreportado,
// vía /me/family-history), pero solo se expone a otro médico que la está tratando por
// /patients/:id/family-history (RequireDoctor), nunca en el perfil público del QR.
type FamilyHistory struct {
	BaseModel
	PatientProfileID uuid.UUID `json:"patient_profile_id" gorm:"type:uuid;not null;index"`

	// Relationship — texto libre a propósito ("Abuela materna", "Tío primero", "Prima
	// segunda"...); Perú no tiene una lista cerrada de parentescos manejable acá, y FHIR
	// tampoco impone una — codeableConcept.text alcanza para este caso de uso.
	Relationship crypto.EncryptedString `json:"relationship" gorm:"type:text;not null"`
	Condition    crypto.EncryptedString `json:"condition"    gorm:"type:text;not null"`
	Notes        crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	PatientProfile PatientProfile `json:"-" gorm:"foreignKey:PatientProfileID"`
}
