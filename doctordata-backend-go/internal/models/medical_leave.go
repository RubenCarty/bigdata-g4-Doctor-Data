package models

import (
	"time"

	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// MedicalLeave — descanso médico emitido por un profesional de salud.
// No es un recurso FHIR estándar, pero es habitual en sistemas HIS de Latinoamérica.
// Se puede mapear a FHIR DocumentReference con type "11488-4" (LOINC: Consult note).
// Solo visible para doctores (is_doctor=true). Contenido cifrado en reposo. IssueDate,
// StartDate y EndDate quedan en texto plano: IssueDate se usa en
// Order("issue_date DESC") en internal/handlers/clinical.go; StartDate/EndDate se dejan
// junto a esa para mantener el rango de fechas consistente y disponible para lógica de
// negocio futura (ej. "descanso vigente hoy").
type MedicalLeave struct {
	BaseModel
	PatientProfileID      uuid.UUID  `json:"patient_profile_id"               gorm:"type:uuid;not null;index"`
	PractitionerProfileID *uuid.UUID `json:"practitioner_profile_id,omitempty" gorm:"type:uuid;index"`

	DiagnosisCode    crypto.EncryptedString `json:"diagnosis_code,omitempty" gorm:"type:text"` // ICD-10
	DiagnosisDisplay crypto.EncryptedString `json:"diagnosis_display"        gorm:"type:text;not null"`
	IssueDate        time.Time              `json:"issue_date"                gorm:"not null"`
	StartDate        time.Time              `json:"start_date"                gorm:"not null"`
	EndDate          time.Time              `json:"end_date"                  gorm:"not null"`
	DaysCount        crypto.EncryptedInt    `json:"days_count"                gorm:"type:text;not null"`
	Institution      crypto.EncryptedString `json:"institution,omitempty" gorm:"type:text"`
	Notes            crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	PatientProfile      PatientProfile       `json:"-"                      gorm:"foreignKey:PatientProfileID"`
	PractitionerProfile *PractitionerProfile `json:"practitioner,omitempty" gorm:"foreignKey:PractitionerProfileID"`
}
