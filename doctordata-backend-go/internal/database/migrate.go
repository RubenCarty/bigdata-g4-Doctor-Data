package database

import (
	"fmt"

	"doctordata-backend-go/internal/models"
	"gorm.io/gorm"
)

// Migrate ejecuta AutoMigrate sobre todos los modelos.
// Crea tablas e índices si no existen; no elimina columnas ni tablas existentes.
// Se ejecuta al arrancar el servidor para que el schema esté siempre actualizado.
func Migrate(db *gorm.DB) error {
	// Detectado ANTES de AutoMigrate: si la columna todavía no existe, esta es la primera
	// vez que corre esta versión — todas las cuentas ya existentes se respaldan como
	// verificadas justo después (ver más abajo), para no bloquear a nadie que ya tenía
	// cuenta activa antes de que existiera la verificación por correo.
	hadEmailVerifiedColumn := db.Migrator().HasColumn(&models.User{}, "email_verified")

	err := db.AutoMigrate(
		&models.User{},
		&models.PatientProfile{},
		&models.PractitionerProfile{},
		&models.SubscriptionPlan{},
		&models.DiscountCode{},
		&models.UserSubscription{},
		&models.AllergyIntolerance{},
		&models.Condition{},
		&models.FamilyHistory{},
		&models.Appointment{},
		&models.MedicalLeave{},
		&models.ClinicalRecord{},
		&models.AuditLog{},
		&models.PartnershipRequest{},
		&models.VerificationCode{},
		&models.TrustedDevice{},
		&models.Boleta{},
		&models.Factura{},
	)
	if err != nil {
		return fmt.Errorf("auto migration failed: %w", err)
	}

	if !hadEmailVerifiedColumn {
		if err := db.Exec("UPDATE users SET email_verified = true").Error; err != nil {
			return fmt.Errorf("failed to grandfather existing users as email-verified: %w", err)
		}
	}

	return nil
}
