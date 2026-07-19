package handlers

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/email"
	"doctordata-backend-go/internal/middleware"
	"doctordata-backend-go/internal/models"
)

type AuthHandler struct {
	db *gorm.DB
}

func NewAuthHandler(db *gorm.DB) *AuthHandler {
	return &AuthHandler{db: db}
}

// ── Doble autenticación por correo ──────────────────────────────────────────────
//
// Un solo código de 6 dígitos cubre los dos flujos que pidió el dueño del producto:
//   1. Registro: el usuario queda con email_verified=false y SIN sesión hasta confirmar.
//   2. Login desde un dispositivo nunca antes visto para esa cuenta (ver TrustedDevice):
//      se le pide el mismo tipo de código antes de entregarle el token.
// POST /auth/verify-code resuelve ambos casos indistintamente.

// deviceHash identifica un dispositivo/red por IP + User-Agent — es solo una huella de
// comparación (no un dato sensible en sí), así que no necesita salt ni cifrado.
func deviceHash(c *gin.Context) string {
	raw := c.ClientIP() + "|" + c.GetHeader("User-Agent")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

// generateSixDigitCode usa crypto/rand (no math/rand) — mismo estándar de aleatoriedad que
// protege el resto de la autenticación.
func generateSixDigitCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

// issueVerificationCode borra cualquier código pendiente anterior del usuario (solo puede
// haber uno vigente a la vez) y crea uno nuevo, válido 15 minutos.
func issueVerificationCode(db *gorm.DB, userID uuid.UUID) (string, error) {
	code, err := generateSixDigitCode()
	if err != nil {
		return "", err
	}
	db.Where("user_id = ?", userID).Delete(&models.VerificationCode{})
	vc := models.VerificationCode{
		UserID:    userID,
		Code:      code,
		ExpiresAt: time.Now().Add(15 * time.Minute),
	}
	if err := db.Create(&vc).Error; err != nil {
		return "", err
	}
	return code, nil
}

// sendOrLogVerificationCode manda el código por correo si SMTP está configurado; si no lo
// está, o si el envío falla, lo deja solo en el log del servidor (nunca en la respuesta HTTP
// salvo DEBUG=true) — filtrar el código en la respuesta anularía el propósito del 2FA, sin
// importar si el motivo fue SMTP sin configurar o un fallo puntual de envío.
func sendOrLogVerificationCode(to, code string) (devCode string) {
	subject := "Tu código de verificación de DoctorData"
	body := fmt.Sprintf("Tu código de verificación es: %s\n\nVence en 15 minutos. Si no lo solicitaste, ignora este mensaje.", code)
	sent := false
	if email.IsConfigured() {
		if err := email.Send(to, subject, body); err != nil {
			log.Printf("[auth] fallo al enviar código de verificación a %s: %v", to, err)
		} else {
			sent = true
		}
	}
	if !sent {
		log.Printf("[auth] código de verificación para %s: %s", to, code)
	}
	if os.Getenv("DEBUG") == "true" {
		return code
	}
	return ""
}

// respondVerificationRequired genera y envía un código nuevo y responde sin emitir sesión
// todavía — el frontend debe mostrar la pantalla de "ingresa el código" y llamar a
// POST /auth/verify-code para completar el login o registro. reason es solo para que el
// frontend muestre el mensaje correcto ("verifica tu correo" vs "dispositivo nuevo"); el
// backend trata ambos casos exactamente igual.
func respondVerificationRequired(c *gin.Context, db *gorm.DB, user models.User, reason string) {
	code, err := issueVerificationCode(db, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate verification code"})
		return
	}
	devCode := sendOrLogVerificationCode(user.Email, code)
	resp := gin.H{
		"verification_required": true,
		"email":                 user.Email,
		"reason":                reason,
	}
	if devCode != "" {
		resp["dev_code"] = devCode
	}
	c.JSON(http.StatusOK, resp)
}

// POST /auth/register
func (h *AuthHandler) Register(c *gin.Context) {
	var req struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
		return
	}

	user := models.User{
		Email:         req.Email,
		PasswordHash:  string(hash),
		EmailVerified: false,
	}
	if err := h.db.Create(&user).Error; err != nil {
		c.JSON(http.StatusConflict, gin.H{"error": "email already registered"})
		return
	}
	logAuditEvent(h.db, models.AuditUserRegistered, user.ID, auditOpts{})

	// No se crea un PatientProfile automáticamente: el usuario debe comprar al menos
	// una suscripción activa antes de poder registrar datos personales (ver
	// middleware.RequireActiveSubscription). El frontend debe llevar al usuario al
	// selector de planes recién después de confirmar el código de verificación.

	respondVerificationRequired(c, h.db, user, "email_not_verified")
}

// POST /auth/login
func (h *AuthHandler) Login(c *gin.Context) {
	var req struct {
		Email    string `json:"email"    binding:"required,email"`
		Password string `json:"password" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	const wrongCredentialsMsg = "Usuario o contraseña incorrecta. Vuelve a intentar o verifica que esté bien escrito."

	var user models.User
	if err := h.db.Where("email = ? AND is_active = true", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": wrongCredentialsMsg})
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": wrongCredentialsMsg})
		return
	}

	// Correo todavía no verificado (p. ej. cerró la pestaña antes de terminar el registro):
	// se le vuelve a pedir el código acá, en vez de dejarlo entrar.
	if !user.EmailVerified {
		respondVerificationRequired(c, h.db, user, "email_not_verified")
		return
	}

	// Dispositivo/red nunca antes visto para esta cuenta ("entrada sospechosa"): pide
	// código antes de entregar la sesión. Una vez confirmado, ese dispositivo queda de
	// confianza (ver VerifyCode) y no se le vuelve a pedir desde ahí.
	devHash := deviceHash(c)
	var trusted models.TrustedDevice
	err := h.db.Where("user_id = ? AND device_hash = ?", user.ID, devHash).First(&trusted).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		respondVerificationRequired(c, h.db, user, "new_device")
		return
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}
	h.db.Model(&trusted).Update("last_used_at", time.Now())

	token, err := generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"token": token, "user": h.sanitizeUser(user)})
}

// POST /auth/verify-code — confirma el código de 6 dígitos que se generó desde Register o
// Login. Marca el correo como verificado (si no lo estaba), confía en el dispositivo desde
// el que se confirma, y entrega la sesión completa — misma forma de respuesta que Login.
func (h *AuthHandler) VerifyCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
		Code  string `json:"code"  binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "código inválido o vencido"})
		return
	}

	const maxVerifyAttempts = 5

	var vc models.VerificationCode
	if err := h.db.Where("user_id = ? AND expires_at > ?", user.ID, time.Now()).
		First(&vc).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "código inválido o vencido"})
		return
	}
	if vc.Attempts >= maxVerifyAttempts {
		h.db.Where("user_id = ?", user.ID).Delete(&models.VerificationCode{})
		c.JSON(http.StatusBadRequest, gin.H{"error": "código inválido o vencido"})
		return
	}
	if vc.Code != req.Code {
		h.db.Model(&vc).Update("attempts", vc.Attempts+1)
		c.JSON(http.StatusBadRequest, gin.H{"error": "código inválido o vencido"})
		return
	}
	// Un solo uso: se borra apenas se confirma, sin importar si de acá para abajo algo falla.
	h.db.Where("user_id = ?", user.ID).Delete(&models.VerificationCode{})

	if !user.EmailVerified {
		h.db.Model(&user).Update("email_verified", true)
		user.EmailVerified = true
	}

	devHash := deviceHash(c)
	var trusted models.TrustedDevice
	if err := h.db.Where("user_id = ? AND device_hash = ?", user.ID, devHash).First(&trusted).Error; errors.Is(err, gorm.ErrRecordNotFound) {
		h.db.Create(&models.TrustedDevice{UserID: user.ID, DeviceHash: devHash, LastUsedAt: time.Now()})
	} else if err == nil {
		h.db.Model(&trusted).Update("last_used_at", time.Now())
	}

	token, err := generateToken(user)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"token": token, "user": h.sanitizeUser(user)})
}

// POST /auth/resend-code — reenvía un código nuevo (invalida el anterior). No revela si el
// correo existe o no, igual que ForgotPassword.
func (h *AuthHandler) ResendCode(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "si el correo existe, se envió un nuevo código"})
		return
	}

	code, err := issueVerificationCode(h.db, user.ID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate verification code"})
		return
	}
	devCode := sendOrLogVerificationCode(user.Email, code)
	resp := gin.H{"message": "si el correo existe, se envió un nuevo código"}
	if devCode != "" {
		resp["dev_code"] = devCode
	}
	c.JSON(http.StatusOK, resp)
}

// GET /auth/me  — requiere JWTAuth
func (h *AuthHandler) Me(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var user models.User
	if err := h.db.
		Preload("PatientProfile").
		Preload("PractitionerProfile").
		First(&user, "id = ?", userID).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "user not found"})
		return
	}

	c.JSON(http.StatusOK, h.sanitizeUser(user))
}

// POST /auth/forgot-password
// Envía el token por correo. Solo se devuelve directo en la respuesta con DEBUG=true (QA) —
// antes se devolvía siempre, sin chequear nada más, lo que permitía tomar cualquier cuenta
// con solo conocer su email.
func (h *AuthHandler) ForgotPassword(c *gin.Context) {
	var req struct {
		Email string `json:"email" binding:"required,email"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.Where("email = ?", req.Email).First(&user).Error; err != nil {
		// No revelar si el email existe o no
		c.JSON(http.StatusOK, gin.H{"message": "if that email is registered you will receive a reset token"})
		return
	}

	tokenBytes := make([]byte, 32)
	rand.Read(tokenBytes)
	resetToken := hex.EncodeToString(tokenBytes)
	expires := time.Now().Add(1 * time.Hour)

	h.db.Model(&user).Updates(map[string]interface{}{
		"password_reset_token":      resetToken,
		"password_reset_expires_at": expires,
	})

	subject := "Restablece tu contraseña de DoctorData"
	body := fmt.Sprintf("Tu token para restablecer la contraseña es: %s\n\nVence en 1 hora. Si no lo solicitaste, ignora este mensaje.", resetToken)
	sent := false
	if email.IsConfigured() {
		if err := email.Send(user.Email, subject, body); err != nil {
			log.Printf("[auth] fallo al enviar token de restablecimiento a %s: %v", user.Email, err)
		} else {
			sent = true
		}
	}
	if !sent {
		log.Printf("[auth] token de restablecimiento para %s: %s", user.Email, resetToken)
	}

	resp := gin.H{"message": "if that email is registered you will receive a reset token"}
	if os.Getenv("DEBUG") == "true" {
		resp["reset_token"] = resetToken
	}
	c.JSON(http.StatusOK, resp)
}

// POST /auth/reset-password
func (h *AuthHandler) ResetPassword(c *gin.Context) {
	var req struct {
		Token    string `json:"token"    binding:"required"`
		Password string `json:"password" binding:"required,min=8"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var user models.User
	if err := h.db.
		Where("password_reset_token = ? AND password_reset_expires_at > ?", req.Token, time.Now()).
		First(&user).Error; err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid or expired reset token"})
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to process password"})
		return
	}

	h.db.Model(&user).Updates(map[string]interface{}{
		"password_hash":             string(hash),
		"password_reset_token":      nil,
		"password_reset_expires_at": nil,
	})

	c.JSON(http.StatusOK, gin.H{"message": "password reset successfully"})
}

// sanitizeUser devuelve el user sin campos sensibles y con la estructura limpia para JSON.
// has_active_subscription se calcula aquí para que el frontend (AuthContext) pueda decidir
// si debe llevar al usuario al flujo de compra sin una llamada adicional.
func (h *AuthHandler) sanitizeUser(u models.User) gin.H {
	var activeCount int64
	payerID := middleware.SubscriptionPayerID(h.db, u.ID)
	h.db.Model(&models.UserSubscription{}).
		Where("user_id = ? AND status = ? AND period_end > ?", payerID, models.SubscriptionActive, time.Now()).
		Count(&activeCount)

	return gin.H{
		"id":                      u.ID,
		"email":                   u.Email,
		"is_doctor":               u.IsDoctor,
		"is_admin":                u.IsAdmin,
		"is_super_admin":          u.IsSuperAdmin,
		"is_accounting":           u.IsAccounting,
		"is_sales":                u.IsSales,
		"is_active":               u.IsActive,
		"email_verified":          u.EmailVerified,
		"patient_profile":         u.PatientProfile,
		"practitioner_profile":    u.PractitionerProfile,
		"has_active_subscription": activeCount > 0,
		"created_at":              u.CreatedAt,
	}
}

func generateToken(user models.User) (string, error) {
	claims := middleware.Claims{
		UserID:       user.ID,
		IsDoctor:     user.IsDoctor,
		IsAdmin:      user.IsAdmin,
		IsSuperAdmin: user.IsSuperAdmin,
		IsAccounting: user.IsAccounting,
		IsSales:      user.IsSales,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString([]byte(os.Getenv("JWT_SECRET")))
}
