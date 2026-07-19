package handlers

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/crypto"
	"doctordata-backend-go/internal/models"
)

// flexTimeLayouts cubre los formatos que realmente manda el frontend: RFC3339 (JS
// Date.toISOString()), <input type="datetime-local"> (sin segundos ni zona) y
// <input type="date"> (solo fecha). Appointment.StartTime/EndTime, MedicalLeave.IssueDate/
// StartDate/EndDate y ClinicalRecord.EffectiveDate son time.Time normal (no
// crypto.EncryptedTime) porque quedan en texto plano a propósito para poder ordenarse en
// SQL — así que time.Time.UnmarshalJSON de la librería estándar (RFC3339 estricto) los
// rechazaba siempre que el valor no viniera con segundos y zona horaria, es decir, casi
// siempre.
var flexTimeLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04",
	"2006-01-02",
}

func parseFlexTime(s string) (time.Time, error) {
	for _, layout := range flexTimeLayouts {
		if t, err := time.Parse(layout, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("formato de fecha no reconocido: %q", s)
}

type ClinicalHandler struct {
	db *gorm.DB
}

func NewClinicalHandler(db *gorm.DB) *ClinicalHandler {
	return &ClinicalHandler{db: db}
}

// ── Helpers ────────────────────────────────────────────────────────────────────

// getMyPatientProfileID se usa en escrituras: resuelve sobre qué PatientProfile debe operar
// el request. Con ?patient_profile_id=<uuid> en la query, opera sobre esa persona cubierta
// en vez del propio titular — pero solo si el usuario logueado es quien la administra
// (ManagedByUserID), para que un titular jamás pueda tocar datos de un perfil que no le
// pertenece. Sin el parámetro, usa su propio perfil (comportamiento de siempre).
func (h *ClinicalHandler) getMyPatientProfileID(c *gin.Context) (uuid.UUID, bool) {
	userID := c.MustGet("user_id").(uuid.UUID)
	if pid := c.Query("patient_profile_id"); pid != "" {
		targetID, err := uuid.Parse(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "patient_profile_id inválido"})
			return uuid.Nil, false
		}
		var profile models.PatientProfile
		if err := h.db.Select("id").Where("id = ? AND managed_by_user_id = ?", targetID, userID).First(&profile).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "no administras este perfil"})
			return uuid.Nil, false
		}
		return profile.ID, true
	}
	var profile models.PatientProfile
	if err := h.db.Select("id").Where("user_id = ?", userID).First(&profile).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "patient profile not found — complete registration first"})
		return uuid.Nil, false
	}
	return profile.ID, true
}

// findMyPatientProfileID se usa en lecturas: misma resolución que getMyPatientProfileID
// (propio perfil o, con ?patient_profile_id=, una persona cubierta que administre), pero
// si el propio perfil todavía no existe devuelve found=false sin escribir respuesta, para
// que el caller pueda devolver [] en lugar de 404.
func (h *ClinicalHandler) findMyPatientProfileID(c *gin.Context) (id uuid.UUID, found bool, responded bool) {
	userID := c.MustGet("user_id").(uuid.UUID)
	if pid := c.Query("patient_profile_id"); pid != "" {
		targetID, err := uuid.Parse(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "patient_profile_id inválido"})
			return uuid.Nil, false, true
		}
		var profile models.PatientProfile
		if err := h.db.Select("id").Where("id = ? AND managed_by_user_id = ?", targetID, userID).First(&profile).Error; err != nil {
			c.JSON(http.StatusForbidden, gin.H{"error": "no administras este perfil"})
			return uuid.Nil, false, true
		}
		return profile.ID, true, false
	}
	var profile models.PatientProfile
	err := h.db.Select("id").Where("user_id = ?", userID).First(&profile).Error
	if err == nil {
		return profile.ID, true, false
	}
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return uuid.Nil, false, false
	}
	c.JSON(http.StatusInternalServerError, gin.H{"error": "database error"})
	return uuid.Nil, false, true
}

func (h *ClinicalHandler) isOwnerOrDoctor(c *gin.Context, patientProfileID uuid.UUID) bool {
	userID := c.MustGet("user_id").(uuid.UUID)
	isDoctor, _ := c.Get("is_doctor")
	isAdmin, _ := c.Get("is_admin")
	if isDoctor.(bool) || isAdmin.(bool) {
		return true
	}
	var profile models.PatientProfile
	h.db.Select("id").Where("id = ? AND user_id = ?", patientProfileID, userID).First(&profile)
	return profile.ID != uuid.Nil
}

// ── Alergias — visibles para todos los roles autenticados ─────────────────────

// GET /me/allergies
func (h *ClinicalHandler) ListAllergies(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.AllergyIntolerance{})
		return
	}
	var allergies []models.AllergyIntolerance
	h.db.Where("patient_profile_id = ?", profileID).Find(&allergies)
	c.JSON(http.StatusOK, allergies)
}

// POST /me/allergies
func (h *ClinicalHandler) CreateAllergy(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req models.AllergyIntolerance
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.PatientProfileID = profileID
	if err := h.db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create allergy"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

// PUT /me/allergies/:id
func (h *ClinicalHandler) UpdateAllergy(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	allergyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req models.AllergyIntolerance
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	result := h.db.Model(&models.AllergyIntolerance{}).
		Where("id = ? AND patient_profile_id = ?", allergyID, profileID).
		Updates(req)
	if result.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "allergy not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DELETE /me/allergies/:id
func (h *ClinicalHandler) DeleteAllergy(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	allergyID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	h.db.Where("id = ? AND patient_profile_id = ?", allergyID, profileID).
		Delete(&models.AllergyIntolerance{})
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ── Condiciones — solo doctores o el propio paciente ──────────────────────────

// GET /me/conditions
func (h *ClinicalHandler) ListConditions(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.Condition{})
		return
	}
	var conditions []models.Condition
	h.db.Where("patient_profile_id = ?", profileID).Find(&conditions)
	c.JSON(http.StatusOK, conditions)
}

// POST /me/conditions
func (h *ClinicalHandler) CreateCondition(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req models.Condition
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.PatientProfileID = profileID
	if err := h.db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create condition"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

// PUT /me/conditions/:id
func (h *ClinicalHandler) UpdateCondition(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	condID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req models.Condition
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.Condition{}).
		Where("id = ? AND patient_profile_id = ?", condID, profileID).
		Updates(req)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DELETE /me/conditions/:id
func (h *ClinicalHandler) DeleteCondition(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	condID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	h.db.Where("id = ? AND patient_profile_id = ?", condID, profileID).
		Delete(&models.Condition{})
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ── Antecedentes familiares — solo doctores o el propio paciente ──────────────

// GET /me/family-history
func (h *ClinicalHandler) ListFamilyHistory(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.FamilyHistory{})
		return
	}
	var items []models.FamilyHistory
	h.db.Where("patient_profile_id = ?", profileID).Find(&items)
	c.JSON(http.StatusOK, items)
}

// POST /me/family-history
func (h *ClinicalHandler) CreateFamilyHistory(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req models.FamilyHistory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	req.PatientProfileID = profileID
	if err := h.db.Create(&req).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create family history"})
		return
	}
	c.JSON(http.StatusCreated, req)
}

// PUT /me/family-history/:id
func (h *ClinicalHandler) UpdateFamilyHistory(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req models.FamilyHistory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.FamilyHistory{}).
		Where("id = ? AND patient_profile_id = ?", itemID, profileID).
		Updates(req)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// DELETE /me/family-history/:id
func (h *ClinicalHandler) DeleteFamilyHistory(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	itemID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	h.db.Where("id = ? AND patient_profile_id = ?", itemID, profileID).
		Delete(&models.FamilyHistory{})
	c.JSON(http.StatusOK, gin.H{"message": "deleted"})
}

// ── Citas médicas ─────────────────────────────────────────────────────────────

// GET /me/appointments
func (h *ClinicalHandler) ListAppointments(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.Appointment{})
		return
	}
	var appointments []models.Appointment
	h.db.Preload("PractitionerProfile").
		Where("patient_profile_id = ?", profileID).
		Order("start_time DESC").
		Find(&appointments)
	c.JSON(http.StatusOK, appointments)
}

// appointmentRequest — DTO de entrada: start_time/end_time llegan como string (RFC3339,
// datetime-local o solo fecha) porque Appointment.StartTime/EndTime son time.Time normal
// (no crypto.EncryptedTime) y json.Unmarshal directo a time.Time solo acepta RFC3339 estricto.
type appointmentRequest struct {
	Status                string     `json:"status"`
	ServiceType           string     `json:"service_type"`
	Reason                string     `json:"reason"`
	StartTime             string     `json:"start_time"`
	EndTime               string     `json:"end_time"`
	Notes                 string     `json:"notes"`
	PractitionerProfileID *uuid.UUID `json:"practitioner_profile_id"`
	PractitionerName      string     `json:"practitioner_name"`
	PractitionerCMP       string     `json:"practitioner_cmp"`
	Institution           string     `json:"institution"`
}

func (r appointmentRequest) applyTo(m *models.Appointment) error {
	if r.StartTime != "" {
		st, err := parseFlexTime(r.StartTime)
		if err != nil {
			return fmt.Errorf("start_time: %w", err)
		}
		m.StartTime = st
	}
	if r.EndTime != "" {
		et, err := parseFlexTime(r.EndTime)
		if err != nil {
			return fmt.Errorf("end_time: %w", err)
		}
		m.EndTime = &et
	}
	m.Status = crypto.EncryptedString(r.Status)
	m.ServiceType = crypto.EncryptedString(r.ServiceType)
	m.Reason = crypto.EncryptedString(r.Reason)
	m.Notes = crypto.EncryptedString(r.Notes)
	m.PractitionerProfileID = r.PractitionerProfileID
	m.PractitionerName = crypto.EncryptedString(r.PractitionerName)
	m.PractitionerCMP = crypto.EncryptedString(r.PractitionerCMP)
	m.Institution = crypto.EncryptedString(r.Institution)
	return nil
}

// POST /me/appointments
func (h *ClinicalHandler) CreateAppointment(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req appointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var appt models.Appointment
	if err := req.applyTo(&appt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	appt.PatientProfileID = profileID
	if err := h.db.Create(&appt).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create appointment"})
		return
	}
	c.JSON(http.StatusCreated, appt)
}

// PUT /me/appointments/:id
func (h *ClinicalHandler) UpdateAppointment(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	apptID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req appointmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	var appt models.Appointment
	if err := req.applyTo(&appt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.Appointment{}).
		Where("id = ? AND patient_profile_id = ?", apptID, profileID).
		Updates(appt)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// ── Descansos médicos — escritura solo para doctores ──────────────────────────

// GET /me/medical-leaves
func (h *ClinicalHandler) ListMedicalLeaves(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.MedicalLeave{})
		return
	}
	var leaves []models.MedicalLeave
	h.db.Where("patient_profile_id = ?", profileID).
		Order("issue_date DESC").
		Find(&leaves)
	c.JSON(http.StatusOK, leaves)
}

// medicalLeaveRequest — mismo motivo que appointmentRequest: IssueDate/StartDate/EndDate son
// time.Time normal (texto plano, se ordenan en SQL) así que llegan como string, no como el
// RFC3339 estricto que exige time.Time.UnmarshalJSON. DaysCount ya no se recibe del cliente —
// se calcula siempre a partir de StartDate/EndDate (inclusive) para que nunca quede
// desincronizado del rango real.
type medicalLeaveRequest struct {
	DiagnosisCode    string `json:"diagnosis_code"`
	DiagnosisDisplay string `json:"diagnosis_display" binding:"required"`
	IssueDate        string `json:"issue_date" binding:"required"`
	StartDate        string `json:"start_date" binding:"required"`
	EndDate          string `json:"end_date" binding:"required"`
	Institution      string `json:"institution"`
	Notes            string `json:"notes"`
}

func (r medicalLeaveRequest) toModel() (models.MedicalLeave, error) {
	var m models.MedicalLeave
	issue, err := parseFlexTime(r.IssueDate)
	if err != nil {
		return m, fmt.Errorf("issue_date: %w", err)
	}
	start, err := parseFlexTime(r.StartDate)
	if err != nil {
		return m, fmt.Errorf("start_date: %w", err)
	}
	end, err := parseFlexTime(r.EndDate)
	if err != nil {
		return m, fmt.Errorf("end_date: %w", err)
	}
	m.DiagnosisCode = crypto.EncryptedString(r.DiagnosisCode)
	m.DiagnosisDisplay = crypto.EncryptedString(r.DiagnosisDisplay)
	m.IssueDate = issue
	m.StartDate = start
	m.EndDate = end
	m.DaysCount = crypto.EncryptedInt(int(end.Sub(start).Hours()/24) + 1)
	m.Institution = crypto.EncryptedString(r.Institution)
	m.Notes = crypto.EncryptedString(r.Notes)
	return m, nil
}

// POST /me/medical-leaves — el titular registra el descanso sobre su propio perfil de
// paciente (o el de una persona cubierta que administre). El médico que escanea el QR solo
// puede leer esta información (ver GetPatientMedicalLeaves), no escribirla — es el titular
// quien controla sus propios datos.
func (h *ClinicalHandler) CreateMedicalLeave(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req medicalLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	leave, err := req.toModel()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	leave.PatientProfileID = profileID
	if err := h.db.Create(&leave).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create medical leave"})
		return
	}
	c.JSON(http.StatusCreated, leave)
}

// PUT /me/medical-leaves/:id — el titular corrige su propio descanso (o el de una persona
// cubierta). El médico nunca escribe esto, solo lo lee (ver GetPatientMedicalLeaves).
func (h *ClinicalHandler) UpdateMedicalLeave(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	leaveID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req medicalLeaveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	leave, err := req.toModel()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	res := h.db.Model(&models.MedicalLeave{}).
		Where("id = ? AND patient_profile_id = ?", leaveID, profileID).
		Updates(leave)
	if res.RowsAffected == 0 {
		c.JSON(http.StatusNotFound, gin.H{"error": "medical leave not found"})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// ── Registros clínicos — lectura y escritura para el titular/personas cubiertas ──

// GET /me/clinical-records
func (h *ClinicalHandler) ListClinicalRecords(c *gin.Context) {
	profileID, found, responded := h.findMyPatientProfileID(c)
	if responded {
		return
	}
	if !found {
		c.JSON(http.StatusOK, []models.ClinicalRecord{})
		return
	}
	var records []models.ClinicalRecord
	h.db.Where("patient_profile_id = ?", profileID).
		Order("effective_date DESC").
		Find(&records)
	c.JSON(http.StatusOK, records)
}

// clinicalRecordRequest — mismo motivo que las otras DTO de este archivo: EffectiveDate es
// time.Time normal (texto plano) y llega como string, no RFC3339 estricto. ValueQuantity es
// crypto.EncryptedFloat64 pero <input type="number"> también lo manda como string — ya
// resuelto en EncryptedFloat64.UnmarshalJSON.
type clinicalRecordRequest struct {
	RecordType    string                  `json:"record_type" binding:"required"`
	LOINCCode     string                  `json:"loinc_code"`
	DisplayName   string                  `json:"display_name" binding:"required"`
	Status        string                  `json:"status"`
	ValueQuantity crypto.EncryptedFloat64 `json:"value_quantity"`
	ValueUnit     string                  `json:"value_unit"`
	ValueString   string                  `json:"value_string"`
	EffectiveDate string                  `json:"effective_date" binding:"required"`
	Notes         string                  `json:"notes"`
}

func (r clinicalRecordRequest) toModel() (models.ClinicalRecord, error) {
	var m models.ClinicalRecord
	eff, err := parseFlexTime(r.EffectiveDate)
	if err != nil {
		return m, fmt.Errorf("effective_date: %w", err)
	}
	m.RecordType = crypto.EncryptedString(r.RecordType)
	m.LOINCCode = crypto.EncryptedString(r.LOINCCode)
	m.DisplayName = crypto.EncryptedString(r.DisplayName)
	m.Status = crypto.EncryptedString(r.Status)
	m.ValueQuantity = r.ValueQuantity
	m.ValueUnit = crypto.EncryptedString(r.ValueUnit)
	m.ValueString = crypto.EncryptedString(r.ValueString)
	m.EffectiveDate = eff
	m.Notes = crypto.EncryptedString(r.Notes)
	return m, nil
}

// POST /me/clinical-records — sobre el propio perfil del titular o una persona cubierta que
// administre (?patient_profile_id=), mismo criterio que CreateMedicalLeave.
func (h *ClinicalHandler) CreateClinicalRecord(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	var req clinicalRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	record, err := req.toModel()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	record.PatientProfileID = profileID
	if err := h.db.Create(&record).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create clinical record"})
		return
	}
	c.JSON(http.StatusCreated, record)
}

// PUT /me/clinical-records/:id
func (h *ClinicalHandler) UpdateClinicalRecord(c *gin.Context) {
	profileID, ok := h.getMyPatientProfileID(c)
	if !ok {
		return
	}
	recID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}
	var req clinicalRecordRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	record, err := req.toModel()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.db.Model(&models.ClinicalRecord{}).
		Where("id = ? AND patient_profile_id = ?", recID, profileID).
		Updates(record)
	c.JSON(http.StatusOK, gin.H{"message": "updated"})
}

// ── Vista del paciente por otro doctor ────────────────────────────────────────

// GET /patients/:id/allergies  — visible para todos
func (h *ClinicalHandler) GetPatientAllergies(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var allergies []models.AllergyIntolerance
	h.db.Where("patient_profile_id = ?", patientID).Find(&allergies)
	c.JSON(http.StatusOK, allergies)
}

// GET /patients/:id/conditions  [RequireDoctor]
func (h *ClinicalHandler) GetPatientConditions(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var conditions []models.Condition
	h.db.Where("patient_profile_id = ?", patientID).Find(&conditions)
	c.JSON(http.StatusOK, conditions)
}

// GET /patients/:id/family-history  [RequireDoctor]
func (h *ClinicalHandler) GetPatientFamilyHistory(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var items []models.FamilyHistory
	h.db.Where("patient_profile_id = ?", patientID).Find(&items)
	c.JSON(http.StatusOK, items)
}

// GET /patients/:id/appointments  [RequireDoctor]
func (h *ClinicalHandler) GetPatientAppointments(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var appointments []models.Appointment
	h.db.Preload("PractitionerProfile").
		Where("patient_profile_id = ?", patientID).
		Order("start_time DESC").
		Find(&appointments)
	c.JSON(http.StatusOK, appointments)
}

// GET /patients/:id/medical-leaves  [RequireDoctor]
func (h *ClinicalHandler) GetPatientMedicalLeaves(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var leaves []models.MedicalLeave
	h.db.Where("patient_profile_id = ?", patientID).Order("issue_date DESC").Find(&leaves)
	c.JSON(http.StatusOK, leaves)
}

// GET /patients/:id/clinical-records  [RequireDoctor]
func (h *ClinicalHandler) GetPatientClinicalRecords(c *gin.Context) {
	patientID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid patient id"})
		return
	}
	var records []models.ClinicalRecord
	h.db.Where("patient_profile_id = ?", patientID).Order("effective_date DESC").Find(&records)
	c.JSON(http.StatusOK, records)
}
