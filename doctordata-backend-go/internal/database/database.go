package database

import (
	"fmt"
	"log"
	"os"
	"time"

	_ "github.com/joho/godotenv/autoload"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

// New abre la conexión con PostgreSQL usando GORM.
// Prioriza DATABASE_URL; si no está definida, construye el DSN desde las variables individuales.
func New() (*gorm.DB, error) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		dsn = fmt.Sprintf(
			"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable",
			getEnvOrDefault("POSTGRES_HOST", "db"),
			getEnvOrDefault("POSTGRES_USER", "doctordata"),
			getEnvOrDefault("POSTGRES_PASSWORD", "doctordata123"),
			getEnvOrDefault("POSTGRES_DB", "doctordata"),
			getEnvOrDefault("POSTGRES_PORT", "5432"),
		)
	}

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: gormLogger(),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return db, nil
}

// gormLogger — con DEBUG=true (pensado para QA), GORM imprime cada consulta SQL completa a
// la salida estándar, útil para depurar; sin eso (por defecto, y siempre en producción), solo
// se registran errores reales de base de datos. Antes de esto, cada consulta (con sus
// parámetros) se imprimía siempre — nada aceptable para un auditor de un sistema con datos
// clínicos, aunque el contenido sensible en sí ya vaya cifrado (ver internal/crypto).
//
// IgnoreRecordNotFoundError=true importa tanto como el nivel: sin eso, cualquier lookup que
// legítimamente no encuentra nada (p. ej. "¿este dispositivo ya es de confianza?" en un login
// desde un dispositivo nuevo — el caso normal, no un error) se trata como error y GORM
// imprime el SQL completo con sus parámetros incluso en modo Error.
func gormLogger() logger.Interface {
	level := logger.Error
	if os.Getenv("DEBUG") == "true" {
		level = logger.Info
	}
	return logger.New(
		log.New(os.Stdout, "\r\n", log.LstdFlags),
		logger.Config{
			SlowThreshold:             200 * time.Millisecond,
			LogLevel:                  level,
			IgnoreRecordNotFoundError: true,
			Colorful:                  false,
		},
	)
}

func getEnvOrDefault(key, defaultValue string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return defaultValue
}
