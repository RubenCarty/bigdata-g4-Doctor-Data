package middleware

import (
	"encoding/base64"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

// testDB conecta a la base local real (mismo patrón que internal/renewal/renewal_test.go) —
// se omite el test si no está disponible, para no bloquear un `go build`/`go vet` sin Docker
// levantado.
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
		Email:        "sub-test-" + uuid.NewString() + "@example.com",
		PasswordHash: "x",
		IsActive:     true,
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

// router monta RequireActiveSubscription detrás de un middleware que simula lo que JWTAuth ya
// dejaría en el contexto (user_id) — no hace falta un JWT real para probar este middleware en
// particular.
func router(db *gorm.DB, userID uuid.UUID) *gin.Engine {
	gin.SetMode(gin.TestMode)
	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", userID)
		c.Next()
	})
	r.GET("/protected", RequireActiveSubscription(db), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"ok": true})
	})
	return r
}

func doGet(r *gin.Engine) int {
	req, _ := http.NewRequest(http.MethodGet, "/protected", nil)
	rr := httptest.NewRecorder()
	r.ServeHTTP(rr, req)
	return rr.Code
}

// TestRequireActiveSubscription_NoCoverage cubre el caso base: usuario sin perfil ni
// suscripción propia queda bloqueado.
func TestRequireActiveSubscription_NoCoverage(t *testing.T) {
	db := testDB(t)
	user := seedUser(t, db)

	code := doGet(router(db, user.ID))
	if code != http.StatusForbidden {
		t.Fatalf("expected 403 without coverage, got %d", code)
	}
}

// TestRequireActiveSubscription_OwnSubscription cubre el caso normal: el propio usuario
// compró una suscripción activa.
func TestRequireActiveSubscription_OwnSubscription(t *testing.T) {
	db := testDB(t)
	user := seedUser(t, db)
	plan := seedPlan(t, db)

	periodEnd := time.Now().Add(24 * time.Hour)
	sub := models.UserSubscription{
		UserID:             user.ID,
		SubscriptionPlanID: plan.ID,
		Status:             models.SubscriptionActive,
		CoveredCapacity:    1,
		PriceCents:         1990,
		FinalPriceCents:    1990,
		PeriodEnd:          &periodEnd,
	}
	if err := db.Create(&sub).Error; err != nil {
		t.Fatalf("failed to seed subscription: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM user_subscriptions WHERE id = ?", sub.ID) })

	code := doGet(router(db, user.ID))
	if code != http.StatusOK {
		t.Fatalf("expected 200 with an active own subscription, got %d", code)
	}
}

// TestRequireActiveSubscription_CoveredByPayer es el gap real que motivó este fix: un médico
// nominado (ver internal/handlers/members.go NominateDoctor) tiene su propia cuenta/login,
// pero nunca compró nada — su PatientProfile.ManagedByUserID apunta al titular que sí tiene
// una suscripción activa. Debe pasar igual.
func TestRequireActiveSubscription_CoveredByPayer(t *testing.T) {
	db := testDB(t)
	payer := seedUser(t, db)
	doctor := seedUser(t, db)
	plan := seedPlan(t, db)

	periodEnd := time.Now().Add(24 * time.Hour)
	sub := models.UserSubscription{
		UserID:             payer.ID,
		SubscriptionPlanID: plan.ID,
		Status:             models.SubscriptionActive,
		CoveredCapacity:    3,
		PriceCents:         1990,
		FinalPriceCents:    1990,
		PeriodEnd:          &periodEnd,
	}
	if err := db.Create(&sub).Error; err != nil {
		t.Fatalf("failed to seed subscription: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM user_subscriptions WHERE id = ?", sub.ID) })

	profile := models.PatientProfile{
		UserID:          &doctor.ID,
		ManagedByUserID: &payer.ID,
		FirstName:       crypto.EncryptedString("Doctor"),
		LastName:        crypto.EncryptedString("Nominado"),
	}
	if err := db.Create(&profile).Error; err != nil {
		t.Fatalf("failed to seed patient profile: %v", err)
	}
	t.Cleanup(func() { db.Exec("DELETE FROM patient_profiles WHERE id = ?", profile.ID) })

	code := doGet(router(db, doctor.ID))
	if code != http.StatusOK {
		t.Fatalf("expected 200 for a user covered by someone else's active subscription, got %d", code)
	}
}
