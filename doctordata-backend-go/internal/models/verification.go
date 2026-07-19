package models

import (
	"time"

	"github.com/google/uuid"
)

// VerificationCode — código de 6 dígitos de un solo uso para el flujo de doble
// autenticación por correo. Se usa tanto para verificar el correo recién registrado como
// para aprobar un login desde un dispositivo nuevo (ver TrustedDevice) — un solo mecanismo
// para los dos diagramas que pidió el dueño del producto, distinguidos solo por si
// User.EmailVerified ya era true o no al momento de generarlo. No queda atado al
// dispositivo que lo disparó: se confirma desde donde el usuario tenga el código a mano, y
// el dispositivo que SÍ queda de confianza es el que llama a /auth/verify-code, no el que
// originó el pedido.
//
// Solo puede existir un código vigente por usuario a la vez: generar uno nuevo borra el
// anterior (ver issueVerificationCode en internal/handlers/auth.go).
type VerificationCode struct {
	BaseModel
	UserID   uuid.UUID `json:"-" gorm:"type:uuid;not null;index"`
	Code     string    `json:"-" gorm:"not null"`
	// Attempts — cuenta intentos fallidos contra ESTE código; al llegar a maxVerifyAttempts
	// (ver VerifyCode en internal/handlers/auth.go) se invalida, para no dejar los 6 dígitos
	// abiertos a fuerza bruta. Cero es el mismo valor que el default de la columna, así que
	// se omite del INSERT igual que EmailVerified — inofensivo acá porque el valor inicial
	// real (0) coincide con el default.
	Attempts  int       `json:"-" gorm:"not null;default:0"`
	ExpiresAt time.Time `json:"-" gorm:"not null"`
}

// TrustedDevice — huella (hash de IP + User-Agent) de un dispositivo desde el que un
// usuario ya completó la verificación por correo al menos una vez. Mientras el login venga
// de un DeviceHash ya presente acá para ese usuario, no se vuelve a pedir código.
type TrustedDevice struct {
	BaseModel
	UserID     uuid.UUID `json:"-" gorm:"type:uuid;not null;index"`
	DeviceHash string    `json:"-" gorm:"not null;index"`
	LastUsedAt time.Time `json:"last_used_at"`
}
