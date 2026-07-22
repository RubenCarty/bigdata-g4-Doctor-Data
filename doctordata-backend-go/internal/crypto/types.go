package crypto

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"strconv"
	"time"
)

// scanToString normaliza lo que devuelve el driver de SQL (string o []byte) antes de
// desencriptar. Un valor nil de columna se representa como puntero nil al llamador.
func scanToPlain(value interface{}) (*string, error) {
	if value == nil {
		return nil, nil
	}
	var encoded string
	switch v := value.(type) {
	case string:
		encoded = v
	case []byte:
		encoded = string(v)
	default:
		return nil, fmt.Errorf("crypto: tipo de columna inesperado %T", value)
	}
	plain, err := decryptString(encoded)
	if err != nil {
		return nil, err
	}
	return &plain, nil
}

// ── EncryptedString ─────────────────────────────────────────────────────────────────────

// EncryptedString es un string que se cifra al escribirse en la base de datos y se
// descifra al leerse — transparente tanto para GORM (Scan/Value) como para JSON
// (MarshalJSON/UnmarshalJSON), así que el resto del código lo trata como un string normal.
type EncryptedString string

func (e EncryptedString) Value() (driver.Value, error) {
	enc, err := encryptString(string(e))
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func (e *EncryptedString) Scan(value interface{}) error {
	plain, err := scanToPlain(value)
	if err != nil {
		return err
	}
	if plain == nil {
		*e = ""
		return nil
	}
	*e = EncryptedString(*plain)
	return nil
}

func (e EncryptedString) MarshalJSON() ([]byte, error) {
	return json.Marshal(string(e))
}

func (e *EncryptedString) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}
	*e = EncryptedString(s)
	return nil
}

// ── EncryptedBool ───────────────────────────────────────────────────────────────────────

// EncryptedBool es un bool cifrado — usado para banderas clínicas sensibles
// (fumador, consumo de alcohol, condición psicológica) que no se filtran en ningún WHERE.
type EncryptedBool bool

func (e EncryptedBool) Value() (driver.Value, error) {
	enc, err := encryptString(strconv.FormatBool(bool(e)))
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func (e *EncryptedBool) Scan(value interface{}) error {
	plain, err := scanToPlain(value)
	if err != nil {
		return err
	}
	if plain == nil {
		*e = false
		return nil
	}
	b, err := strconv.ParseBool(*plain)
	if err != nil {
		return fmt.Errorf("crypto: valor booleano inválido tras descifrar: %w", err)
	}
	*e = EncryptedBool(b)
	return nil
}

func (e EncryptedBool) MarshalJSON() ([]byte, error) {
	return json.Marshal(bool(e))
}

func (e *EncryptedBool) UnmarshalJSON(data []byte) error {
	var b bool
	if err := json.Unmarshal(data, &b); err != nil {
		return err
	}
	*e = EncryptedBool(b)
	return nil
}

// ── EncryptedTime ───────────────────────────────────────────────────────────────────────

// EncryptedTime es un time.Time cifrado y nullable (mismo patrón que sql.NullTime) — cubre
// los campos de fecha que son *time.Time hoy (fecha de nacimiento, fecha de inicio de una
// condición, fecha de expedición del carné CMP, etc.).
type EncryptedTime struct {
	Time  time.Time
	Valid bool
}

func NewEncryptedTime(t *time.Time) EncryptedTime {
	if t == nil {
		return EncryptedTime{}
	}
	return EncryptedTime{Time: *t, Valid: true}
}

func (e EncryptedTime) Value() (driver.Value, error) {
	if !e.Valid {
		return nil, nil
	}
	enc, err := encryptString(e.Time.Format(time.RFC3339Nano))
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func (e *EncryptedTime) Scan(value interface{}) error {
	plain, err := scanToPlain(value)
	if err != nil {
		return err
	}
	if plain == nil {
		*e = EncryptedTime{}
		return nil
	}
	t, err := time.Parse(time.RFC3339Nano, *plain)
	if err != nil {
		return fmt.Errorf("crypto: fecha inválida tras descifrar: %w", err)
	}
	*e = EncryptedTime{Time: t, Valid: true}
	return nil
}

func (e EncryptedTime) MarshalJSON() ([]byte, error) {
	if !e.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(e.Time)
}

// dateInputLayouts cubre los formatos que realmente llegan desde el frontend: RFC3339 (ej.
// Date.toISOString() de JS), <input type="datetime-local"> (sin segundos ni zona horaria) y
// <input type="date"> (solo fecha) — time.Time.UnmarshalJSON de la librería estándar solo
// acepta RFC3339 estricto, así que los otros dos formatos siempre fallaban con 400 aunque el
// valor fuera perfectamente válido.
var dateInputLayouts = []string{
	time.RFC3339Nano,
	time.RFC3339,
	"2006-01-02T15:04",
	"2006-01-02",
}

func (e *EncryptedTime) UnmarshalJSON(data []byte) error {
	// Los formularios del frontend mandan "" (no null) cuando un campo de fecha opcional
	// queda vacío — sin este caso, el parseo de abajo rechaza "" y toda la request falla con
	// 400, incluso si el resto de campos son válidos.
	s := string(data)
	if s == "null" || s == `""` {
		*e = EncryptedTime{}
		return nil
	}
	var raw string
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	for _, layout := range dateInputLayouts {
		if t, err := time.Parse(layout, raw); err == nil {
			*e = EncryptedTime{Time: t, Valid: true}
			return nil
		}
	}
	return fmt.Errorf("crypto: formato de fecha no reconocido: %q", raw)
}

// ── EncryptedFloat64 ────────────────────────────────────────────────────────────────────

// EncryptedFloat64 es un float64 cifrado y nullable (mismo patrón que sql.NullFloat64) —
// usado para ClinicalRecord.ValueQuantity (ej. presión arterial, temperatura).
type EncryptedFloat64 struct {
	Float64 float64
	Valid   bool
}

func NewEncryptedFloat64(f *float64) EncryptedFloat64 {
	if f == nil {
		return EncryptedFloat64{}
	}
	return EncryptedFloat64{Float64: *f, Valid: true}
}

func (e EncryptedFloat64) Value() (driver.Value, error) {
	if !e.Valid {
		return nil, nil
	}
	enc, err := encryptString(strconv.FormatFloat(e.Float64, 'f', -1, 64))
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func (e *EncryptedFloat64) Scan(value interface{}) error {
	plain, err := scanToPlain(value)
	if err != nil {
		return err
	}
	if plain == nil {
		*e = EncryptedFloat64{}
		return nil
	}
	f, err := strconv.ParseFloat(*plain, 64)
	if err != nil {
		return fmt.Errorf("crypto: número inválido tras descifrar: %w", err)
	}
	*e = EncryptedFloat64{Float64: f, Valid: true}
	return nil
}

func (e EncryptedFloat64) MarshalJSON() ([]byte, error) {
	if !e.Valid {
		return []byte("null"), nil
	}
	return json.Marshal(e.Float64)
}

func (e *EncryptedFloat64) UnmarshalJSON(data []byte) error {
	// Mismo caso que EncryptedTime.UnmarshalJSON: un input numérico opcional vacío en el
	// frontend manda "" en vez de omitir el campo o mandar null.
	s := string(data)
	if s == "null" || s == `""` {
		*e = EncryptedFloat64{}
		return nil
	}
	// <input type="number"> en React siempre guarda el valor como string, así que el JSON
	// que llega es "120" (string), no 120 (número) — sin este caso, json.Unmarshal a float64
	// rechaza el string y la request entera falla con 400.
	var raw string
	if err := json.Unmarshal(data, &raw); err == nil {
		f, err := strconv.ParseFloat(raw, 64)
		if err != nil {
			return fmt.Errorf("crypto: número inválido: %q", raw)
		}
		*e = EncryptedFloat64{Float64: f, Valid: true}
		return nil
	}
	var f float64
	if err := json.Unmarshal(data, &f); err != nil {
		return err
	}
	*e = EncryptedFloat64{Float64: f, Valid: true}
	return nil
}

// ── EncryptedInt ────────────────────────────────────────────────────────────────────────

// EncryptedInt es un int cifrado, no nullable — usado para MedicalLeave.DaysCount.
type EncryptedInt int

func (e EncryptedInt) Value() (driver.Value, error) {
	enc, err := encryptString(strconv.Itoa(int(e)))
	if err != nil {
		return nil, err
	}
	return enc, nil
}

func (e *EncryptedInt) Scan(value interface{}) error {
	plain, err := scanToPlain(value)
	if err != nil {
		return err
	}
	if plain == nil {
		*e = 0
		return nil
	}
	n, err := strconv.Atoi(*plain)
	if err != nil {
		return fmt.Errorf("crypto: entero inválido tras descifrar: %w", err)
	}
	*e = EncryptedInt(n)
	return nil
}

func (e EncryptedInt) MarshalJSON() ([]byte, error) {
	return json.Marshal(int(e))
}

func (e *EncryptedInt) UnmarshalJSON(data []byte) error {
	// Mismo caso que EncryptedFloat64.UnmarshalJSON: <input type="number"> en React manda
	// el valor como string ("3"), no como número JSON (3).
	var raw string
	if err := json.Unmarshal(data, &raw); err == nil {
		n, err := strconv.Atoi(raw)
		if err != nil {
			return fmt.Errorf("crypto: entero inválido: %q", raw)
		}
		*e = EncryptedInt(n)
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err != nil {
		return err
	}
	*e = EncryptedInt(n)
	return nil
}
