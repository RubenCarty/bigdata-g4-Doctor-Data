// Package email envía notificaciones por correo vía SMTP (net/smtp de la librería estándar —
// no se necesita ningún paquete externo). Pensado para el correo de GoDaddy Workspace Email
// que aloja contacto@mydoctordata.net: host smtpout.secureserver.net, puerto 587 con
// STARTTLS (smtp.SendMail ya negocia STARTTLS automáticamente si el servidor lo anuncia).
package email

import (
	"fmt"
	"net/smtp"
	"os"
)

// Config se lee de variables de entorno en cada llamada a Send — así, cambiar el .env y
// reiniciar el contenedor alcanza, sin tener que tocar código.
type Config struct {
	Host     string
	Port     string
	Username string
	Password string
	FromName string
	FromAddr string
}

func loadConfig() Config {
	fromAddr := os.Getenv("SMTP_FROM_ADDRESS")
	if fromAddr == "" {
		fromAddr = os.Getenv("SMTP_USERNAME")
	}
	return Config{
		Host:     getEnvDefault("SMTP_HOST", "smtpout.secureserver.net"),
		Port:     getEnvDefault("SMTP_PORT", "587"),
		Username: os.Getenv("SMTP_USERNAME"),
		Password: os.Getenv("SMTP_PASSWORD"),
		FromName: getEnvDefault("SMTP_FROM_NAME", "DoctorData"),
		FromAddr: fromAddr,
	}
}

func getEnvDefault(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}

// IsConfigured indica si hay credenciales SMTP cargadas — permite a los callers loguear un
// mensaje claro ("SMTP no configurado, se omite el envío") en vez de un error de conexión
// críptico cuando el pilot corre sin credenciales de correo todavía.
func IsConfigured() bool {
	cfg := loadConfig()
	return cfg.Username != "" && cfg.Password != ""
}

// Send envía un correo de texto plano. Siempre best-effort desde el caller (ver
// internal/handlers/partnership.go): un fallo de envío nunca debe bloquear la operación real
// que lo disparó (guardar la solicitud en la base de datos ya ocurrió antes de llamar esto).
func Send(to, subject, body string) error {
	cfg := loadConfig()
	if cfg.Username == "" || cfg.Password == "" {
		return fmt.Errorf("SMTP no configurado (faltan SMTP_USERNAME/SMTP_PASSWORD en el .env)")
	}

	auth := smtp.PlainAuth("", cfg.Username, cfg.Password, cfg.Host)
	msg := []byte(
		"From: " + cfg.FromName + " <" + cfg.FromAddr + ">\r\n" +
			"To: " + to + "\r\n" +
			"Subject: " + subject + "\r\n" +
			"MIME-Version: 1.0\r\n" +
			"Content-Type: text/plain; charset=UTF-8\r\n" +
			"\r\n" + body + "\r\n")

	addr := cfg.Host + ":" + cfg.Port
	return smtp.SendMail(addr, auth, cfg.FromAddr, []string{to}, msg)
}
