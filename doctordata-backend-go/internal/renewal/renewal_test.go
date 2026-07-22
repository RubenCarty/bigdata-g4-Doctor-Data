package renewal

import (
	"encoding/base64"
	"os"
	"testing"
	"time"

	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

// testDB conecta a la base local real (mismo patrón que
// internal/payments/izipay_redirect_test.go) — se omite el test si no está disponible en vez
// de fallar, para no bloquear un `go build`/`go vet` sin Docker levantado.
func testDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		dsn = "postgres://doctordata:doctordata123@localhost:5432/doctordata?sslmode=disable"
	}
	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("no se pudo conectar a la base de prueba (%v) — se omite este test", err)
	}

	key := make([]byte, 32)
	for i := range key {
		key[i] = byte(i)
	}
	old := os.Getenv("ENCRYPTION_KEY")
	os.Setenv("ENCRYPTION_KEY", base64.StdEncoding.EncodeToString(key))
	t.Cleanup(func() { os.Setenv("ENCRYPTION_KEY", old) })
	crypto.MustInit()

	return db
}

func seedUser(t *testing.T, db *gorm.DB) models.User {
	t.Helper()
	u := models.User{
		Email:         "renewal-test-" + uuid.NewString() + "@example.com",
		PasswordHash:  "x",
		IsActive:      true,
		EmailVerified: true,
	}
	if err := db.Create(&u).Error; err != nil {
		t.Fatalf("failed to seed user: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM users WHERE id = ?", u.ID) })
	return u
}

func seedPlan(t *testing.T, db *gorm.DB) models.SubscriptionPlan {
	t.Helper()
	p := models.SubscriptionPlan{
		Name:            "Test Plan",
		BillingPeriod:   models.BillingMonthly,
		CoveredCapacity: 1,
		PriceCents:      1990,
		Currency:        "PEN",
		IsActive:        true,
		AllowsDiscounts: false,
	}
	if err := db.Create(&p).Error; err != nil {
		t.Fatalf("failed to seed plan: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM subscription_plans WHERE id = ?", p.ID) })
	return p
}

func seedSubscription(t *testing.T, db *gorm.DB, user models.User, plan models.SubscriptionPlan, periodEnd time.Time) models.UserSubscription {
	t.Helper()
	s := models.UserSubscription{
		UserID:             user.ID,
		SubscriptionPlanID: plan.ID,
		Status:             models.SubscriptionActive,
		CoveredCapacity:    plan.CoveredCapacity,
		PriceCents:         plan.PriceCents,
		FinalPriceCents:    plan.PriceCents,
		PeriodStart:        ptrTime(periodEnd.AddDate(0, -1, 0)),
		PeriodEnd:          &periodEnd,
	}
	if err := db.Create(&s).Error; err != nil {
		t.Fatalf("failed to seed subscription: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM user_subscriptions WHERE id = ?", s.ID) })
	return s
}

func ptrTime(t time.Time) *time.Time { return &t }

// TestRunOnce_ManualReminder cubre el único camino que existe: toda suscripción vigente por
// vencer recibe el recordatorio (renovación es 100% manual, Izipay no admite cargos
// recurrentes) y queda marcada renewal_reminder_sent_at para no repetirse.
func TestRunOnce_ManualReminder(t *testing.T) {
	db := testDB(t)
	user := seedUser(t, db)
	plan := seedPlan(t, db)
	sub := seedSubscription(t, db, user, plan, time.Now().Add(48*time.Hour))

	RunOnce(db)

	var reloaded models.UserSubscription
	db.First(&reloaded, "id = ?", sub.ID)
	if reloaded.RenewalReminderSentAt == nil {
		t.Fatal("expected renewal_reminder_sent_at to be set after RunOnce")
	}
}

// TestRunOnce_OutsideWindow cubre que una suscripción que vence fuera de la ventana de
// recordatorio (reminderWindowDays) no se toca.
func TestRunOnce_OutsideWindow(t *testing.T) {
	db := testDB(t)
	user := seedUser(t, db)
	plan := seedPlan(t, db)
	sub := seedSubscription(t, db, user, plan, time.Now().Add(30*24*time.Hour))

	RunOnce(db)

	var reloaded models.UserSubscription
	db.First(&reloaded, "id = ?", sub.ID)
	if reloaded.RenewalReminderSentAt != nil {
		t.Fatal("expected renewal_reminder_sent_at to stay unset for a subscription outside the reminder window")
	}
}
