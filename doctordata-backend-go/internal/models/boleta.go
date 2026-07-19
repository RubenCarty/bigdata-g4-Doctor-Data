package models

import (
	"time"

	"github.com/google/uuid"
)

// BoletaStatus — seguimiento de si la boleta ya fue emitida ante SUNAT por el contador
// (todavía manual vía el portal de SUNAT, ver internal/handlers/admin_sales.go) o sigue
// pendiente de envío.
type BoletaStatus string

const (
	BoletaPending BoletaStatus = "pending"
	BoletaSent    BoletaStatus = "sent"
)

// Boleta — un registro por cada UserSubscription que se paga. Se crea automáticamente
// cuando el webhook de la pasarela confirma el pago (ver
// BillingWebhookHandler.applyWebhookEvent); no es la boleta electrónica en sí (SUNAT no
// está integrado todavía) sino el registro interno de seguimiento: cuánto se vendió y si el
// contador ya la emitió manualmente por el portal de SUNAT o sigue pendiente.
type Boleta struct {
	BaseModel
	UserSubscriptionID uuid.UUID    `json:"user_subscription_id" gorm:"type:uuid;not null;index"`
	UserID             uuid.UUID    `json:"user_id"              gorm:"type:uuid;not null;index"`
	AmountCents        int64        `json:"amount_cents"         gorm:"not null"`
	Status             BoletaStatus `json:"status"                gorm:"type:varchar(20);not null;default:'pending';index"`
	// BoletaNumber lo llena un admin a mano con el número real que SUNAT asignó, recién
	// cuando el contador confirma que ya la emitió — no existe hasta ese momento.
	BoletaNumber *string    `json:"boleta_number,omitempty"`
	SentAt       *time.Time `json:"sent_at,omitempty"`

	UserSubscription UserSubscription `json:"user_subscription" gorm:"foreignKey:UserSubscriptionID"`
	User             User             `json:"user"              gorm:"foreignKey:UserID"`

	// PatientName/PatientDocumentNumber — transitorios (gorm:"-", no tocan el schema), los
	// arma ListBoletas descifrando User.PatientProfile para que el contador identifique al
	// comprador rápido sin tener que descifrar nada a mano. Vacíos si el comprador todavía no
	// llenó su perfil (compró pero no cargó datos personales — flujo válido).
	PatientName           string `json:"patient_name,omitempty"            gorm:"-"`
	PatientDocumentNumber string `json:"patient_document_number,omitempty" gorm:"-"`
}
