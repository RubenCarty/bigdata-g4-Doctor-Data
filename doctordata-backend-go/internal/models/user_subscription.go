package models

import (
	"time"

	"github.com/google/uuid"
)

// SubscriptionStatus — estado del ciclo de vida de una suscripción comprada.
type SubscriptionStatus string

const (
	SubscriptionPendingPayment SubscriptionStatus = "pending_payment"
	SubscriptionActive         SubscriptionStatus = "active"
	SubscriptionFailed         SubscriptionStatus = "failed"
	SubscriptionExpired        SubscriptionStatus = "expired"
	SubscriptionCancelled      SubscriptionStatus = "cancelled"
)

// UserSubscription — una unidad de suscripción comprada por un usuario. Las suscripciones
// de un mismo usuario se "apilan": la capacidad total de personas cubiertas es la suma de
// CoveredCapacity de todas sus suscripciones con Status = active (ver
// middleware.RequireActiveSubscription y handlers.BillingHandler.GetMyCapacity).
//
// Los campos CoveredCapacity/PriceCents/FinalPriceCents son una copia (snapshot) de los
// valores del SubscriptionPlan al momento de la compra, para que cambios posteriores al
// plan no alteren retroactivamente lo que el usuario ya pagó.
type UserSubscription struct {
	BaseModel
	UserID             uuid.UUID          `json:"user_id"              gorm:"type:uuid;not null;index"`
	SubscriptionPlanID uuid.UUID          `json:"subscription_plan_id" gorm:"type:uuid;not null;index"`
	Status             SubscriptionStatus `json:"status"                gorm:"type:varchar(20);not null;default:'pending_payment';index"`

	CoveredCapacity     int        `json:"covered_capacity"      gorm:"not null"`
	PriceCents          int64      `json:"price_cents"           gorm:"not null"`
	DiscountCodeID      *uuid.UUID `json:"discount_code_id,omitempty" gorm:"type:uuid;index"`
	DiscountAmountCents int64      `json:"discount_amount_cents" gorm:"default:0;not null"`
	FinalPriceCents     int64      `json:"final_price_cents"     gorm:"not null"`

	PeriodStart *time.Time `json:"period_start,omitempty"`
	PeriodEnd   *time.Time `json:"period_end,omitempty"`

	// AutoRenew — si está marcada, internal/renewal la cobra sola el día que vence (usando
	// User.PaymentToken) en vez de solo mandar un recordatorio para renovar a mano. Segura
	// con default:false: coincide con el zero-value real que necesitamos, mismo patrón que
	// User.EmailVerified.
	AutoRenew bool `json:"auto_renew" gorm:"not null;default:false"`
	// RenewalReminderSentAt — cuándo se mandó el recordatorio de "vence pronto, renueva a
	// mano" (o "no pudimos renovar automáticamente"). Evita que el job diario lo repita.
	RenewalReminderSentAt *time.Time `json:"renewal_reminder_sent_at,omitempty"`
	// RenewedFromID — si esta fila nació de una renovación automática, apunta a la
	// UserSubscription que venció y la originó (trazabilidad para soporte: "¿por qué me
	// cobraron el 5?"). nil para una compra normal.
	RenewedFromID *uuid.UUID `json:"renewed_from_id,omitempty" gorm:"type:uuid;index"`

	// PaymentGatewayRef agrupa todas las UserSubscription creadas en una misma compra
	// (checkout) — la pasarela confirma el pago referenciando este valor en el webhook.
	PaymentGatewayRef string     `json:"payment_gateway_ref,omitempty" gorm:"index"`
	PaidAt            *time.Time `json:"paid_at,omitempty"`

	Plan         SubscriptionPlan `json:"plan"                    gorm:"foreignKey:SubscriptionPlanID"`
	DiscountCode *DiscountCode    `json:"discount_code,omitempty" gorm:"foreignKey:DiscountCodeID"`
}
