// Package renewal — job diario que avisa por correo cuando una suscripción está por vencer.
// No existe ningún otro scheduler en la app todavía (ver database.Migrate/
// middleware.RequireActiveSubscription: "vigente" es puro cálculo por fecha en cada request,
// sin cron) — este es el primero, y a propósito usa solo un time.Ticker en una goroutine
// (mismo patrón de goroutine en background que ya usa cmd/api/main.go para el graceful
// shutdown), sin librería de cron nueva.
//
// La renovación en sí es 100% manual: Izipay confirmó que la afiliación no admite cargos
// recurrentes/MIT (merchant-initiated transactions) — no hay forma de cobrarle la tarjeta a
// alguien sin que vuelva a ingresarla. Por eso no existe ningún intento de cobro automático
// acá — solo el recordatorio, para todas las suscripciones por vencer, sin excepción.
package renewal

import (
	"fmt"
	"log"
	"time"

	"doctordata-backend-go/internal/email"
	"doctordata-backend-go/internal/models"

	"gorm.io/gorm"
)

// reminderWindowDays — con cuántos días de anticipación se avisa.
const reminderWindowDays = 5

// StartScheduler corre RunOnce una vez al arrancar y después cada 24h. Pensado para vivir en
// una goroutine (go renewal.StartScheduler(db) en cmd/api/main.go) — no bloquea.
func StartScheduler(db *gorm.DB) {
	RunOnce(db)
	ticker := time.NewTicker(24 * time.Hour)
	for range ticker.C {
		RunOnce(db)
	}
}

// RunOnce manda el recordatorio de renovación a quien tenga una suscripción vigente por
// vencer en los próximos reminderWindowDays. Separado de StartScheduler para poder llamarlo
// directo desde un test sin esperar el ticker.
func RunOnce(db *gorm.DB) {
	now := time.Now()
	windowEnd := now.AddDate(0, 0, reminderWindowDays)

	var subs []models.UserSubscription
	if err := db.Preload("Plan").
		Where("status = ? AND renewal_reminder_sent_at IS NULL AND period_end IS NOT NULL AND period_end BETWEEN ? AND ?",
			models.SubscriptionActive, now, windowEnd).
		Find(&subs).Error; err != nil {
		log.Printf("[renewal] error buscando suscripciones para recordatorio: %v", err)
		return
	}

	for _, sub := range subs {
		var user models.User
		if err := db.Select("id, email").Where("id = ?", sub.UserID).First(&user).Error; err != nil {
			continue
		}
		subject := "Tu suscripción de DoctorData vence pronto"
		body := fmt.Sprintf(
			"Hola,\n\nTu suscripción del plan %s vence el %s. Si quieres seguir teniendo acceso "+
				"a la información médica de las personas que cubre, renueva desde tu panel en "+
				"DoctorData antes de esa fecha.\n\nSi no renuevas, tus datos básicos seguirán "+
				"disponibles, pero perderás acceso a la información médica hasta que renueves.",
			sub.Plan.Name, sub.PeriodEnd.Format("02/01/2006"),
		)
		sendBestEffort(user.Email, subject, body)
		db.Model(&models.UserSubscription{}).Where("id = ?", sub.ID).Update("renewal_reminder_sent_at", time.Now())
	}
}

// sendBestEffort manda el correo si SMTP está configurado; si no, o si falla, solo lo deja en
// el log — mismo criterio "best effort" que el resto del sistema (ver internal/email,
// internal/handlers/partnership.go): un fallo de correo nunca debe tumbar el job.
func sendBestEffort(to, subject, body string) {
	if !email.IsConfigured() {
		log.Printf("[renewal] SMTP no configurado — correo para %s: %s", to, subject)
		return
	}
	if err := email.Send(to, subject, body); err != nil {
		log.Printf("[renewal] fallo al enviar correo a %s: %v", to, err)
	}
}
