package handlers

import (
	"errors"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// resolveActiveDiscountCode busca el DiscountCode vigente para el texto dado en el
// instante `at`. El mismo texto de código puede repetirse en varios registros con
// distintas ventanas de vigencia (ver models.DiscountCode) — se toma el más recientemente
// creado entre los que están activos y vigentes en la fecha indicada.
func resolveActiveDiscountCode(db *gorm.DB, code string, at time.Time) (*models.DiscountCode, error) {
	var dc models.DiscountCode
	err := db.
		Where("code = ? AND is_active = true AND valid_from <= ? AND valid_until >= ?", code, at, at).
		Order("created_at desc").
		First(&dc).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &dc, nil
}

// userAlreadyRedeemedCode indica si userID ya completó alguna vez una compra pagada
// (PaidAt != nil, confirmada por webhook — no un checkout abandonado) usando este código de
// descuento — un código de uso único por persona se agota con el primer canje real, sin
// importar si esa suscripción original sigue activa o ya venció.
func userAlreadyRedeemedCode(db *gorm.DB, userID uuid.UUID, discountCodeID uuid.UUID) bool {
	var count int64
	db.Model(&models.UserSubscription{}).
		Where("user_id = ? AND discount_code_id = ? AND paid_at IS NOT NULL", userID, discountCodeID).
		Count(&count)
	return count > 0
}

// planQty empareja un SubscriptionPlan cargado con la cantidad pedida de ese plan en un
// carrito — lo usa computeSubtotals para separar qué parte del carrito admite descuento.
type planQty struct {
	Plan     models.SubscriptionPlan
	Quantity int
}

// computeSubtotals separa el subtotal total del carrito del subtotal "elegible para
// descuento" (solo planes con AllowsDiscounts=true, ej. ofertas "Fundador" quedan fuera).
// Un DiscountCode nunca debe calcularse sobre totalCents directamente si el carrito mezcla
// planes elegibles y no elegibles — ver CreateCheckout y PreviewDiscount.
func computeSubtotals(items []planQty) (totalCents, eligibleCents int64) {
	for _, item := range items {
		amount := item.Plan.PriceCents * int64(item.Quantity)
		totalCents += amount
		if item.Plan.AllowsDiscounts {
			eligibleCents += amount
		}
	}
	return
}

// computeDiscountAmount calcula el descuento (en céntimos) que aplica un DiscountCode
// sobre un subtotal dado, respetando que un descuento fijo nunca deje el total en negativo.
func computeDiscountAmount(dc *models.DiscountCode, subtotalCents int64) int64 {
	switch dc.Type {
	case models.DiscountFixed:
		if dc.AmountCents > subtotalCents {
			return subtotalCents
		}
		return dc.AmountCents
	case models.DiscountPercentage:
		return subtotalCents * int64(dc.PercentOff) / 100
	default:
		return 0
	}
}
