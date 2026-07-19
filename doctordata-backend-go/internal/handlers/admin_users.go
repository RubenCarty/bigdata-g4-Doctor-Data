package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

type AdminUsersHandler struct {
	db *gorm.DB
}

func NewAdminUsersHandler(db *gorm.DB) *AdminUsersHandler {
	return &AdminUsersHandler{db: db}
}

// GET /admin/users?search=&role=
func (h *AdminUsersHandler) ListUsers(c *gin.Context) {
	search := c.Query("search")
	role   := c.Query("role") // admin | doctor | patient

	var users []models.User
	q := h.db.Preload("PatientProfile").Preload("PractitionerProfile")

	if search != "" {
		q = q.Where("email ILIKE ?", "%"+search+"%")
	}
	switch role {
	case "admin":
		q = q.Where("is_admin = true")
	case "doctor":
		q = q.Where("is_doctor = true")
	case "patient":
		q = q.Where("is_doctor = false AND is_admin = false")
	}

	q.Order("created_at desc").Find(&users)

	result := make([]map[string]interface{}, 0, len(users))
	for _, u := range users {
		item := map[string]interface{}{
			"id":             u.ID,
			"email":          u.Email,
			"is_doctor":      u.IsDoctor,
			"is_admin":       u.IsAdmin,
			"is_super_admin": u.IsSuperAdmin,
			"is_accounting":  u.IsAccounting,
			"is_sales":       u.IsSales,
			"is_active":      u.IsActive,
			"created_at":     u.CreatedAt,
		}
		if u.PatientProfile != nil {
			name := strings.TrimSpace(string(u.PatientProfile.FirstName) + " " + string(u.PatientProfile.LastName))
			if name != "" {
				item["patient_name"] = name
			}
		}
		if u.PractitionerProfile != nil {
			item["doctor_status"] = string(u.PractitionerProfile.ValidationStatus)
			item["doctor_name"]   = u.PractitionerProfile.LastName + ", " + u.PractitionerProfile.FirstName
			item["cmp_number"]    = u.PractitionerProfile.CMPNumber
		}
		result = append(result, item)
	}

	c.JSON(http.StatusOK, result)
}

// PUT /admin/users/:id
//
// is_active, is_accounting e is_sales los puede modificar cualquier is_admin (ninguno de los
// dos escala privilegios, son subconjuntos más chicos de lo que un admin ya ve). Modificar
// is_admin o is_super_admin requiere que quien llama sea is_super_admin — si no lo es, se
// rechaza la solicitud completa (no se aplica ningún campo, ni siquiera is_active, para
// evitar peticiones mixtas que se aprovechen del fail-open parcial).
func (h *AdminUsersHandler) UpdateUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	var req struct {
		IsAdmin      *bool `json:"is_admin"`
		IsSuperAdmin *bool `json:"is_super_admin"`
		IsAccounting *bool `json:"is_accounting"`
		IsSales      *bool `json:"is_sales"`
		IsActive     *bool `json:"is_active"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.IsAdmin != nil || req.IsSuperAdmin != nil {
		callerIsSuperAdmin, _ := c.Get("is_super_admin")
		if callerIsSuperAdmin == nil || !callerIsSuperAdmin.(bool) {
			c.JSON(http.StatusForbidden, gin.H{"error": "solo un super admin puede otorgar o quitar is_admin / is_super_admin"})
			return
		}
	}

	updates := map[string]interface{}{}
	if req.IsAdmin != nil {
		updates["is_admin"] = *req.IsAdmin
	}
	if req.IsSuperAdmin != nil {
		updates["is_super_admin"] = *req.IsSuperAdmin
		// is_super_admin es superconjunto de is_admin: al otorgarlo, is_admin también se activa.
		if *req.IsSuperAdmin {
			updates["is_admin"] = true
		}
	}
	if req.IsAccounting != nil {
		updates["is_accounting"] = *req.IsAccounting
	}
	if req.IsSales != nil {
		updates["is_sales"] = *req.IsSales
	}
	if req.IsActive != nil {
		updates["is_active"] = *req.IsActive
	}

	if len(updates) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sin campos para actualizar"})
		return
	}

	res := h.db.Model(&models.User{}).Where("id = ?", id).Updates(updates)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al actualizar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuario no encontrado"})
		return
	}

	actorID := c.MustGet("user_id").(uuid.UUID)
	if req.IsAdmin != nil {
		logAuditEvent(h.db, models.AuditRoleChanged, actorID, auditOpts{
			TargetUserID: &id,
			Metadata:     map[string]interface{}{"role": "admin", "granted": *req.IsAdmin},
		})
	}
	if req.IsSuperAdmin != nil {
		logAuditEvent(h.db, models.AuditRoleChanged, actorID, auditOpts{
			TargetUserID: &id,
			Metadata:     map[string]interface{}{"role": "super_admin", "granted": *req.IsSuperAdmin},
		})
	}
	if req.IsAccounting != nil {
		logAuditEvent(h.db, models.AuditRoleChanged, actorID, auditOpts{
			TargetUserID: &id,
			Metadata:     map[string]interface{}{"role": "accounting", "granted": *req.IsAccounting},
		})
	}
	if req.IsSales != nil {
		logAuditEvent(h.db, models.AuditRoleChanged, actorID, auditOpts{
			TargetUserID: &id,
			Metadata:     map[string]interface{}{"role": "sales", "granted": *req.IsSales},
		})
	}
	if req.IsActive != nil {
		logAuditEvent(h.db, models.AuditUserActiveChanged, actorID, auditOpts{
			TargetUserID: &id,
			Metadata:     map[string]interface{}{"active": *req.IsActive},
		})
	}

	c.JSON(http.StatusOK, gin.H{"message": "usuario actualizado"})
}

// DELETE /admin/users/:id — soft delete
func (h *AdminUsersHandler) DeleteUser(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "id inválido"})
		return
	}

	currentUserID := c.MustGet("user_id").(uuid.UUID)
	if id == currentUserID {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no puedes eliminarte a ti mismo"})
		return
	}

	res := h.db.Delete(&models.User{}, "id = ?", id)
	if res.Error != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "error al eliminar"})
		return
	}
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "usuario no encontrado"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "usuario eliminado"})
}

// GET /admin/stats — métricas globales del sistema
func (h *AdminUsersHandler) GetStats(c *gin.Context) {
	var s struct {
		TotalUsers      int64 `json:"total_users"`
		TotalDoctors    int64 `json:"total_doctors"`
		ApprovedDoctors int64 `json:"approved_doctors"`
		PendingDoctors  int64 `json:"pending_doctors"`
		RejectedDoctors int64 `json:"rejected_doctors"`
		PatientProfiles int64 `json:"patient_profiles"`
		Allergies       int64 `json:"allergies"`
		Conditions      int64 `json:"conditions"`
		Appointments    int64 `json:"appointments"`
		MedicalLeaves   int64 `json:"medical_leaves"`
		ClinicalRecords int64 `json:"clinical_records"`
	}

	h.db.Model(&models.User{}).Count(&s.TotalUsers)
	h.db.Model(&models.User{}).Where("is_doctor = true").Count(&s.TotalDoctors)
	h.db.Model(&models.PractitionerProfile{}).Where("validation_status = ?", models.ValidationApproved).Count(&s.ApprovedDoctors)
	h.db.Model(&models.PractitionerProfile{}).Where("validation_status = ?", models.ValidationPending).Count(&s.PendingDoctors)
	h.db.Model(&models.PractitionerProfile{}).Where("validation_status = ?", models.ValidationRejected).Count(&s.RejectedDoctors)
	h.db.Model(&models.PatientProfile{}).Count(&s.PatientProfiles)
	h.db.Model(&models.AllergyIntolerance{}).Count(&s.Allergies)
	h.db.Model(&models.Condition{}).Count(&s.Conditions)
	h.db.Model(&models.Appointment{}).Count(&s.Appointments)
	h.db.Model(&models.MedicalLeave{}).Count(&s.MedicalLeaves)
	h.db.Model(&models.ClinicalRecord{}).Count(&s.ClinicalRecords)

	c.JSON(http.StatusOK, s)
}
