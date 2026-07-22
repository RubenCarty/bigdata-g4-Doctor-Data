package models

import (
	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// AllergyType — FHIR AllergyIntolerance.type
type AllergyType string

const (
	AllergyTypeAllergy     AllergyType = "allergy"
	AllergyTypeIntolerance AllergyType = "intolerance"
)

// AllergyCategory — FHIR AllergyIntolerance.category
type AllergyCategory string

const (
	AllergyCategoryFood        AllergyCategory = "food"
	AllergyCategoryMedication  AllergyCategory = "medication"
	AllergyCategoryEnvironment AllergyCategory = "environment"
	AllergyCategoryBiologic    AllergyCategory = "biologic"
)

// AllergyCriticality — FHIR AllergyIntolerance.criticality
type AllergyCriticality string

const (
	CriticalityLow           AllergyCriticality = "low"
	CriticalityHigh          AllergyCriticality = "high"
	CriticalityUnableToAssess AllergyCriticality = "unable-to-assess"
)

// AllergyIntolerance — FHIR AllergyIntolerance.
// Visible para todos los roles autenticados (información rápida de seguridad del paciente).
// Contenido cifrado en reposo (crypto.Encrypted*) — PatientProfileID queda en texto plano
// porque se usa en WHERE.
type AllergyIntolerance struct {
	BaseModel
	PatientProfileID uuid.UUID `json:"patient_profile_id" gorm:"type:uuid;not null;index"`

	Type        crypto.EncryptedString `json:"type"        gorm:"type:text"`
	Category    crypto.EncryptedString `json:"category"    gorm:"type:text"`
	Criticality crypto.EncryptedString `json:"criticality" gorm:"type:text"`
	Substance   crypto.EncryptedString `json:"substance"   gorm:"type:text;not null"` // Qué desencadena la reacción
	Reaction    crypto.EncryptedString `json:"reaction,omitempty" gorm:"type:text"`   // Descripción de la reacción
	OnsetDate   crypto.EncryptedTime   `json:"onset_date,omitempty" gorm:"type:text"`
	Notes       crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	PatientProfile PatientProfile `json:"-" gorm:"foreignKey:PatientProfileID"`
}
