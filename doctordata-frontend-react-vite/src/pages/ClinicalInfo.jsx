import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { clinicalApi, memberApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import { label, ALLERGY_TYPE_ES, ALLERGY_CATEGORY_ES, ALLERGY_CRITICALITY_ES, CONDITION_STATUS_ES, APPOINTMENT_STATUS_ES, RECORD_TYPE_ES, RECORD_STATUS_ES } from '../utils/clinicalLabels'
import logo from '../assets/images/Doctor_Data_logo.png'

const TABS = [
  { key: 'allergies',        label: 'Alergias' },
  { key: 'conditions',       label: 'Condiciones de salud' },
  { key: 'family-history',   label: 'Antecedentes familiares' },
  { key: 'appointments',     label: 'Citas' },
  { key: 'medical-leaves',   label: 'Descansos médicos' },
  { key: 'clinical-records', label: 'Registros clínicos' },
]

export default function ClinicalInfo() {
  const { user } = useAuth()
  const [tab, setTab] = useState('allergies')
  const [profiles, setProfiles] = useState([])
  const [selectedProfileId, setSelectedProfileId] = useState('')

  // memberApi.list() devuelve el perfil propio del titular (managed_by_user_id === user_id
  // propio) junto con cada persona cubierta — así se arma el selector "¿de quién es esta
  // información clínica?" sin una llamada aparte.
  useEffect(() => {
    if (!user?.has_active_subscription) return
    memberApi.list().then((r) => {
      const list = r.data ?? []
      setProfiles(list)
      const self = list.find((m) => m.user_id === user.id)
      setSelectedProfileId((self ?? list[0])?.id ?? '')
    }).catch(() => {})
  }, [user?.has_active_subscription, user?.id])

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard">
          <img src={logo} alt="Logotipo Doctor Data" title="Volver al inicio"
            className="dashboard-header-logo" />
        </Link>
        <div className="header-actions">
          <span>{user?.email}</span>
          {user?.is_doctor && <span className="badge badge-doctor">Médico</span>}
          {user?.is_admin  && <span className="badge badge-admin">Admin</span>}
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Información clínica</h2>
          <p className="page-subtitle">
            Gestiona tus registros médicos.
          </p>
        </div>

        {!user?.has_active_subscription ? (
          <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <span>
              Tu suscripción venció — tus datos básicos siguen guardados, pero la información
              médica (alergias, condiciones, citas, descansos y registros clínicos) se oculta
              hasta que renueves.
            </span>
            <Link to="/pricing" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Renovar</Link>
          </div>
        ) : (
          <>
            {profiles.length > 1 && (
              <div className="form-group" style={{ maxWidth: 320, marginBottom: '1.25rem' }}>
                <label htmlFor="clinical-profile-select">Mostrando información clínica de</label>
                <select id="clinical-profile-select" className="form-select" value={selectedProfileId}
                  onChange={(e) => setSelectedProfileId(e.target.value)}>
                  {profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.first_name} {p.last_name}{p.user_id === user.id ? ' (tú, titular de la cuenta)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="tabs">
              {TABS.map((t) => (
                <button key={t.key}
                  className={`tab ${tab === t.key ? 'tab-active' : ''}`}
                  onClick={() => setTab(t.key)}>
                  {t.label}
                </button>
              ))}
            </div>

            {!selectedProfileId ? (
              <div className="alert alert-info" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginTop: '1rem' }}>
                <span>Agrega primero tus datos personales para poder registrar información clínica.</span>
                <Link to="/profile" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Ir a Datos personales</Link>
              </div>
            ) : (
              <>
                {tab === 'allergies'        && <AllergiesTab    patientProfileId={selectedProfileId} />}
                {tab === 'conditions'       && <ConditionsTab   patientProfileId={selectedProfileId} />}
                {tab === 'family-history'   && <FamilyHistoryTab patientProfileId={selectedProfileId} />}
                {tab === 'appointments'     && <AppointmentsTab patientProfileId={selectedProfileId} />}
                {tab === 'medical-leaves'   && <MedicalLeavesTab patientProfileId={selectedProfileId} />}
                {tab === 'clinical-records' && <ClinicalRecordsTab patientProfileId={selectedProfileId} />}
              </>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  )
}

// ── Utilidades ────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-PE')
}
function fmtDT(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('es-PE')
}

function TabShell({ title, onAdd, addLabel = 'Agregar', children }) {
  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <span style={{ fontWeight: 600, color: 'var(--text-muted)', fontSize: '0.85rem' }}>{title}</span>
        <button className="btn btn-primary" style={{ fontSize: '0.85rem', padding: '0.4rem 1rem' }} onClick={onAdd}>
          + {addLabel}
        </button>
      </div>
      {children}
    </div>
  )
}

function RecordCard({ children, onEdit, onDelete }) {
  return (
    <div className="record-card" style={{ position: 'relative' }}>
      <div style={{ flex: 1 }}>{children}</div>
      <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.5rem' }}>
        {onEdit   && <button className="btn btn-outline" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem' }} onClick={onEdit}>Editar</button>}
        {onDelete && <button className="btn" style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', borderColor: '#fca5a5', color: '#dc2626' }} onClick={onDelete}>Eliminar</button>}
      </div>
    </div>
  )
}

function FormWrap({ onCancel, onSave, saving, isNew, children }) {
  return (
    <div className="clinical-form">
      {children}
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', alignItems: 'center' }}>
        <button className="btn btn-primary" disabled={saving} onClick={onSave}>
          {saving ? 'Guardando...' : isNew ? 'Guardar' : 'Actualizar'}
        </button>
        <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
      </div>
    </div>
  )
}

function FG({ label, children }) {
  return <div className="form-group">{label && <label>{label}</label>}{children}</div>
}

function Sel({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="form-select">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  )
}

function useTabData(loader, patientProfileId) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true)
    loader(patientProfileId).then((r) => setItems(r.data ?? [])).catch(() => {}).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientProfileId])
  useEffect(() => { reload() }, [reload])
  return { items, loading, reload }
}

// ── ALERGIAS ──────────────────────────────────────────────────────────────────

const ALLERGY_EMPTY = { substance: '', type: 'allergy', category: 'food', criticality: 'low', reaction: '', onset_date: '', notes: '' }

function AllergiesTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listAllergies, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.substance.trim()) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateAllergy(form.id, form, patientProfileId)
      else          await clinicalApi.createAllergy(form, patientProfileId)
      setForm(null); reload()
    } catch { /* keep form open */ } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('¿Eliminar esta alergia?')) return
    await clinicalApi.deleteAllergy(id, patientProfileId); reload()
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} alergia(s) registrada(s)`} onAdd={() => setForm(ALLERGY_EMPTY)} addLabel="Nueva alergia">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Sustancia *" ><input value={form.substance} onChange={(e) => set('substance', e.target.value)} placeholder="Penicilina, mariscos, polvo..." /></FG>
            <FG label="Tipo"><Sel value={form.type} onChange={(v) => set('type', v)} options={[['allergy','Alergia'],['intolerance','Intolerancia']]} /></FG>
          </div>
          <div className="profile-row">
            <FG label="Categoría"><Sel value={form.category} onChange={(v) => set('category', v)} options={[['food','Alimento'],['medication','Medicamento'],['environment','Ambiente'],['biologic','Biológico']]} /></FG>
            <FG label="Criticidad"><Sel value={form.criticality} onChange={(v) => set('criticality', v)} options={[['low','Baja'],['high','Alta'],['unable-to-assess','No evaluable']]} /></FG>
            <FG label="Fecha de inicio"><input type="date" value={form.onset_date} onChange={(e) => set('onset_date', e.target.value)} /></FG>
          </div>
          <FG label="Reacción"><input value={form.reaction} onChange={(e) => set('reaction', e.target.value)} placeholder="Describe la reacción observada" /></FG>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay alergias registradas.</div>
      ) : (
        <div className="record-list">
          {items.map((a) => (
            <RecordCard key={a.id}
              onEdit={() => setForm({ ...a, onset_date: a.onset_date ? a.onset_date.substring(0, 10) : '' })}
              onDelete={() => del(a.id)}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{a.substance}</strong>
                <span className="badge">{label(ALLERGY_CATEGORY_ES, a.category)}</span>
                <span className={`badge ${a.criticality === 'high' ? 'badge-high' : ''}`}>{label(ALLERGY_CRITICALITY_ES, a.criticality)}</span>
                <span className="badge">{label(ALLERGY_TYPE_ES, a.type)}</span>
              </div>
              {a.reaction && <p style={{ margin: 0 }}>{a.reaction}</p>}
              {a.notes    && <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.82rem' }}>{a.notes}</p>}
              {a.onset_date && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Desde: {fmt(a.onset_date)}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}

// ── CONDICIONES DE SALUD ──────────────────────────────────────────────────────

const COND_EMPTY = { display_name: '', icd10_code: '', clinical_status: 'active', verification_status: 'confirmed', onset_date: '', abatement_date: '', notes: '' }

function ConditionsTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listConditions, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.display_name.trim()) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateCondition(form.id, form, patientProfileId)
      else          await clinicalApi.createCondition(form, patientProfileId)
      setForm(null); reload()
    } catch { } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('¿Eliminar esta condición?')) return
    await clinicalApi.deleteCondition(id, patientProfileId); reload()
  }

  const isMH = (code) => code?.toUpperCase().startsWith('F')

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} condición(es) registrada(s)`} onAdd={() => setForm(COND_EMPTY)} addLabel="Nueva condición">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Nombre de la condición *" ><input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Hipertensión arterial, Diabetes tipo 2..." /></FG>
            <FG label="Código ICD-10"><input value={form.icd10_code} onChange={(e) => set('icd10_code', e.target.value)} placeholder="I10, E11.9, F32.1..." /></FG>
          </div>
          <div className="profile-row">
            <FG label="Estado clínico"><Sel value={form.clinical_status} onChange={(v) => set('clinical_status', v)} options={[['active','Activo'],['recurrence','Recurrencia'],['remission','En remisión'],['inactive','Inactivo'],['resolved','Resuelto']]} /></FG>
            <FG label="Verificación"><Sel value={form.verification_status} onChange={(v) => set('verification_status', v)} options={[['confirmed','Confirmado'],['provisional','Provisional'],['unconfirmed','No confirmado'],['refuted','Refutado']]} /></FG>
          </div>
          <div className="profile-row">
            <FG label="Fecha de inicio"><input type="date" value={form.onset_date} onChange={(e) => set('onset_date', e.target.value)} /></FG>
            <FG label="Fecha de resolución"><input type="date" value={form.abatement_date} onChange={(e) => set('abatement_date', e.target.value)} /></FG>
          </div>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay condiciones registradas.</div>
      ) : (
        <div className="record-list">
          {items.map((c) => (
            <RecordCard key={c.id}
              onEdit={() => setForm({ ...c, onset_date: c.onset_date?.substring(0,10) ?? '', abatement_date: c.abatement_date?.substring(0,10) ?? '' })}
              onDelete={() => del(c.id)}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{c.display_name}</strong>
                {c.icd10_code && <span className="badge">{c.icd10_code}</span>}
                <span className="badge">{label(CONDITION_STATUS_ES, c.clinical_status)}</span>
                {isMH(c.icd10_code) && <span className="badge" style={{ background: 'rgba(94,96,159,0.12)', color: '#5e609f' }}>Salud mental</span>}
              </div>
              {c.notes && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{c.notes}</p>}
              {c.onset_date && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Desde: {fmt(c.onset_date)}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}

// ── ANTECEDENTES FAMILIARES ────────────────────────────────────────────────────
// Solo visible para doctores cuando consultan a otra persona por QR/ID (ver
// GetPatientFamilyHistory en el backend, y PatientProfile.jsx) — igual que citas/descansos/
// registros clínicos. Acá, en tu propia información clínica, se ve y edita normal.

const FAMILY_EMPTY = { relationship: '', condition: '', notes: '' }

function FamilyHistoryTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listFamilyHistory, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.relationship.trim() || !form.condition.trim()) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateFamilyHistory(form.id, form, patientProfileId)
      else          await clinicalApi.createFamilyHistory(form, patientProfileId)
      setForm(null); reload()
    } catch { } finally { setSaving(false) }
  }

  async function del(id) {
    if (!confirm('¿Eliminar este antecedente familiar?')) return
    await clinicalApi.deleteFamilyHistory(id, patientProfileId); reload()
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} antecedente(s) registrado(s)`} onAdd={() => setForm(FAMILY_EMPTY)} addLabel="Nuevo antecedente">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Parentesco *"><input value={form.relationship} onChange={(e) => set('relationship', e.target.value)} placeholder="Abuela materna, tío primero, prima segunda..." /></FG>
            <FG label="Condición / enfermedad *"><input value={form.condition} onChange={(e) => set('condition', e.target.value)} placeholder="Diabetes, cáncer, aneurisma..." /></FG>
          </div>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay antecedentes familiares registrados.</div>
      ) : (
        <div className="record-list">
          {items.map((f) => (
            <RecordCard key={f.id} onEdit={() => setForm(f)} onDelete={() => del(f.id)}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{f.condition}</strong>
                <span className="badge">{f.relationship}</span>
              </div>
              {f.notes && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{f.notes}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}

// ── CITAS MÉDICAS ─────────────────────────────────────────────────────────────

function toLocalDT(isoStr) {
  if (!isoStr) return ''
  return new Date(isoStr).toISOString().substring(0, 16)
}

const APPT_EMPTY = { start_time: '', end_time: '', status: 'proposed', service_type: '', reason: '', notes: '', practitioner_name: '', practitioner_cmp: '', institution: '' }

function AppointmentsTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listAppointments, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.start_time) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateAppointment(form.id, form, patientProfileId)
      else          await clinicalApi.createAppointment(form, patientProfileId)
      setForm(null); reload()
    } catch { } finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} cita(s) registrada(s)`} onAdd={() => setForm(APPT_EMPTY)} addLabel="Nueva cita">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Fecha y hora inicio *"><input type="datetime-local" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} /></FG>
            <FG label="Fecha y hora fin"><input type="datetime-local" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} /></FG>
          </div>
          <div className="profile-row">
            <FG label="Estado"><Sel value={form.status} onChange={(v) => set('status', v)} options={[['proposed','Propuesta'],['pending','Pendiente'],['booked','Confirmada'],['arrived','En curso'],['fulfilled','Completada'],['cancelled','Cancelada'],['noshow','No asistió']]} /></FG>
            <FG label="Tipo de servicio"><input value={form.service_type} onChange={(e) => set('service_type', e.target.value)} placeholder="Consulta, Emergencia, Control..." /></FG>
          </div>
          <FG label="Motivo"><input value={form.reason} onChange={(e) => set('reason', e.target.value)} /></FG>
          <div className="profile-row">
            <FG label="Nombre del médico"><input value={form.practitioner_name} onChange={(e) => set('practitioner_name', e.target.value)} placeholder="Dr./Dra. ..." /></FG>
            <FG label="Código CMP"><input value={form.practitioner_cmp} onChange={(e) => set('practitioner_cmp', e.target.value)} placeholder="12345" /></FG>
          </div>
          <FG label="Lugar de atención"><input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Hospital, clínica, posta..." /></FG>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay citas registradas.</div>
      ) : (
        <div className="record-list">
          {items.map((a) => (
            <RecordCard key={a.id}
              onEdit={() => setForm({ ...a, start_time: toLocalDT(a.start_time), end_time: toLocalDT(a.end_time) })}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{fmtDT(a.start_time)}</strong>
                <span className="badge">{label(APPOINTMENT_STATUS_ES, a.status)}</span>
                {a.service_type && <span className="badge">{a.service_type}</span>}
              </div>
              {a.reason && <p style={{ margin: 0 }}>{a.reason}</p>}
              {(a.practitioner_name || a.practitioner_cmp) && (
                <p style={{ margin: 0, fontSize: '0.85rem' }}>
                  {a.practitioner_name}{a.practitioner_cmp && ` (CMP ${a.practitioner_cmp})`}
                </p>
              )}
              {a.institution && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>{a.institution}</p>}
              {a.end_time && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>Hasta: {fmtDT(a.end_time)}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}

// ── DESCANSOS MÉDICOS ─────────────────────────────────────────────────────────

const LEAVE_EMPTY = { diagnosis_display: '', diagnosis_code: '', issue_date: '', start_date: '', end_date: '', institution: '', notes: '' }

function MedicalLeavesTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listMedicalLeaves, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.diagnosis_display.trim() || !form.start_date || !form.end_date) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateMedicalLeave(form.id, form, patientProfileId)
      else          await clinicalApi.createMedicalLeave(form, patientProfileId)
      setForm(null); reload()
    } catch { } finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} descanso(s) registrado(s)`} onAdd={() => setForm(LEAVE_EMPTY)} addLabel="Nuevo descanso">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Diagnóstico *"><input value={form.diagnosis_display} onChange={(e) => set('diagnosis_display', e.target.value)} placeholder="Nombre del diagnóstico" /></FG>
            <FG label="Código ICD-10"><input value={form.diagnosis_code} onChange={(e) => set('diagnosis_code', e.target.value)} placeholder="J06.9..." /></FG>
          </div>
          <div className="profile-row">
            <FG label="Fecha de emisión *"><input type="date" value={form.issue_date} onChange={(e) => set('issue_date', e.target.value)} /></FG>
            <FG label="Fecha inicio *"><input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} /></FG>
            <FG label="Fecha fin *"><input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} /></FG>
          </div>
          <FG label="Institución"><input value={form.institution} onChange={(e) => set('institution', e.target.value)} placeholder="Hospital, clínica..." /></FG>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay descansos médicos registrados.</div>
      ) : (
        <div className="record-list">
          {items.map((l) => (
            <RecordCard key={l.id}
              onEdit={() => setForm({
                ...l,
                issue_date: l.issue_date?.substring(0, 10) ?? '',
                start_date: l.start_date?.substring(0, 10) ?? '',
                end_date: l.end_date?.substring(0, 10) ?? '',
              })}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{l.diagnosis_display}</strong>
                {l.diagnosis_code && <span className="badge">{l.diagnosis_code}</span>}
                <span className="badge">{l.days_count} días</span>
              </div>
              <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {fmt(l.start_date)} → {fmt(l.end_date)}
              </p>
              {l.institution && <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{l.institution}</p>}
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}

// ── REGISTROS CLÍNICOS ────────────────────────────────────────────────────────

const REC_EMPTY = { display_name: '', record_type: 'vital-signs', loinc_code: '', status: 'final', value_quantity: '', value_unit: '', value_string: '', effective_date: '', notes: '' }

function ClinicalRecordsTab({ patientProfileId }) {
  const { items, loading, reload } = useTabData(clinicalApi.listClinicalRecords, patientProfileId)
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  function set(f, v) { setForm((p) => ({ ...p, [f]: v })) }

  async function save() {
    if (!form.display_name.trim() || !form.effective_date) return
    setSaving(true)
    try {
      if (form.id) await clinicalApi.updateClinicalRecord(form.id, form, patientProfileId)
      else          await clinicalApi.createClinicalRecord(form, patientProfileId)
      setForm(null); reload()
    } catch { } finally { setSaving(false) }
  }

  if (loading) return <div className="loading">Cargando...</div>

  return (
    <TabShell title={`${items.length} registro(s) clínico(s)`} onAdd={() => setForm(REC_EMPTY)} addLabel="Nuevo registro">
      {form && (
        <FormWrap onCancel={() => setForm(null)} onSave={save} saving={saving} isNew={!form.id}>
          <div className="profile-row">
            <FG label="Nombre del registro *"><input value={form.display_name} onChange={(e) => set('display_name', e.target.value)} placeholder="Presión arterial, Glucosa en ayunas..." /></FG>
            <FG label="Tipo"><Sel value={form.record_type} onChange={(v) => set('record_type', v)} options={[['vital-signs','Signos vitales'],['laboratory','Laboratorio'],['imaging','Imagen'],['procedure','Procedimiento'],['medication','Medicación'],['note','Nota clínica'],['social-history','Historia social']]} /></FG>
          </div>
          <div className="profile-row">
            <FG label="Código LOINC"><input value={form.loinc_code} onChange={(e) => set('loinc_code', e.target.value)} placeholder="85354-9..." /></FG>
            <FG label="Estado"><Sel value={form.status} onChange={(v) => set('status', v)} options={[['final','Final'],['preliminary','Preliminar'],['registered','Registrado'],['amended','Enmendado'],['corrected','Corregido'],['cancelled','Cancelado']]} /></FG>
            <FG label="Fecha efectiva *"><input type="date" value={form.effective_date} onChange={(e) => set('effective_date', e.target.value)} /></FG>
          </div>
          <div className="profile-row">
            <FG label="Valor numérico"><input type="number" step="any" value={form.value_quantity} onChange={(e) => set('value_quantity', e.target.value)} placeholder="120" /></FG>
            <FG label="Unidad"><input value={form.value_unit} onChange={(e) => set('value_unit', e.target.value)} placeholder="mmHg, °C, mg/dL..." /></FG>
          </div>
          <FG label="Valor narrativo"><input value={form.value_string} onChange={(e) => set('value_string', e.target.value)} placeholder="Descripción del resultado..." /></FG>
          <FG label="Notas"><input value={form.notes} onChange={(e) => set('notes', e.target.value)} /></FG>
        </FormWrap>
      )}

      {items.length === 0 && !form ? (
        <div className="empty-state">No hay registros clínicos.</div>
      ) : (
        <div className="record-list">
          {items.map((r) => (
            <RecordCard key={r.id}
              onEdit={() => setForm({ ...r, effective_date: r.effective_date?.substring(0,10) ?? '', value_quantity: r.value_quantity ?? '' })}>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.25rem' }}>
                <strong>{r.display_name}</strong>
                <span className="badge">{label(RECORD_TYPE_ES, r.record_type)}</span>
                {r.loinc_code && <span className="badge">{r.loinc_code}</span>}
                <span className="badge">{label(RECORD_STATUS_ES, r.status)}</span>
              </div>
              {(r.value_quantity != null || r.value_unit) && (
                <p style={{ margin: 0, fontWeight: 600, color: 'var(--blue)' }}>
                  {r.value_quantity} {r.value_unit}
                </p>
              )}
              {r.value_string && <p style={{ margin: 0 }}>{r.value_string}</p>}
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{fmt(r.effective_date)}</p>
            </RecordCard>
          ))}
        </div>
      )}
    </TabShell>
  )
}
