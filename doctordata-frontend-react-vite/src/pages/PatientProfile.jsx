import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { publicApi } from '../services/api'
import VerifyCodeForm from '../components/VerifyCodeForm'
import { label, ALLERGY_TYPE_ES, ALLERGY_CATEGORY_ES, ALLERGY_CRITICALITY_ES, CONDITION_STATUS_ES, APPOINTMENT_STATUS_ES, RECORD_TYPE_ES, RECORD_STATUS_ES } from '../utils/clinicalLabels'
import terminosPdf from '../assets/docs/Terminos_y_Condiciones_DoctorData.pdf'
import privacidadPdf from '../assets/docs/Politica_de_Privacidad_DoctorData.pdf'
import logo from '../assets/images/Doctor_Data_logo.png'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const GENDER_ES = { male: 'Masculino', female: 'Femenino', other: 'Otro', unknown: null }

export default function PatientProfile() {
  // /patient/:userId (titular, tiene login propio) o /patient/profile/:profileId (persona
  // cubierta, sin login propio) — ver App.jsx y GetMyQR en el backend.
  const { userId, profileId } = useParams()
  const { user } = useAuth()
  const isDoctor = user?.is_doctor || user?.is_admin

  const [profile, setProfile] = useState(null)
  const [appointments, setAppointments] = useState([])
  const [medicalLeaves, setMedicalLeaves] = useState([])
  const [clinicalRecords, setClinicalRecords] = useState([])
  const [familyHistory, setFamilyHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Alergias y condiciones ya vienen en la respuesta pública (sin login) — cualquiera que
  // escanee el QR necesita verlas de inmediato en una emergencia, no solo un médico logueado.
  // Citas/descansos/registros clínicos/antecedentes familiares siguen siendo solo para
  // médicos autenticados.
  const loadClinicalData = useCallback((pid) => {
    Promise.allSettled([
      publicApi.getAppointments(pid),
      publicApi.getMedicalLeaves(pid),
      publicApi.getClinicalRecords(pid),
      publicApi.getFamilyHistory(pid),
    ]).then(([appt, leaves, rec, fam]) => {
      if (appt.status === 'fulfilled') setAppointments(appt.value.data ?? [])
      if (leaves.status === 'fulfilled') setMedicalLeaves(leaves.value.data ?? [])
      if (rec.status === 'fulfilled') setClinicalRecords(rec.value.data ?? [])
      if (fam.status === 'fulfilled') setFamilyHistory(fam.value.data ?? [])
    })
  }, [])

  useEffect(() => {
    const request = userId ? publicApi.getPatientProfile(userId) : publicApi.getPatientProfileByProfileId(profileId)
    request
      .then((r) => {
        setProfile(r.data)
        // Si el viewer es médico, carga citas/descansos/registros clínicos usando el profile ID
        if (isDoctor) loadClinicalData(r.data.patient_profile_id)
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false))
  }, [userId, profileId, isDoctor, loadClinicalData])

  // Título con el nombre real (para quien la abre con el link/QR) + noindex (para que Google
  // no la liste — es información de emergencia pública por diseño, no debe salir en
  // resultados de búsqueda). Es una SPA sin SSR: index.html sirve un único <title>/<meta
  // name="robots"> estáticos para todas las rutas, así que esto se maneja en JS al cargar el
  // perfil, y se revierte al desmontar/cambiar de perfil para no dejarle noindex pegado al
  // resto de la navegación.
  useEffect(() => {
    if (!profile) return

    const previousTitle = document.title
    document.title = `${profile.first_name} ${profile.last_name} — DoctorData`

    let robotsMeta = document.querySelector('meta[name="robots"]')
    const hadRobotsMeta = !!robotsMeta
    const previousRobotsContent = robotsMeta?.getAttribute('content')
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
    }
    robotsMeta.setAttribute('content', 'noindex, nofollow')

    return () => {
      document.title = previousTitle
      if (hadRobotsMeta) {
        robotsMeta.setAttribute('content', previousRobotsContent)
      } else {
        robotsMeta.remove()
      }
    }
  }, [profile])

  if (loading) {
    return (
      <div className="patient-page">
        <PatientHeader />
        <div className="loading" style={{ padding: '4rem' }}>Cargando perfil...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="patient-page">
        <PatientHeader />
        <div className="empty-state" style={{ padding: '4rem' }}>
          <p>Perfil de paciente no encontrado.</p>
          <p style={{ fontSize: '0.85rem', marginTop: '0.5rem' }}>
            El paciente debe completar su registro en DoctorData.
          </p>
        </div>
      </div>
    )
  }

  const fullName = `${profile.first_name} ${profile.last_name}`
  const criticalAllergies = (profile.allergies ?? []).filter(
    (a) => a.criticality === 'high' || a.criticality === 'unable-to-assess'
  )

  // Fallecido: la página deja de ser una vista de emergencia médica y pasa a ser un espacio
  // de memoria — sin datos clínicos de gestión activa, solo el nombre y una foto.
  if (profile.life_status === 'deceased') {
    return (
      <div className="patient-page">
        <PatientHeader />
        <main className="patient-content">
          <div className="patient-memorial-page">
            {profile.profile_photo_url
              ? <img src={API_BASE + profile.profile_photo_url} alt={fullName} className="patient-memorial-photo" />
              : <div className="patient-memorial-avatar">{profile.first_name?.[0]}{profile.last_name?.[0]}</div>}
            <h1 className="patient-name">En memoria de {fullName}</h1>
            <p style={{ color: 'var(--text-muted)' }}>Este perfil se mantiene como un espacio de memoria.</p>
          </div>
        </main>
        <footer className="patient-footer">
          <p>© 2026 DoctorData</p>
        </footer>
      </div>
    )
  }

  return (
    <div className="patient-page">
      <PatientHeader doctorView={isDoctor} />

      {/* Persona reportada como desaparecida/extraviada — máxima prioridad visual, va antes
          que cualquier otro banner (incluso el de vista médica). */}
      {profile.life_status === 'missing' && (
        <div className="patient-missing-banner">
          ⚠ Persona desaparecida — si tienes información, contacta al número de emergencia de abajo
        </div>
      )}

      {/* Banner de advertencia para vista de emergencia */}
      {!isDoctor && (
        <div className="patient-emergency-banner">
          ⚠ Información de emergencia — muestra este perfil al personal médico
        </div>
      )}

      {isDoctor && (
        <div className="patient-doctor-banner">
          Vista médica completa — {user?.email}
        </div>
      )}

      <main className="patient-content">
        {/* Encabezado del paciente */}
        <div className="patient-header-card">
          {profile.profile_photo_url
            ? <img
                src={API_BASE + profile.profile_photo_url}
                alt={fullName}
                style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 8, flexShrink: 0, border: '2px solid var(--border)' }}
              />
            : <div className="patient-avatar">{profile.first_name?.[0]}{profile.last_name?.[0]}</div>}
          <div className="patient-header-info">
            <h1 className="patient-name">{fullName}</h1>
            <div className="patient-quick-facts">
              {profile.blood_type && (
                <span className="patient-fact patient-fact-blood">
                  🩸 {profile.blood_type}
                </span>
              )}
              {profile.health_insurance && (
                <span className="patient-fact" title="Seguro de salud">
                  🚑 {profile.health_insurance}
                </span>
              )}
              {profile.gender && GENDER_ES[profile.gender] && (
                <span className="patient-fact">{GENDER_ES[profile.gender]}</span>
              )}
              {profile.birth_date && (
                <span className="patient-fact">
                  {calculateAge(profile.birth_date)} años
                </span>
              )}
              {profile.is_smoker && (
                <span className="patient-fact patient-fact-warn">Fumador</span>
              )}
              {profile.is_alcohol_consumer && (
                <span className="patient-fact patient-fact-warn">Consumo de alcohol</span>
              )}
              {profile.has_psychological_conditions && (
                <span className="patient-fact patient-fact-psych">Condición psicológica/psiquiátrica</span>
              )}
            </div>
          </div>
        </div>

        {/* Alergias críticas — siempre visibles (información de emergencia) */}
        {criticalAllergies.length > 0 && (
          <div className="patient-section patient-section-critical">
            <h2>⚠ Alergias de alta criticidad</h2>
            <div className="patient-allergy-list">
              {criticalAllergies.map((a) => (
                <div key={a.id} className="patient-allergy-critical">
                  <strong>{a.substance}</strong>
                  {a.reaction && <span> — {a.reaction}</span>}
                  <span className="badge badge-high" style={{ marginLeft: '0.5rem' }}>CRÍTICA</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Contacto de emergencia — a quién llamar, siempre visible sin login */}
        {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
          <div className="patient-section">
            <h2>Contacto de emergencia</h2>
            <div className="record-card">
              <strong>{profile.emergency_contact_name}</strong>
              {profile.emergency_contact_relationship && <span className="badge">{profile.emergency_contact_relationship}</span>}
              {profile.emergency_contact_phone && <p>📞 {profile.emergency_contact_phone}</p>}
            </div>
          </div>
        )}

        {/* Todas las alergias — siempre visibles (información de emergencia) */}
        <div className="patient-section">
          <h2>Alergias e intolerancias</h2>
          {(profile.allergies ?? []).length === 0 ? (
            <p className="empty-state-inline">Sin alergias registradas</p>
          ) : (
            <div className="patient-allergy-list">
              {(profile.allergies ?? []).map((a) => (
                <div key={a.id} className="record-card">
                  <strong>{a.substance}</strong>
                  <span className="badge">{label(ALLERGY_TYPE_ES, a.type)}</span>
                  <span className="badge">{label(ALLERGY_CATEGORY_ES, a.category)}</span>
                  <span className={`badge badge-${a.criticality}`}>{label(ALLERGY_CRITICALITY_ES, a.criticality)}</span>
                  {a.reaction && <p>{a.reaction}</p>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Condiciones de salud — igual que alergias, siempre visibles: es exactamente lo que
            necesita un transeúnte para informar a emergencias (106) — diabetes, cardiopatías,
            etc. — no solo un médico logueado. */}
        <div className="patient-section">
          <h2>Condiciones de salud</h2>
          {(profile.conditions ?? []).length === 0 ? (
            <p className="empty-state-inline">Sin condiciones registradas</p>
          ) : (
            <div className="record-list">
              {(profile.conditions ?? []).map((c) => {
                const isMH = c.icd10_code?.toUpperCase().startsWith('F')
                return (
                  <div key={c.id} className="record-card">
                    <strong>{c.icd10_code} — {c.display_name || c.icd10_code}</strong>
                    <span className="badge">{label(CONDITION_STATUS_ES, c.clinical_status)}</span>
                    {isMH && (
                      <span className="badge" style={{ background: 'rgba(94,96,159,0.12)', color: '#5e609f' }}>
                        Salud mental
                      </span>
                    )}
                    {c.notes && <p>{c.notes}</p>}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Vista médica completa — solo doctores */}
        {isDoctor && (
          <>
            <div className="patient-section">
              <h2>Citas médicas recientes</h2>
              {appointments.length === 0 ? (
                <p className="empty-state-inline">Sin citas registradas</p>
              ) : (
                <div className="record-list">
                  {appointments.slice(0, 5).map((a) => (
                    <div key={a.id} className="record-card">
                      <strong>{new Date(a.start_time).toLocaleString('es-PE')}</strong>
                      <span className="badge">{label(APPOINTMENT_STATUS_ES, a.status)}</span>
                      {a.service_type && <span>{a.service_type}</span>}
                      {a.reason && <p>{a.reason}</p>}
                      {(a.practitioner_name || a.practitioner_cmp) && (
                        <p>{a.practitioner_name}{a.practitioner_cmp && ` (CMP ${a.practitioner_cmp})`}</p>
                      )}
                      {a.institution && <p>{a.institution}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <MedicalLeavesSection medicalLeaves={medicalLeaves} />

            <ClinicalRecordsSection clinicalRecords={clinicalRecords} />

            <FamilyHistorySection familyHistory={familyHistory} />
          </>
        )}
      </main>

      <footer className="patient-footer">
        <p>© 2026 DoctorData</p>
        <p className="app-footer-links">
          <a href={terminosPdf} target="_blank" rel="noopener noreferrer">Términos y Condiciones</a>
          {' · '}
          <a href={privacidadPdf} target="_blank" rel="noopener noreferrer">Política de Privacidad</a>
        </p>
        {!isDoctor && <DoctorStepUpLogin />}
      </footer>
    </div>
  )
}

// "Soy médico" — re-verificación real (no solo un check pasivo de sesión) para revelar la
// vista médica completa: pide email/contraseña de nuevo aunque ya haya una sesión abierta en
// este dispositivo (por ejemplo, de otro usuario) — sí, es una fricción a propósito. Reusa el
// mismo login real (con su 2FA de dispositivo nuevo) que ya usa Login.jsx — nada de esto
// necesita backend nuevo: en cuanto login()/verifyCode() actualizan el `user` del contexto,
// isDoctor se recalcula solo y la vista médica completa se revela.
function DoctorStepUpLogin() {
  const { login } = useAuth()
  const [open, setOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pendingVerification, setPendingVerification] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if (data.verification_required) {
        setPendingVerification({ email: data.email, reason: data.reason, devCode: data.dev_code })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <p style={{ marginTop: '0.5rem' }}>
        <button type="button" onClick={() => setOpen(true)}
          style={{ background: 'none', border: 'none', padding: 0, color: 'rgba(255,255,255,0.7)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit' }}>
          ¿Eres médico? Inicia sesión para ver el historial completo
        </button>
      </p>
    )
  }

  return (
    <div style={{ marginTop: '0.75rem', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto', textAlign: 'left' }}>
      {pendingVerification ? (
        <VerifyCodeForm
          email={pendingVerification.email}
          reason={pendingVerification.reason}
          devCode={pendingVerification.devCode}
          onVerified={() => setPendingVerification(null)}
        />
      ) : (
        <form onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="form-group">
            <label htmlFor="doctor-step-up-email">Correo electrónico</label>
            <input id="doctor-step-up-email" type="email" value={email} placeholder="tu@correo.com"
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="form-group">
            <label htmlFor="doctor-step-up-password">Contraseña</label>
            <input id="doctor-step-up-password" type="password" value={password} placeholder="Tu contraseña"
              onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
            {loading ? 'Ingresando...' : 'Ingresar como médico'}
          </button>
        </form>
      )}
    </div>
  )
}

function PatientHeader({ doctorView }) {
  return (
    <header className="patient-page-header">
      <Link to="/">
        <img
          src={logo}
          alt="Logotipo Doctor Data"
          title="Doctor Data — inicio"
          className="patient-page-logo"
        />
      </Link>
      {doctorView && <span className="badge badge-doctor" style={{ fontSize: '0.85rem' }}>Vista médica</span>}
    </header>
  )
}

function calculateAge(birthDateStr) {
  const birth = new Date(birthDateStr)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  if (
    now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
  ) age--
  return age
}

// El médico solo lee los descansos médicos (qué entidad los emitió, por qué) — nunca los
// escribe. Son datos del paciente; se registran/editan desde /clinical (ClinicalInfo.jsx).
function MedicalLeavesSection({ medicalLeaves }) {
  return (
    <div className="patient-section">
      <h2>Descansos médicos</h2>
      {medicalLeaves.length === 0 ? (
        <p className="empty-state-inline">Sin descansos registrados</p>
      ) : (
        <div className="record-list">
          {medicalLeaves.map((l) => (
            <div key={l.id} className="record-card">
              <div style={{ flex: 1 }}>
                <strong>{l.diagnosis_display}</strong>
                {l.diagnosis_code && <span className="badge">{l.diagnosis_code}</span>}
                <span className="badge">{l.days_count} días</span>
                <p>{new Date(l.start_date).toLocaleDateString('es-PE')} → {new Date(l.end_date).toLocaleDateString('es-PE')}</p>
                {l.institution && <p>{l.institution}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// El médico solo lee los registros clínicos (igual que los descansos médicos arriba) — nunca
// los escribe. Son datos del paciente; se registran/editan desde /clinical (ClinicalInfo.jsx).
function ClinicalRecordsSection({ clinicalRecords }) {
  return (
    <div className="patient-section">
      <h2>Registros clínicos</h2>
      {clinicalRecords.length === 0 ? (
        <p className="empty-state-inline">Sin registros clínicos</p>
      ) : (
        <div className="record-list">
          {clinicalRecords.slice(0, 10).map((r) => (
            <div key={r.id} className="record-card">
              <div style={{ flex: 1 }}>
                <strong>{r.display_name}</strong>
                <span className="badge">{label(RECORD_TYPE_ES, r.record_type)}</span>
                {r.loinc_code && <span className="badge">{r.loinc_code}</span>}
                {r.status && <span className="badge">{label(RECORD_STATUS_ES, r.status)}</span>}
                {r.effective_date && <span>{new Date(r.effective_date).toLocaleDateString('es-PE')}</span>}
                {r.value_string && <p>{r.value_string}</p>}
                {r.value_quantity && <p>{r.value_quantity} {r.value_unit}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Antecedentes familiares — solo lectura para el médico, igual que el resto de esta vista.
function FamilyHistorySection({ familyHistory }) {
  return (
    <div className="patient-section">
      <h2>Antecedentes familiares</h2>
      {familyHistory.length === 0 ? (
        <p className="empty-state-inline">Sin antecedentes familiares registrados</p>
      ) : (
        <div className="record-list">
          {familyHistory.map((f) => (
            <div key={f.id} className="record-card">
              <div style={{ flex: 1 }}>
                <strong>{f.condition}</strong>
                <span className="badge">{f.relationship}</span>
                {f.notes && <p>{f.notes}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
