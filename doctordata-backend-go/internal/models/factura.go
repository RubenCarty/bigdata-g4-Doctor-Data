package models

import "github.com/google/uuid"

// FacturaStatus — seguimiento manual de si la factura ya se envió/pagó. A diferencia de
// Boleta, una Factura nunca se crea sola: siempre la da de alta un admin/super admin a mano
// (ver internal/handlers/admin_sales.go), porque nace de una negociación de convenio
// (empresa, número de colaboradores, monto acordado), no de una compra automática.
type FacturaStatus string

const (
	FacturaPending FacturaStatus = "pending"
	FacturaSent    FacturaStatus = "sent"
	FacturaPaid    FacturaStatus = "paid"
)

// Factura — factura de convenio empresarial (ej. Samsung, Repsol) cargada a mano por un
// admin/super admin. Vive separada de Boleta a propósito: son montos grandes y poco
// frecuentes que romperían las estadísticas de venta de suscripciones si se mezclaran ahí
// (ver AdminSalesHandler.GetSalesStats, que solo agrega Boleta).
type Factura struct {
	BaseModel
	InvoiceNumber string `json:"invoice_number" gorm:"not null"`
	CompanyName   string `json:"company_name"   gorm:"not null"`
	// RUC — identificador tributario de la empresa del convenio; lo pide el contador para
	// llenar SUNAT y confirmar que la factura corresponde a la empresa correcta. Texto plano
	// a propósito (no crypto.EncryptedString): es dato de la empresa del convenio, no dato
	// clínico/personal de un paciente — mismo criterio ya usado en PartnershipRequest.
	RUC         string        `json:"ruc,omitempty" gorm:"type:varchar(11)"`
	AmountCents int64         `json:"amount_cents"   gorm:"not null"`
	Description string        `json:"description,omitempty"`
	Status      FacturaStatus `json:"status" gorm:"type:varchar(20);not null;default:'pending'"`

	// PartnershipRequestID es opcional: liga la factura a la solicitud de convenio que la
	// originó cuando existe, pero un admin puede cargar una factura de convenio negociado
	// fuera del formulario público también.
	PartnershipRequestID *uuid.UUID `json:"partnership_request_id,omitempty" gorm:"type:uuid;index"`
	CreatedByUserID      uuid.UUID  `json:"created_by_user_id" gorm:"type:uuid;not null"`

	PartnershipRequest *PartnershipRequest `json:"partnership_request,omitempty" gorm:"foreignKey:PartnershipRequestID"`
}
