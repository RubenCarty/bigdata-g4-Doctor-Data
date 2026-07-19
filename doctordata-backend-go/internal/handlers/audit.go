package handlers

import (
	"encoding/json"
	"log"

	"github.com/google/uuid"
	"gorm.io/gorm"

	"doctordata-backend-go/internal/models"
)

// auditOpts son los campos opcionales de un evento de auditoría — la mayoría de eventos
// solo necesitan actor + tipo, así que se pasan como struct para no forzar argumentos
// posicionales vacíos en cada llamada.
type auditOpts struct {
	TargetUserID            *uuid.UUID
	SubjectPatientProfileID *uuid.UUID
	Metadata                map[string]interface{}
}

// logAuditEvent registra un evento de negocio para el Audit Log del super admin. Es
// "best effort": un fallo al escribir el log NUNCA debe bloquear ni hacer fallar la
// operación real (registro, compra, etc.) — solo se deja constancia en el log del proceso.
func logAuditEvent(db *gorm.DB, eventType models.AuditEventType, actorUserID uuid.UUID, opts auditOpts) {
	var metadataJSON []byte
	if opts.Metadata != nil {
		metadataJSON, _ = json.Marshal(opts.Metadata)
	}

	entry := models.AuditLog{
		ActorUserID:             &actorUserID,
		EventType:               string(eventType),
		TargetUserID:            opts.TargetUserID,
		SubjectPatientProfileID: opts.SubjectPatientProfileID,
		Metadata:                string(metadataJSON),
	}
	if err := db.Create(&entry).Error; err != nil {
		log.Printf("[audit] failed to log %s: %v", eventType, err)
	}
}
