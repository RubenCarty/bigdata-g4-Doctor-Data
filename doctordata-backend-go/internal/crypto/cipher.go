// Package crypto cifra en reposo los datos personales y de actividad médica del piloto
// (pacientes, alergias, condiciones, citas, descansos médicos, registros clínicos y el
// perfil del médico). Usa AES-256-GCM con un nonce aleatorio por valor — cada campo se
// cifra por separado, por lo que dos valores iguales producen ciphertext distinto.
//
// La clave maestra (ENCRYPTION_KEY) vive en el mismo entorno que el resto de secretos del
// piloto (JWT_SECRET, credenciales de DB) — protege contra exposición de la base de datos
// sola (backups, snapshots, un pg_dump filtrado), no contra un servidor de aplicación
// completamente comprometido. Cuando se migre a Azure, MustInit puede cambiar de dónde lee
// la clave (Azure Key Vault en vez de la variable de entorno) sin tocar el esquema de
// cifrado ni los tipos GORM que lo usan.
package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
)

var gcm cipher.AEAD

// MustInit valida ENCRYPTION_KEY y prepara el cifrador. Se llama una sola vez al arrancar
// el servidor (cmd/api/main.go), antes de database.Migrate — si la clave falta o es
// inválida, el servidor no debe arrancar (fail fast, igual que con JWT_SECRET).
func MustInit() {
	raw := os.Getenv("ENCRYPTION_KEY")
	if raw == "" {
		log.Fatal("ENCRYPTION_KEY no está definida — generar con: openssl rand -base64 32")
	}

	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil {
		log.Fatalf("ENCRYPTION_KEY inválida (no es base64 válido): %v", err)
	}
	if len(key) != 32 {
		log.Fatalf("ENCRYPTION_KEY debe decodificar a 32 bytes (AES-256), tiene %d", len(key))
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		log.Fatalf("error al inicializar AES: %v", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		log.Fatalf("error al inicializar GCM: %v", err)
	}
	gcm = aead
}

var errNotInitialized = errors.New("crypto: MustInit no fue llamado antes de cifrar/descifrar")

// encryptString cifra un texto plano y devuelve base64(nonce || ciphertext || tag).
func encryptString(plaintext string) (string, error) {
	if gcm == nil {
		return "", errNotInitialized
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return "", fmt.Errorf("crypto: error generando nonce: %w", err)
	}
	sealed := gcm.Seal(nonce, nonce, []byte(plaintext), nil)
	return base64.StdEncoding.EncodeToString(sealed), nil
}

// decryptString revierte encryptString. Devuelve error si la clave no coincide o el
// ciphertext fue alterado (falla la verificación del tag de GCM).
func decryptString(encoded string) (string, error) {
	if gcm == nil {
		return "", errNotInitialized
	}
	sealed, err := base64.StdEncoding.DecodeString(encoded)
	if err != nil {
		return "", fmt.Errorf("crypto: ciphertext no es base64 válido: %w", err)
	}
	nonceSize := gcm.NonceSize()
	if len(sealed) < nonceSize {
		return "", errors.New("crypto: ciphertext demasiado corto")
	}
	nonce, ciphertext := sealed[:nonceSize], sealed[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", fmt.Errorf("crypto: fallo al descifrar (clave incorrecta o dato alterado): %w", err)
	}
	return string(plaintext), nil
}
