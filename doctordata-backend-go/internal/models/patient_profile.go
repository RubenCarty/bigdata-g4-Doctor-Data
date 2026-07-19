package models

import (
	"github.com/google/uuid"

	"doctordata-backend-go/internal/crypto"
)

// FHIRGender — http://hl7.org/fhir/administrative-gender
type FHIRGender string

const (
	GenderMale    FHIRGender = "male"
	GenderFemale  FHIRGender = "female"
	GenderOther   FHIRGender = "other"
	GenderUnknown FHIRGender = "unknown"
)

// BloodType — grupos sanguíneos ABO + Rh
type BloodType string

const (
	BloodAPos  BloodType = "A+"
	BloodANeg  BloodType = "A-"
	BloodBPos  BloodType = "B+"
	BloodBNeg  BloodType = "B-"
	BloodABPos BloodType = "AB+"
	BloodABNeg BloodType = "AB-"
	BloodOPos  BloodType = "O+"
	BloodONeg  BloodType = "O-"
)

// PatientProfile — datos demográficos y clínicos del paciente (alineado con FHIR Patient).
//
// Visibilidad por rol:
//   - Cualquier usuario autenticado: campos básicos + información rápida
//     (blood_type, is_smoker, is_alcohol_consumer, has_psychological_conditions).
//   - Doctor (is_doctor=true): además AllergyIntolerances, Conditions,
//     ClinicalRecords, MedicalLeaves, Appointments con detalle completo.
//
// UserID es nullable: las personas cubiertas registradas por otro usuario no tienen cuenta
// propia. ManagedByUserID indica qué cuenta pagadora administra este perfil y contra cuya
// capacidad de suscripción cuenta; para el perfil propio del titular, UserID == ManagedByUserID.
//
// Los campos de datos personales/clínicos están cifrados en reposo (crypto.Encrypted*) —
// ver internal/crypto y la nota de arquitectura en CLAUDE.md. UserID/ManagedByUserID quedan
// en texto plano porque se usan en WHERE (control de acceso y cómputo de capacidad).
type PatientProfile struct {
	BaseModel
	UserID          *uuid.UUID `json:"user_id,omitempty"           gorm:"type:uuid;index"`
	ManagedByUserID *uuid.UUID `json:"managed_by_user_id,omitempty" gorm:"type:uuid;index"`

	// Datos básicos (FHIR Patient.name, .birthDate, .gender, .telecom) — cifrados
	FirstName crypto.EncryptedString `json:"first_name" gorm:"type:text;not null"`
	LastName  crypto.EncryptedString `json:"last_name"  gorm:"type:text;not null"`
	BirthDate crypto.EncryptedTime   `json:"birth_date,omitempty" gorm:"type:text"`
	Gender    crypto.EncryptedString `json:"gender"     gorm:"type:text"`
	Phone     crypto.EncryptedString `json:"phone,omitempty" gorm:"type:text"`
	// Email — solo tiene sentido para personas cubiertas (UserID == nil): sirve para poder
	// nominarlas médico después (ver MemberHandler.NominateDoctor), que les crea una cuenta
	// real y les envía el enlace para definir su contraseña. El titular ya tiene su propio
	// email en User, así que este campo queda vacío para su propio perfil.
	Email crypto.EncryptedString `json:"email,omitempty" gorm:"type:text"`

	// Identificadores (FHIR Patient.identifier) — cifrados
	DocumentType   crypto.EncryptedString `json:"document_type,omitempty"   gorm:"type:text"` // DNI, PASSPORT, CIP
	DocumentNumber crypto.EncryptedString `json:"document_number,omitempty" gorm:"type:text"`

	// Dirección (FHIR Patient.address simplificado) — cifrada
	AddressStreet     crypto.EncryptedString `json:"address_street,omitempty" gorm:"type:text"`
	AddressCity       crypto.EncryptedString `json:"address_city,omitempty" gorm:"type:text"`
	AddressState      crypto.EncryptedString `json:"address_state,omitempty" gorm:"type:text"`
	AddressCountry    crypto.EncryptedString `json:"address_country,omitempty" gorm:"type:text"`
	AddressPostalCode crypto.EncryptedString `json:"address_postal_code,omitempty" gorm:"type:text"`

	// Fotografía de perfil del paciente — NO cifrada (es una ruta de archivo, no un dato
	// clínico; el cifrado del archivo en sí, si se necesita, es un tema aparte de /uploads)
	ProfilePhotoURL string `json:"profile_photo_url,omitempty"`

	// Información rápida — visible para todos los roles autenticados, cifrada en reposo
	BloodType crypto.EncryptedString `json:"blood_type,omitempty" gorm:"type:text"`
	// HealthInsurance — EsSalud, SIS, Rimac, etc. (texto libre, mismo criterio que
	// DocumentType). Pedido por un paramédico: en emergencia, una ambulancia pierde tiempo
	// si no sabe a qué tipo de centro llevar al paciente (algunas clínicas tienen ambulancias
	// vinculadas a un seguro/convenio específico) — por eso va también en el perfil público
	// (QR) sin autenticación, igual que las alergias, ver publicProfileJSON.
	HealthInsurance            crypto.EncryptedString `json:"health_insurance,omitempty" gorm:"type:text"`
	IsSmoker                   crypto.EncryptedBool   `json:"is_smoker" gorm:"type:text"`
	IsAlcoholConsumer          crypto.EncryptedBool   `json:"is_alcohol_consumer" gorm:"type:text"`
	HasPsychologicalConditions crypto.EncryptedBool   `json:"has_psychological_conditions" gorm:"type:text"`

	// Contacto de emergencia — a quién llamar si el titular no puede responder. Se muestra en
	// el perfil público (QR) sin autenticación, igual que alergias/condiciones: es exactamente
	// la información que necesita un transeúnte o el 106 en una emergencia.
	EmergencyContactName         crypto.EncryptedString `json:"emergency_contact_name,omitempty"         gorm:"type:text"`
	EmergencyContactPhone        crypto.EncryptedString `json:"emergency_contact_phone,omitempty"        gorm:"type:text"`
	EmergencyContactRelationship crypto.EncryptedString `json:"emergency_contact_relationship,omitempty" gorm:"type:text"`

	// LifeStatus — "" (normal), "deceased" o "missing". Cambia por completo cómo se ve el
	// perfil público (QR): "deceased" muestra una página "En Memoria" sin datos clínicos de
	// gestión activa; "missing" resalta la info de contacto/identificación para ayudar a
	// ubicar a la persona, en vez de la vista normal de emergencia médica. Se administra con
	// un endpoint aparte (PUT .../life-status), no junto con el resto del perfil — es una
	// acción puntual y sensible, no un campo más de un formulario largo.
	LifeStatus crypto.EncryptedString `json:"life_status,omitempty" gorm:"type:text"`

	// Relaciones — expuestas según rol en la capa de API
	User                *User                `json:"user,omitempty"                gorm:"foreignKey:UserID"`
	ManagedByUser       *User                `json:"-"                             gorm:"foreignKey:ManagedByUserID"`
	AllergyIntolerances []AllergyIntolerance `json:"allergy_intolerances,omitempty" gorm:"foreignKey:PatientProfileID"`
	Conditions          []Condition          `json:"conditions,omitempty"           gorm:"foreignKey:PatientProfileID"`
	Appointments        []Appointment        `json:"appointments,omitempty"         gorm:"foreignKey:PatientProfileID"`
	MedicalLeaves       []MedicalLeave       `json:"medical_leaves,omitempty"       gorm:"foreignKey:PatientProfileID"`
	ClinicalRecords     []ClinicalRecord     `json:"clinical_records,omitempty"     gorm:"foreignKey:PatientProfileID"`
}
