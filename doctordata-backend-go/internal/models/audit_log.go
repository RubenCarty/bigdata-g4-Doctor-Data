package models

import "github.com/google/uuid"

// AuditEventType — tipos de evento registrados en el Audit Log del super admin.
type AuditEventType string

const (
	AuditUserRegistered        AuditEventType = "user_registered"
	AuditSubscriptionPurchased AuditEventType = "subscription_purchased"
	AuditPatientAdded          AuditEventType = "patient_added"
	AuditDoctorValidated       AuditEventType = "doctor_validated"
	AuditDoctorRejected        AuditEventType = "doctor_rejected"
	AuditDoctorNominated       AuditEventType = "doctor_nominated"
	AuditRoleChanged           AuditEventType = "role_changed"
	AuditDiscountCodeCreated   AuditEventType = "discount_code_created"
	AuditUserActiveChanged     AuditEventType = "user_active_changed"
)

// AuditLog registra eventos de negocio para el panel de super admin (registro de usuarios,
// compras de suscripción, pacientes agregados, acciones administrativas). A propósito NO
// guarda texto plano con nombres ni datos sensibles — solo IDs y Metadata no-PII (nombre de
// plan, código de descuento, nombre de rol). El texto legible para mostrar se resuelve y
// descifra recién al leer (ver AdminAuditHandler en internal/handlers/admin_audit.go),
// igual que cualquier otro dato cifrado del sistema — así el propio log nunca se convierte
// en una segunda tabla con PII en texto plano.
type AuditLog struct {
	BaseModel
	ActorUserID             *uuid.UUID `json:"actor_user_id,omitempty" gorm:"type:uuid;index"`
	TargetUserID            *uuid.UUID `json:"target_user_id,omitempty" gorm:"type:uuid;index"`
	SubjectPatientProfileID *uuid.UUID `json:"subject_patient_profile_id,omitempty" gorm:"type:uuid;index"`
	EventType               string     `json:"event_type" gorm:"type:varchar(40);not null;index"`
	Metadata                string     `json:"-" gorm:"type:text"`
}
