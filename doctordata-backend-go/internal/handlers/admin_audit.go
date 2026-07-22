package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// AdminAuditHandler — lectura del Audit Log, exclusiva para super admin
// (middleware.RequireSuperAdmin en routes.go, además de RequireAdmin del grupo /admin).
type AdminAuditHandler struct {
	db *gorm.DB
}

func NewAdminAuditHandler(db *gorm.DB) *AdminAuditHandler {
	return &AdminAuditHandler{db: db}
}

// GET /admin/audit-log
func (h *AdminAuditHandler) ListAuditLog(c *gin.Context) {
	var entries []models.AuditLog
	h.db.Order("created_at desc").Limit(200).Find(&entries)

	result := make([]gin.H, 0, len(entries))
	for _, e := range entries {
		result = append(result, gin.H{
			"id":          e.ID,
			"created_at":  e.CreatedAt,
			"event_type":  e.EventType,
			"description": h.renderDescription(e),
		})
	}
	c.JSON(http.StatusOK, result)
}

// renderDescription construye el texto legible del evento, descifrando nombres recién
// aquí (nunca se guardan en texto plano en audit_logs — ver models.AuditLog).
func (h *AdminAuditHandler) renderDescription(e models.AuditLog) string {
	actorName := h.resolveDisplayName(e.ActorUserID)

	var meta map[string]interface{}
	if e.Metadata != "" {
		_ = json.Unmarshal([]byte(e.Metadata), &meta)
	}

	switch models.AuditEventType(e.EventType) {
	case models.AuditUserRegistered:
		return fmt.Sprintf("%s se registró", actorName)

	case models.AuditSubscriptionPurchased:
		return fmt.Sprintf("%s compró %s", actorName, summarizePurchasedItems(meta))

	case models.AuditPatientAdded:
		if h.isOwnProfile(e.SubjectPatientProfileID, e.ActorUserID) {
			return fmt.Sprintf("%s completó su propio perfil de paciente", actorName)
		}
		return fmt.Sprintf("%s agregó a %s como paciente", actorName, h.resolvePatientName(e.SubjectPatientProfileID))

	case models.AuditDoctorValidated:
		return fmt.Sprintf("%s aprobó el perfil médico de %s", actorName, h.resolveDisplayName(e.TargetUserID))

	case models.AuditDoctorRejected:
		return fmt.Sprintf("%s rechazó el perfil médico de %s", actorName, h.resolveDisplayName(e.TargetUserID))

	case models.AuditDoctorNominated:
		return fmt.Sprintf("%s nombró médico a %s", actorName, h.resolvePatientName(e.SubjectPatientProfileID))

	case models.AuditRoleChanged:
		role, _ := meta["role"].(string)
		granted, _ := meta["granted"].(bool)
		verb := "otorgó"
		if !granted {
			verb = "quitó"
		}
		return fmt.Sprintf("%s %s el rol %s a %s", actorName, verb, role, h.resolveDisplayName(e.TargetUserID))

	case models.AuditDiscountCodeCreated:
		code, _ := meta["code"].(string)
		return fmt.Sprintf("%s creó el código de descuento %s", actorName, code)

	case models.AuditUserActiveChanged:
		active, _ := meta["active"].(bool)
		if active {
			return fmt.Sprintf("%s reactivó la cuenta de %s", actorName, h.resolveDisplayName(e.TargetUserID))
		}
		return fmt.Sprintf("%s desactivó la cuenta de %s", actorName, h.resolveDisplayName(e.TargetUserID))

	default:
		return fmt.Sprintf("%s: %s", actorName, e.EventType)
	}
}

// resolveDisplayName devuelve el nombre del paciente asociado a la cuenta (si ya lo
// completó) o el email como respaldo — nunca un identificador anónimo tipo "Usuario 1".
func (h *AdminAuditHandler) resolveDisplayName(userID *uuid.UUID) string {
	if userID == nil {
		return "—"
	}

	var user models.User
	if err := h.db.Select("id, email").First(&user, "id = ?", *userID).Error; err != nil {
		return "(usuario eliminado)"
	}

	var profile models.PatientProfile
	if err := h.db.Where("user_id = ?", *userID).First(&profile).Error; err == nil {
		name := strings.TrimSpace(string(profile.FirstName) + " " + string(profile.LastName))
		if name != "" {
			return name
		}
	}

	return user.Email
}

func (h *AdminAuditHandler) resolvePatientName(profileID *uuid.UUID) string {
	if profileID == nil {
		return "(paciente eliminado)"
	}
	var profile models.PatientProfile
	if err := h.db.First(&profile, "id = ?", *profileID).Error; err != nil {
		return "(paciente eliminado)"
	}
	name := strings.TrimSpace(string(profile.FirstName) + " " + string(profile.LastName))
	if name == "" {
		return "(sin nombre)"
	}
	return name
}

func (h *AdminAuditHandler) isOwnProfile(profileID *uuid.UUID, actorUserID *uuid.UUID) bool {
	if profileID == nil || actorUserID == nil {
		return false
	}
	var profile models.PatientProfile
	if err := h.db.Select("user_id").First(&profile, "id = ?", *profileID).Error; err != nil {
		return false
	}
	return profile.UserID != nil && *profile.UserID == *actorUserID
}

func summarizePurchasedItems(meta map[string]interface{}) string {
	items, _ := meta["items"].([]interface{})
	if len(items) == 0 {
		return "una suscripción"
	}
	parts := make([]string, 0, len(items))
	for _, raw := range items {
		item, ok := raw.(map[string]interface{})
		if !ok {
			continue
		}
		name, _ := item["plan_name"].(string)
		qty, _ := item["quantity"].(float64) // json.Unmarshal decodes numbers as float64
		parts = append(parts, fmt.Sprintf("%s x%d", name, int(qty)))
	}
	return strings.Join(parts, ", ")
}
