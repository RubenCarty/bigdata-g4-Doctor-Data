package models

import "time"

// BillingPeriod — periodicidad de cobro de un plan de suscripción.
type BillingPeriod string

const (
	BillingMonthly BillingPeriod = "monthly"
	BillingAnnual  BillingPeriod = "annual"
)

// SubscriptionPlan — producto de suscripción comprable (periodo x capacidad de personas
// cubiertas). Gestionado por administradores. Los precios se guardan en céntimos de Sol
// (PriceCents) para evitar errores de redondeo con punto flotante.
//
// PromoLabel + AvailableUntil modelan cualquier plan por tiempo limitado (ej. "Fundador",
// futuros "Cyber Days") de forma genérica: PromoLabel vacío = plan normal; no vacío = se
// agrupa en su propia fila en la tabla de precios. AvailableUntil nil = sin fecha límite;
// si se define, el plan deja de listarse en /public/plans automáticamente al pasar esa
// fecha, sin que un admin tenga que desactivarlo a mano.
//
// AllowsDiscounts controla si un DiscountCode puede reducir el precio de este plan
// específico — las ofertas por tiempo limitado (ej. "Fundador") ya son un precio rebajado
// de por sí y no admiten apilar códigos de descuento encima. Cuando un carrito de checkout
// mezcla planes con y sin este flag, el descuento solo se calcula sobre la porción
// elegible (ver computeSubtotals en internal/handlers/discount_lookup.go) — nunca sobre el
// total completo.
type SubscriptionPlan struct {
	BaseModel
	Name            string        `json:"name"             gorm:"not null"`
	Description     string        `json:"description,omitempty"`
	BillingPeriod   BillingPeriod `json:"billing_period"   gorm:"type:varchar(10);not null"`
	CoveredCapacity int           `json:"covered_capacity" gorm:"not null"`
	PriceCents      int64         `json:"price_cents"      gorm:"not null"`
	Currency        string        `json:"currency"         gorm:"type:varchar(3);not null;default:'PEN'"`
	// IsActive y AllowsDiscounts se dejan sin gorm:"default:..." a propósito: GORM omite del
	// INSERT cualquier campo que sea igual a su zero-value de Go cuando la columna tiene un
	// default de esquema — así, un admin pidiendo explícitamente is_active:false o
	// allows_discounts:false (zero-value, false) sería silenciosamente ignorado y la base
	// aplicaría su default (true) en su lugar. Como CreatePlan ya fija el valor por defecto
	// en Go (true) antes de crear, el default de esquema es redundante y solo introduce ese
	// riesgo — se confía únicamente en el default de aplicación.
	IsActive        bool       `json:"is_active"        gorm:"not null"`
	IsFeatured      bool       `json:"is_featured"      gorm:"default:false;not null"`
	AllowsDiscounts bool       `json:"allows_discounts" gorm:"not null"`
	SortOrder       int        `json:"sort_order"       gorm:"default:0"`
	PromoLabel      string     `json:"promo_label,omitempty" gorm:"type:varchar(40)"`
	AvailableUntil  *time.Time `json:"available_until,omitempty"`

	// RenewalPriceCents es lo que el cliente pagaría si vuelve a comprar este plan después de
	// que termine su periodo actual — para una oferta introductoria (ej. "Fundador") esto
	// normalmente es el precio del plan Normal equivalente, no el precio rebajado que pagó la
	// primera vez. nil significa "se renueva al mismo PriceCents" (comportamiento por defecto
	// para planes que no son de oferta).
	RenewalPriceCents *int64 `json:"renewal_price_cents,omitempty"`
}
