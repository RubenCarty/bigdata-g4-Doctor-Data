package models

import (
	"time"

	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// ObservationStatus — FHIR Observation.status
type ObservationStatus string

const (
	ObsRegistered  ObservationStatus = "registered"
	ObsPreliminary ObservationStatus = "preliminary"
	ObsFinal       ObservationStatus = "final"
	ObsAmended     ObservationStatus = "amended"
	ObsCorrected   ObservationStatus = "corrected"
	ObsCancelled   ObservationStatus = "cancelled"
)

// RecordType — categorías de observación clínica (FHIR Observation.category)
type RecordType string

const (
	RecordVitalSigns    RecordType = "vital-signs"
	RecordLaboratory    RecordType = "laboratory"
	RecordImaging       RecordType = "imaging"
	RecordProcedure     RecordType = "procedure"
	RecordMedication    RecordType = "medication"
	RecordNote          RecordType = "note"
	RecordSocialHistory RecordType = "social-history"
)

// ClinicalRecord — observación o registro clínico general (FHIR Observation).
// Cubre signos vitales, resultados de laboratorio, imágenes, notas y medicamentos.
// Solo visible para doctores (is_doctor=true). Contenido cifrado en reposo — el índice de
// loinc_code se retira (ya no aplica sobre texto cifrado; ningún handler filtra por este
// campo hoy). EffectiveDate queda en texto plano: se usa en Order("effective_date DESC")
// en internal/handlers/clinical.go.
type ClinicalRecord struct {
	BaseModel
	PatientProfileID      uuid.UUID  `json:"patient_profile_id"               gorm:"type:uuid;not null;index"`
	PractitionerProfileID *uuid.UUID `json:"practitioner_profile_id,omitempty" gorm:"type:uuid;index"`
	AppointmentID         *uuid.UUID `json:"appointment_id,omitempty"          gorm:"type:uuid;index"`

	// Codificación FHIR
	RecordType  crypto.EncryptedString `json:"record_type"          gorm:"type:text;not null"`
	LOINCCode   crypto.EncryptedString `json:"loinc_code,omitempty" gorm:"type:text"` // Ej: "85354-9" (presión arterial)
	DisplayName crypto.EncryptedString `json:"display_name"         gorm:"type:text;not null"`
	Status      crypto.EncryptedString `json:"status"               gorm:"type:text"`

	// Valor de la observación — usar el campo apropiado según el tipo
	ValueQuantity crypto.EncryptedFloat64 `json:"value_quantity,omitempty" gorm:"type:text"`
	ValueUnit     crypto.EncryptedString  `json:"value_unit,omitempty" gorm:"type:text"`   // Ej: "mmHg", "°C", "mg/dL"
	ValueString   crypto.EncryptedString  `json:"value_string,omitempty" gorm:"type:text"` // Para observaciones narrativas

	EffectiveDate time.Time              `json:"effective_date" gorm:"not null"`
	Notes         crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	PatientProfile      PatientProfile       `json:"-"                          gorm:"foreignKey:PatientProfileID"`
	PractitionerProfile *PractitionerProfile `json:"practitioner,omitempty"     gorm:"foreignKey:PractitionerProfileID"`
	Appointment         *Appointment         `json:"appointment,omitempty"      gorm:"foreignKey:AppointmentID"`
}
