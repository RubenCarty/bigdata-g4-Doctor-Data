package database

import (
	"errors"
	"log"
	"os"

	"doctordata-backend-go/internal/models"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

// SeedSuperAdmin crea el superadmin inicial si las variables SA_USER y SA_PASS
// están definidas y todavía no existe ningún usuario con is_admin = true.
// Si ya existe un admin (aunque sea con otro email) no crea uno nuevo.
func SeedSuperAdmin(db *gorm.DB) {
	email := os.Getenv("SA_USER")
	pass := os.Getenv("SA_PASS")

	if email == "" || pass == "" {
		log.Println("[seed] SA_USER / SA_PASS no definidos, se omite la creación del superadmin")
		return
	}

	// ¿Ya existe algún superadmin?
	var count int64
	db.Model(&models.User{}).Where("is_super_admin = true").Count(&count)
	if count > 0 {
		log.Println("[seed] Ya existe un superadmin, no se crea uno nuevo")
		return
	}

	// ¿El email ya está registrado como usuario normal?
	var existing models.User
	err := db.Where("email = ?", email).First(&existing).Error
	if err == nil {
		// El usuario existe pero no es admin: lo promueve
		if err2 := db.Model(&existing).Updates(map[string]any{
			"is_admin":       true,
			"is_super_admin": true,
			"is_doctor":      true,
		}).Error; err2 != nil {
			log.Printf("[seed] Error al promover %s a superadmin: %v", email, err2)
			return
		}
		log.Printf("[seed] Usuario existente %s promovido a superadmin", email)
		return
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		log.Printf("[seed] Error al verificar el email %s: %v", email, err)
		return
	}

	// Crear usuario nuevo
	hash, err := bcrypt.GenerateFromPassword([]byte(pass), bcrypt.DefaultCost)
	if err != nil {
		log.Printf("[seed] Error al hashear la contraseña del superadmin: %v", err)
		return
	}

	admin := models.User{
		Email:         email,
		PasswordHash:  string(hash),
		IsAdmin:       true,
		IsSuperAdmin:  true,
		IsDoctor:      true,
		IsActive:      true,
		EmailVerified: true,
	}
	if err := db.Create(&admin).Error; err != nil {
		log.Printf("[seed] Error al crear el superadmin: %v", err)
		return
	}

	log.Printf("[seed] Superadmin creado: %s", email)
}
