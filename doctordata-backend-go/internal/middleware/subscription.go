package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// SubscriptionPayerID devuelve el user_id contra el que hay que chequear cobertura activa: el
// ManagedByUserID del PatientProfile propio del usuario si ya existe (caso de un médico
// nominado por otro titular — ver internal/handlers/members.go NominateDoctor, su perfil lo
// paga quien lo administra, no él mismo), o su propio ID si todavía no tiene perfil (mismo
// comportamiento de siempre para quien recién se registra y va camino a comprar).
func SubscriptionPayerID(db *gorm.DB, userID uuid.UUID) uuid.UUID {
	var profile models.PatientProfile
	if err := db.Select("managed_by_user_id").Where("user_id = ?", userID).First(&profile).Error; err == nil && profile.ManagedByUserID != nil {
		return *profile.ManagedByUserID
	}
	return userID
}

// RequireActiveSubscription bloquea el acceso a menos que quien paga la cobertura del usuario
// (ver SubscriptionPayerID) tenga al menos una suscripción paga con estado "active" y
// period_end todavía en el futuro. Se usa para impedir que un usuario escriba datos
// personales/médicos (propios o de personas cubiertas) antes de pagar, o después de que su
// suscripción venció sin renovar. No hay transición explícita a "expired" — basta con comparar
// period_end contra la hora actual en cada petición, sin job programado.
func RequireActiveSubscription(db *gorm.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.MustGet("user_id").(uuid.UUID)
		payerID := SubscriptionPayerID(db, userID)

		var count int64
		db.Model(&models.UserSubscription{}).
			Where("user_id = ? AND status = ? AND period_end > ?", payerID, models.SubscriptionActive, time.Now()).
			Count(&count)

		if count == 0 {
			c.AbortWithStatusJSON(http.StatusForbidden, gin.H{"error": "active_subscription_required"})
			return
		}
		c.Next()
	}
}
