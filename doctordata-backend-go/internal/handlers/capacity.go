package handlers

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// computeCapacity calcula la capacidad total comprada (suma de covered_capacity de las
// suscripciones activas Y vigentes — period_end en el futuro) y la capacidad usada
// (perfiles administrados por el usuario, incluido su propio perfil) para un usuario dado.
// No hay transición explícita a "expired": una suscripción deja de contar en cuanto pasa su
// period_end, evaluado en cada lectura — sin job programado.
func computeCapacity(db *gorm.DB, userID uuid.UUID) (total int, used int) {
	var totalCapacity int64
	db.Model(&models.UserSubscription{}).
		Where("user_id = ? AND status = ? AND period_end > ?", userID, models.SubscriptionActive, time.Now()).
		Select("COALESCE(SUM(covered_capacity), 0)").
		Scan(&totalCapacity)

	var usedCount int64
	db.Model(&models.PatientProfile{}).
		Where("managed_by_user_id = ?", userID).
		Count(&usedCount)

	return int(totalCapacity), int(usedCount)
}
