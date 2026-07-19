package models

import (
	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// ConditionClinicalStatus — FHIR Condition.clinicalStatus
type ConditionClinicalStatus string

const (
	ConditionActive     ConditionClinicalStatus = "active"
	ConditionRecurrence ConditionClinicalStatus = "recurrence"
	ConditionInactive   ConditionClinicalStatus = "inactive"
	ConditionRemission  ConditionClinicalStatus = "remission"
	ConditionResolved   ConditionClinicalStatus = "resolved"
)

// ConditionVerificationStatus — FHIR Condition.verificationStatus
type ConditionVerificationStatus string

const (
	VerificationUnconfirmed ConditionVerificationStatus = "unconfirmed"
	VerificationProvisional ConditionVerificationStatus = "provisional"
	VerificationConfirmed   ConditionVerificationStatus = "confirmed"
	VerificationRefuted     ConditionVerificationStatus = "refuted"
)

// Condition — enfermedad o condición crónica del paciente (FHIR Condition / ICD-10).
// Solo visible para doctores (is_doctor=true). Contenido cifrado en reposo — el índice de
// icd10_code se retira porque ya no aplica sobre texto cifrado (ningún handler filtra por
// este campo hoy).
type Condition struct {
	BaseModel
	PatientProfileID uuid.UUID `json:"patient_profile_id" gorm:"type:uuid;not null;index"`

	ICD10Code          crypto.EncryptedString `json:"icd10_code,omitempty" gorm:"type:text"` // Ej: "J45.0" (asma)
	DisplayName        crypto.EncryptedString `json:"display_name"         gorm:"type:text;not null"`
	ClinicalStatus     crypto.EncryptedString `json:"clinical_status"      gorm:"type:text"`
	VerificationStatus crypto.EncryptedString `json:"verification_status"  gorm:"type:text"`
	OnsetDate          crypto.EncryptedTime   `json:"onset_date,omitempty" gorm:"type:text"`
	AbatementDate      crypto.EncryptedTime   `json:"abatement_date,omitempty" gorm:"type:text"`
	Notes              crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	PatientProfile PatientProfile `json:"-" gorm:"foreignKey:PatientProfileID"`
}
