package handlers

import (
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

// BankAccountHandler — cuenta bancaria propia (para pagarle comisión/sueldo a Ventas/
// Contabilidad/admins) y los datos bancarios de la empresa (para que un vendedor se los pase
// a un cliente de convenio B2B). Montado bajo middleware.RequireStaff() /
// middleware.RequireSales() según la ruta — ver internal/server/routes.go.
type BankAccountHandler struct {
	db *gorm.DB
}

func NewBankAccountHandler(db *gorm.DB) *BankAccountHandler {
	return &BankAccountHandler{db: db}
}

// GET /me/bank-account
func (h *BankAccountHandler) GetMyBankAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var user models.User
	if err := h.db.Select("bank_name, bank_account_number, bank_cci").Where("id = ?", userID).First(&user).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"bank_name":           user.BankName,
		"bank_account_number": user.BankAccountNumber,
		"bank_cci":            user.BankCCI,
	})
}

// PUT /me/bank-account
func (h *BankAccountHandler) UpdateMyBankAccount(c *gin.Context) {
	userID := c.MustGet("user_id").(uuid.UUID)

	var req struct {
		BankName          string `json:"bank_name"`
		BankAccountNumber string `json:"bank_account_number"`
		BankCCI           string `json:"bank_cci"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.db.Model(&models.User{}).Where("id = ?", userID).Updates(map[string]interface{}{
		"bank_name":           crypto.EncryptedString(req.BankName),
		"bank_account_number": crypto.EncryptedString(req.BankAccountNumber),
		"bank_cci":            crypto.EncryptedString(req.BankCCI),
	}).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "actualizado"})
}

// GET /admin/sellers/company-bank-info — datos bancarios de la empresa, para que un vendedor
// se los pase a un cliente de convenio B2B (ver la calculadora en AdminSellers.jsx). Vienen
// del .env, no de la base de datos — son fijos, los administra quien tiene acceso al
// servidor, no algo que se edite desde la UI.
func (h *BankAccountHandler) GetCompanyBankInfo(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"bank_name":    os.Getenv("BANK_NAME"),
		"account":      os.Getenv("BANK_CC"),
		"cci":          os.Getenv("BANK_CCI"),
		"ruc":          os.Getenv("BANK_RUC"),
		"account_user": os.Getenv("BANK_USER"),
	})
}
