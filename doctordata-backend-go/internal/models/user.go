package models

import (
	"time"

	"doctordata-backend-go/internal/crypto"
)

// User es la entidad de autenticación y control de roles.
//
// is_doctor (v0.1.0): booleano simple para acceso a info clínica completa.
// is_admin: acceso administrativo al sistema (asignar manualmente en DB para el piloto).
// is_super_admin: superconjunto de is_admin; único rol habilitado para otorgar/quitar
// is_admin e is_super_admin a otros usuarios (ver AdminUsersHandler.UpdateUser).
// is_accounting: acceso solo a Boletas/Facturas (middleware.RequireAccounting), no al resto
// de /admin/*. is_sales: acceso solo a /admin/sellers/* (leaderboard de comisiones + sus
// propios códigos de descuento, middleware.RequireSales). A diferencia de is_admin/
// is_super_admin, ninguno de estos dos escala privilegios (son subconjuntos más chicos de lo
// que un admin ya ve), así que cualquier is_admin puede otorgarlos/quitarlos, sin requerir
// super-admin — ver AdminUsersHandler.UpdateUser.
// Versiones futuras agregarán verificación de colegiatura médica (CMP en Perú).
type User struct {
	BaseModel
	Email        string `json:"email"          gorm:"uniqueIndex;not null"`
	PasswordHash string `json:"-"              gorm:"not null"`
	IsDoctor     bool   `json:"is_doctor"      gorm:"default:false;not null"`
	IsAdmin      bool   `json:"is_admin"       gorm:"default:false;not null"`
	IsSuperAdmin bool   `json:"is_super_admin" gorm:"default:false;not null"`
	IsAccounting bool   `json:"is_accounting"  gorm:"default:false;not null"`
	IsSales      bool   `json:"is_sales"       gorm:"default:false;not null"`
	IsActive     bool   `json:"is_active"      gorm:"default:true;not null"`

	// EmailVerified — sin gorm:"default:true" a propósito, igual que IsActive/AllowsDiscounts
	// en SubscriptionPlan (ver ese comentario): Register fija explícitamente false para cuentas
	// nuevas, y con default:true en el esquema ese false (zero-value) se omitiría del INSERT y
	// la base aplicaría true en su lugar. Las cuentas ya existentes antes de este campo se
	// respaldan a true una sola vez en database.Migrate — ver ese archivo.
	EmailVerified bool `json:"email_verified" gorm:"not null;default:false"`

	// Campos para recuperación de contraseña (token de un uso, expira en 1 hora)
	PasswordResetToken     *string    `json:"-" gorm:"index"`
	PasswordResetExpiresAt *time.Time `json:"-"`

	// PaymentToken — identificador de tarjeta reusable de la pasarela (vads_identifier de
	// Izipay, capturado cuando el checkout registra el pago con vads_page_action=REGISTER_PAY
	// — ver internal/payments/izipay.go), que permite cobrar renovaciones automáticas sin
	// pedirle la tarjeta de nuevo. Es del User (el pagador), no de cada UserSubscription, ya
	// que una sola tarjeta cubre todas las suscripciones apiladas de una misma cuenta.
	PaymentToken crypto.EncryptedString `json:"-"`

	// Cuenta bancaria propia — para pagarle a vendedores/contabilidad/admins sus comisiones o
	// sueldo. json:"-" a propósito, igual que PaymentToken: son datos financieros sensibles
	// que NO deben aparecer si en algún momento se serializa un User completo por otro motivo
	// (ej. la relación PatientProfile.User) — solo se exponen a través de
	// BankAccountHandler.GetMyBankAccount, que arma su propia respuesta explícita.
	BankName          crypto.EncryptedString `json:"-"`
	BankAccountNumber crypto.EncryptedString `json:"-"`
	BankCCI           crypto.EncryptedString `json:"-"`

	PatientProfile         *PatientProfile      `json:"patient_profile,omitempty"`
	PractitionerProfile    *PractitionerProfile `json:"practitioner_profile,omitempty"`
	Subscriptions          []UserSubscription   `json:"subscriptions,omitempty"           gorm:"foreignKey:UserID"`
	ManagedPatientProfiles []PatientProfile     `json:"managed_patient_profiles,omitempty" gorm:"foreignKey:ManagedByUserID"`
}
