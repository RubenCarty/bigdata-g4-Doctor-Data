/**
 * Schema SQLite para DoctorData (React Native).
 *
 * Espeja el schema PostgreSQL del backend con estas adaptaciones:
 *   - UUID      → TEXT
 *   - TIMESTAMP → TEXT  (ISO 8601, ej: "2025-06-20T14:30:00Z")
 *   - BOOLEAN   → INTEGER (0 = false, 1 = true)
 *   - FLOAT     → REAL
 *
 * Campos de sincronización (en cada tabla de datos clínicos):
 *   - server_id        TEXT    — UUID del registro en PostgreSQL (NULL hasta primer sync)
 *   - sync_status      TEXT    — DIRTY | CLEAN | CONFLICT  (default: DIRTY)
 *   - updated_at_local TEXT    — timestamp de la última modificación local
 *   - updated_at_remote TEXT   — timestamp de la última versión conocida en el servidor
 *
 * Tabla sync_queue: cola de operaciones pendientes de enviar al backend.
 * Política de conflictos: last-write-wins por updated_at_local vs updated_at_remote.
 */

export const SCHEMA_STATEMENTS = [
  // ─── users ─────────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS users (
    id           TEXT PRIMARY KEY,
    server_id    TEXT,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    is_doctor    INTEGER NOT NULL DEFAULT 0,
    is_active    INTEGER NOT NULL DEFAULT 1,
    created_at   TEXT NOT NULL,
    updated_at   TEXT NOT NULL,
    deleted_at   TEXT,
    sync_status        TEXT NOT NULL DEFAULT 'DIRTY',
    updated_at_local   TEXT,
    updated_at_remote  TEXT,
    server_id          TEXT
  )`,

  // ─── patient_profiles ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS patient_profiles (
    id                           TEXT PRIMARY KEY,
    server_id                    TEXT,
    user_id                      TEXT REFERENCES users(id),
    first_name                   TEXT NOT NULL,
    last_name                    TEXT NOT NULL,
    birth_date                   TEXT,
    gender                       TEXT DEFAULT 'unknown',
    phone                        TEXT,
    document_type                TEXT,
    document_number              TEXT,
    address_street               TEXT,
    address_city                 TEXT,
    address_state                TEXT,
    address_country              TEXT DEFAULT 'PE',
    address_postal_code          TEXT,
    blood_type                   TEXT,
    is_smoker                    INTEGER NOT NULL DEFAULT 0,
    is_alcohol_consumer          INTEGER NOT NULL DEFAULT 0,
    has_psychological_conditions INTEGER NOT NULL DEFAULT 0,
    created_at                   TEXT NOT NULL,
    updated_at                   TEXT NOT NULL,
    deleted_at                   TEXT,
    is_synced                    INTEGER NOT NULL DEFAULT 0,
    synced_at                    TEXT
  )`,

  // ─── practitioner_profiles ─────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS practitioner_profiles (
    id             TEXT PRIMARY KEY,
    server_id      TEXT,
    user_id        TEXT NOT NULL REFERENCES users(id),
    license_number TEXT NOT NULL,
    specialty      TEXT,
    institution    TEXT,
    is_active      INTEGER NOT NULL DEFAULT 1,
    created_at     TEXT NOT NULL,
    updated_at     TEXT NOT NULL,
    deleted_at     TEXT,
    is_synced      INTEGER NOT NULL DEFAULT 0,
    synced_at      TEXT
  )`,

  // ─── family_groups ─────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS family_groups (
    id            TEXT PRIMARY KEY,
    server_id     TEXT,
    owner_user_id TEXT NOT NULL REFERENCES users(id),
    name          TEXT NOT NULL,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL,
    deleted_at    TEXT,
    is_synced     INTEGER NOT NULL DEFAULT 0,
    synced_at     TEXT
  )`,

  // ─── family_members ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS family_members (
    id                 TEXT PRIMARY KEY,
    server_id          TEXT,
    family_group_id    TEXT NOT NULL REFERENCES family_groups(id),
    patient_profile_id TEXT NOT NULL REFERENCES patient_profiles(id),
    relationship       TEXT NOT NULL,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    deleted_at         TEXT,
    is_synced          INTEGER NOT NULL DEFAULT 0,
    synced_at          TEXT
  )`,

  // ─── allergy_intolerances ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS allergy_intolerances (
    id                 TEXT PRIMARY KEY,
    server_id          TEXT,
    patient_profile_id TEXT NOT NULL REFERENCES patient_profiles(id),
    type               TEXT,
    category           TEXT,
    criticality        TEXT,
    substance          TEXT NOT NULL,
    reaction           TEXT,
    onset_date         TEXT,
    notes              TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    deleted_at         TEXT,
    is_synced          INTEGER NOT NULL DEFAULT 0,
    synced_at          TEXT
  )`,

  // ─── conditions ────────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS conditions (
    id                   TEXT PRIMARY KEY,
    server_id            TEXT,
    patient_profile_id   TEXT NOT NULL REFERENCES patient_profiles(id),
    icd10_code           TEXT,
    display_name         TEXT NOT NULL,
    clinical_status      TEXT,
    verification_status  TEXT,
    onset_date           TEXT,
    abatement_date       TEXT,
    notes                TEXT,
    created_at           TEXT NOT NULL,
    updated_at           TEXT NOT NULL,
    deleted_at           TEXT,
    is_synced            INTEGER NOT NULL DEFAULT 0,
    synced_at            TEXT
  )`,

  // ─── appointments ──────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS appointments (
    id                       TEXT PRIMARY KEY,
    server_id                TEXT,
    patient_profile_id       TEXT NOT NULL REFERENCES patient_profiles(id),
    practitioner_profile_id  TEXT REFERENCES practitioner_profiles(id),
    status                   TEXT NOT NULL DEFAULT 'proposed',
    service_type             TEXT,
    reason                   TEXT,
    start_time               TEXT NOT NULL,
    end_time                 TEXT,
    notes                    TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,
    deleted_at               TEXT,
    is_synced                INTEGER NOT NULL DEFAULT 0,
    synced_at                TEXT
  )`,

  // ─── medical_leaves ────────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS medical_leaves (
    id                       TEXT PRIMARY KEY,
    server_id                TEXT,
    patient_profile_id       TEXT NOT NULL REFERENCES patient_profiles(id),
    practitioner_profile_id  TEXT REFERENCES practitioner_profiles(id),
    diagnosis_code           TEXT,
    diagnosis_display        TEXT NOT NULL,
    issue_date               TEXT NOT NULL,
    start_date               TEXT NOT NULL,
    end_date                 TEXT NOT NULL,
    days_count               INTEGER NOT NULL,
    institution              TEXT,
    notes                    TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,
    deleted_at               TEXT,
    is_synced                INTEGER NOT NULL DEFAULT 0,
    synced_at                TEXT
  )`,

  // ─── clinical_records ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS clinical_records (
    id                       TEXT PRIMARY KEY,
    server_id                TEXT,
    patient_profile_id       TEXT NOT NULL REFERENCES patient_profiles(id),
    practitioner_profile_id  TEXT REFERENCES practitioner_profiles(id),
    appointment_id           TEXT REFERENCES appointments(id),
    record_type              TEXT NOT NULL,
    loinc_code               TEXT,
    display_name             TEXT NOT NULL,
    status                   TEXT DEFAULT 'final',
    value_quantity           REAL,
    value_unit               TEXT,
    value_string             TEXT,
    effective_date           TEXT NOT NULL,
    notes                    TEXT,
    created_at               TEXT NOT NULL,
    updated_at               TEXT NOT NULL,
    deleted_at               TEXT,
    is_synced                INTEGER NOT NULL DEFAULT 0,
    synced_at                TEXT
  )`,

  // ─── sync_queue ────────────────────────────────────────────────────────────
  // Cola de operaciones pendientes de enviar al backend.
  // El módulo de sync lee esta tabla, envía al servidor y marca como SENT o FAILED.
  `CREATE TABLE IF NOT EXISTS sync_queue (
    id           TEXT PRIMARY KEY,
    table_name   TEXT NOT NULL,
    record_id    TEXT NOT NULL,
    operation    TEXT NOT NULL,
    payload      TEXT NOT NULL,
    status       TEXT NOT NULL DEFAULT 'PENDING',
    retry_count  INTEGER NOT NULL DEFAULT 0,
    created_at   TEXT NOT NULL,
    sent_at      TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`,

  // ─── Índices para queries frecuentes ───────────────────────────────────────
  `CREATE INDEX IF NOT EXISTS idx_patient_profiles_user_id      ON patient_profiles(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_patient_profiles_document     ON patient_profiles(document_number)`,
  `CREATE INDEX IF NOT EXISTS idx_family_members_group          ON family_members(family_group_id)`,
  `CREATE INDEX IF NOT EXISTS idx_allergy_patient               ON allergy_intolerances(patient_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_conditions_patient            ON conditions(patient_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_appointments_patient          ON appointments(patient_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_medical_leaves_patient        ON medical_leaves(patient_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_clinical_records_patient      ON clinical_records(patient_profile_id)`,
  `CREATE INDEX IF NOT EXISTS idx_unsynced_patients             ON patient_profiles(is_synced) WHERE is_synced = 0`,
]
