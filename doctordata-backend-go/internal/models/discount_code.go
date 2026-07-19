package models

import (
	"time"

	"github.com/google/uuid"
)

// DiscountType — tipo de descuento aplicado por un código.
type DiscountType string

const (
	DiscountFixed      DiscountType = "fixed"
	DiscountPercentage DiscountType = "percentage"
)

// DiscountCode — código de descuento fijo o porcentual, con vigencia por rango de fechas.
//
// Code NO tiene restricción unique a propósito: el mismo texto puede repetirse en varios
// registros con distintas ventanas de vigencia y distintas reglas (p.ej. "AUTONOMA26" fijo
// de S/10 vigente ene-jul y otro "AUTONOMA26" al 20% vigente en diciembre). La resolución
// al canjear un código se hace por (code, is_active, fecha actual dentro de [valid_from,
// valid_until]) — ver AdminBillingHandler / BillingPublicHandler.PreviewDiscount.
type DiscountCode struct {
	BaseModel
	Code           string       `json:"code"         gorm:"type:varchar(40);not null;index"`
	Type           DiscountType `json:"type"         gorm:"type:varchar(12);not null"`
	AmountCents    int64        `json:"amount_cents,omitempty"`
	PercentOff     int          `json:"percent_off,omitempty"`
	ValidFrom      time.Time    `json:"valid_from"    gorm:"not null"`
	ValidUntil     time.Time    `json:"valid_until"   gorm:"not null"`
	IsActive       bool         `json:"is_active"     gorm:"default:true;not null"`
	MaxRedemptions *int         `json:"max_redemptions,omitempty"`
	TimesRedeemed  int          `json:"times_redeemed" gorm:"default:0;not null"`

	// ReferringUserID permite rastrear referidos: el código pertenece/fue generado para
	// este usuario referente.
	ReferringUserID *uuid.UUID `json:"referring_user_id,omitempty" gorm:"type:uuid;index"`
	ReferringUser   *User      `json:"-" gorm:"foreignKey:ReferringUserID"`

	Notes string `json:"notes,omitempty"`
}
