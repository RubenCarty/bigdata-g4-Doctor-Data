package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// BaseModel es embebido por todos los modelos.
// Genera UUID en Go antes de la inserción para que el ID esté disponible inmediatamente.
type BaseModel struct {
	ID        uuid.UUID      `json:"id"         gorm:"type:uuid;primaryKey"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-"          gorm:"index"`
}

func (b *BaseModel) BeforeCreate(tx *gorm.DB) error {
	if b.ID == uuid.Nil {
		b.ID = uuid.New()
	}
	return nil
}
