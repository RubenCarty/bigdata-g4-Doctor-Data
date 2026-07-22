package models

import (
	"time"

	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// AppointmentStatus — FHIR Appointment.status
type AppointmentStatus string

const (
	AppointmentProposed  AppointmentStatus = "proposed"
	AppointmentPending   AppointmentStatus = "pending"
	AppointmentBooked    AppointmentStatus = "booked"
	AppointmentArrived   AppointmentStatus = "arrived"
	AppointmentFulfilled AppointmentStatus = "fulfilled"
	AppointmentCancelled AppointmentStatus = "cancelled"
	AppointmentNoShow    AppointmentStatus = "noshow"
)

// Appointment — cita médica (FHIR Appointment).
// Visible para todos los roles; el detalle clínico (notas del doctor) solo para is_doctor=true.
// Contenido cifrado en reposo. StartTime/EndTime quedan en texto plano a propósito: se
// usan en Order("start_time DESC") en internal/handlers/clinical.go — cifrarlos dejaría la
// lista de citas en orden aleatorio.
type Appointment struct {
	BaseModel
	PatientProfileID      uuid.UUID  `json:"patient_profile_id"      gorm:"type:uuid;not null;index"`
	PractitionerProfileID *uuid.UUID `json:"practitioner_profile_id,omitempty" gorm:"type:uuid;index"`

	Status      crypto.EncryptedString `json:"status"              gorm:"type:text;not null"`
	ServiceType crypto.EncryptedString `json:"service_type,omitempty" gorm:"type:text"` // Consulta, emergencia, control, etc.
	Reason      crypto.EncryptedString `json:"reason,omitempty" gorm:"type:text"`
	StartTime   time.Time              `json:"start_time"          gorm:"not null"`
	EndTime     *time.Time             `json:"end_time,omitempty"`
	Notes       crypto.EncryptedString `json:"notes,omitempty" gorm:"type:text"`

	// Registro libre de quién atendió y dónde — no depende de que el médico tenga cuenta en
	// DoctorData (a diferencia de PractitionerProfileID); el titular lo llena de memoria para
	// poder hacer seguimiento, igual que Institution en MedicalLeave.
	PractitionerName crypto.EncryptedString `json:"practitioner_name,omitempty" gorm:"type:text"`
	PractitionerCMP  crypto.EncryptedString `json:"practitioner_cmp,omitempty"  gorm:"type:text"`
	Institution      crypto.EncryptedString `json:"institution,omitempty"       gorm:"type:text"`

	PatientProfile      PatientProfile       `json:"-"                          gorm:"foreignKey:PatientProfileID"`
	PractitionerProfile *PractitionerProfile `json:"practitioner,omitempty"     gorm:"foreignKey:PractitionerProfileID"`
}
