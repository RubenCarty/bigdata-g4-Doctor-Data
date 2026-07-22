package models

// PartnershipRequestStatus — estado de seguimiento de una solicitud de convenio.
type PartnershipRequestStatus string

const (
	PartnershipPending   PartnershipRequestStatus = "pending"
	PartnershipContacted PartnershipRequestStatus = "contacted"
	PartnershipClosed    PartnershipRequestStatus = "closed"
)

// PartnershipRequest — solicitud de convenio empresarial enviada desde el formulario público
// del index ("Alianzas y convenios"). No es información clínica de paciente, así que se
// guarda en texto plano — igual que User.Email o DiscountCode.Notes — no está sujeta al
// cifrado de internal/crypto (ese cubre datos personales/clínicos de pacientes y médicos).
// Un admin revisa las solicitudes y, si corresponde, crea manualmente un DiscountCode para
// la empresa vía /admin/discount-codes.
type PartnershipRequest struct {
	BaseModel
	CompanyName        string                   `json:"company_name"          gorm:"not null"`
	ContactName        string                   `json:"contact_name"          gorm:"not null"`
	Email              string                   `json:"email"                 gorm:"not null"`
	Phone              string                   `json:"phone,omitempty"`
	EstimatedEmployees int                      `json:"estimated_employees,omitempty"`
	Message            string                   `json:"message,omitempty"`
	Status             PartnershipRequestStatus `json:"status"                gorm:"type:varchar(20);not null"`
}
