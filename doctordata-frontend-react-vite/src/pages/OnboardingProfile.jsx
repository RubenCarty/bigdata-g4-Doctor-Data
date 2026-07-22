import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi, patientApi, memberApi } from '../services/api'
import CapacityMeter from '../components/CapacityMeter'
import AppFooter from '../components/AppFooter'
import CropModal from '../components/CropModal'
import LifeStatusControls from '../components/LifeStatusControls'
import { filterNameInput, filterDigits } from '../utils/personFieldFilters'
import logo from '../assets/images/Doctor_Data_logo.png'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const GENDERS = [
  { value: '', label: 'Seleccionar' },
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'unknown', label: 'Prefiero no indicar' },
]
const BLOOD_TYPES = ['', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']
const DOC_TYPES = ['', 'DNI', 'PASSPORT', 'CIP', 'CE']
// Sugerencias comunes en Perú — texto libre (datalist), no una lista cerrada.
const HEALTH_INSURANCE_SUGGESTIONS = ['EsSalud', 'SIS', 'Rimac', 'Pacífico', 'Mapfre', 'La Positiva', 'Sanitas', 'Ninguno']

const EMPTY_PERSON = {
  first_name: '', last_name: '', birth_date: '', gender: '', phone: '', email: '',
  document_type: '', document_number: '', blood_type: '', health_insurance: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
}

// showEmail — solo tiene sentido para personas cubiertas: sirve para poder nombrarlas médico
// después (ver botón "Nombrar médico" más abajo). El propio titular ya tiene su email de
// cuenta, así que su formulario (ownForm) no lo muestra.
function PersonFields({ form, onChange, showEmail }) {
  function set(field, value) { onChange({ ...form, [field]: value }) }
  return (
    <>
      <div className="profile-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Nombres *</label>
          <input type="text" value={form.first_name} onChange={(e) => set('first_name', filterNameInput(e.target.value))} required />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Apellidos *</label>
          <input type="text" value={form.last_name} onChange={(e) => set('last_name', filterNameInput(e.target.value))} required />
        </div>
      </div>
      <div className="profile-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Fecha de nacimiento</label>
          <input type="date" value={form.birth_date} onChange={(e) => set('birth_date', e.target.value)} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Género</label>
          <select className="form-select" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
            {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Grupo sanguíneo</label>
          <select className="form-select" value={form.blood_type} onChange={(e) => set('blood_type', e.target.value)}>
            {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t || 'Desconocido'}</option>)}
          </select>
        </div>
      </div>
      <div className="profile-row">
        <div className="form-group" style={{ flex: 0.5 }}>
          <label>Tipo de documento</label>
          <select className="form-select" value={form.document_type} onChange={(e) => set('document_type', e.target.value)}>
            {DOC_TYPES.map((t) => <option key={t} value={t}>{t || 'Seleccionar'}</option>)}
          </select>
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Número de documento</label>
          <input type="text" value={form.document_number}
            maxLength={form.document_type === 'DNI' ? 8 : 15}
            onChange={(e) => set('document_number', form.document_type === 'DNI'
              ? filterDigits(e.target.value, 8)
              : e.target.value.slice(0, 15))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Teléfono</label>
          <input type="tel" value={form.phone} maxLength={9}
            onChange={(e) => set('phone', filterDigits(e.target.value, 9))} />
        </div>
      </div>
      {showEmail && (
        <div className="profile-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label>Correo electrónico</label>
            <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)}
              placeholder="Necesario para poder nombrarla médico más adelante" />
          </div>
        </div>
      )}
      <div className="profile-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Seguro de salud</label>
          <input type="text" list="health-insurance-options" value={form.health_insurance}
            onChange={(e) => set('health_insurance', e.target.value)}
            placeholder="EsSalud, SIS, Rimac..." />
          <datalist id="health-insurance-options">
            {HEALTH_INSURANCE_SUGGESTIONS.map((h) => <option key={h} value={h} />)}
          </datalist>
        </div>
      </div>
      <div className="profile-row">
        <div className="form-group" style={{ flex: 1 }}>
          <label>Contacto de emergencia</label>
          <input type="text" value={form.emergency_contact_name}
            onChange={(e) => set('emergency_contact_name', filterNameInput(e.target.value))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Teléfono de emergencia</label>
          <input type="tel" value={form.emergency_contact_phone} maxLength={9}
            onChange={(e) => set('emergency_contact_phone', filterDigits(e.target.value, 9))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Parentesco / relación</label>
          <input type="text" value={form.emergency_contact_relationship}
            onChange={(e) => set('emergency_contact_relationship', e.target.value)} placeholder="Ej. Madre, esposo, hijo" />
        </div>
      </div>
    </>
  )
}

export default function OnboardingProfile() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [capacity, setCapacity] = useState(null)
  const [ownForm, setOwnForm] = useState(EMPTY_PERSON)
  const [ownSaved, setOwnSaved] = useState(false)
  const [savingOwn, setSavingOwn] = useState(false)

  const [members, setMembers] = useState([])
  const [memberForm, setMemberForm] = useState(EMPTY_PERSON)
  const [editingMemberId, setEditingMemberId] = useState(null) // null = agregando; id = editando
  const [addingMember, setAddingMember] = useState(false)
  const [showMemberForm, setShowMemberForm] = useState(false)
  const [error, setError] = useState('')

  const [memberPhotoPreview, setMemberPhotoPreview] = useState(null)
  const [memberPhotoFile, setMemberPhotoFile] = useState(null)
  const [memberCropSrc, setMemberCropSrc] = useState(null)
  const [uploadingMemberPhoto, setUploadingMemberPhoto] = useState(false)
  const [memberLifeStatus, setMemberLifeStatus] = useState('')
  const memberPhotoRef = useRef()
  const [nominatingId, setNominatingId] = useState(null)
  const [nominateMsg, setNominateMsg] = useState('')

  const loadCapacity = useCallback(() => {
    billingApi.getMyCapacity().then((r) => setCapacity(r.data)).catch(() => {})
  }, [])

  const loadMembers = useCallback(() => {
    memberApi.list().then((r) => setMembers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    loadCapacity()
    loadMembers()
    patientApi.getMyProfile()
      .then((r) => {
        const p = r.data
        setOwnForm({
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          birth_date: p.birth_date ? p.birth_date.substring(0, 10) : '',
          gender: p.gender ?? '',
          phone: p.phone ?? '',
          document_type: p.document_type ?? '',
          document_number: p.document_number ?? '',
          blood_type: p.blood_type ?? '',
          health_insurance: p.health_insurance ?? '',
          emergency_contact_name: p.emergency_contact_name ?? '',
          emergency_contact_phone: p.emergency_contact_phone ?? '',
          emergency_contact_relationship: p.emergency_contact_relationship ?? '',
        })
        if (p.first_name) setOwnSaved(true)
      })
      .catch(() => {})
  }, [loadCapacity, loadMembers])

  // Mientras el webhook confirma el pago, la capacidad total llega en 0 — se reintenta.
  useEffect(() => {
    if (capacity && capacity.total_capacity > 0) return
    const t = setTimeout(loadCapacity, 3000)
    return () => clearTimeout(t)
  }, [capacity, loadCapacity])

  async function saveOwnProfile(e) {
    e.preventDefault()
    setSavingOwn(true)
    setError('')
    try {
      await patientApi.updateMyProfile(ownForm)
      setOwnSaved(true)
      loadCapacity()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar tus datos.')
    } finally {
      setSavingOwn(false)
    }
  }

  function openAddMember() {
    setMemberForm(EMPTY_PERSON)
    setEditingMemberId(null)
    setMemberPhotoPreview(null)
    setMemberPhotoFile(null)
    setShowMemberForm(true)
  }

  function openEditMember(m) {
    setMemberForm({
      first_name: m.first_name ?? '', last_name: m.last_name ?? '',
      birth_date: m.birth_date ? m.birth_date.substring(0, 10) : '',
      gender: m.gender ?? '', phone: m.phone ?? '', email: m.email ?? '',
      document_type: m.document_type ?? '', document_number: m.document_number ?? '',
      blood_type: m.blood_type ?? '', health_insurance: m.health_insurance ?? '',
      emergency_contact_name: m.emergency_contact_name ?? '',
      emergency_contact_phone: m.emergency_contact_phone ?? '',
      emergency_contact_relationship: m.emergency_contact_relationship ?? '',
    })
    setEditingMemberId(m.id)
    setMemberPhotoPreview(m.profile_photo_url ? API_BASE + m.profile_photo_url : null)
    setMemberPhotoFile(null)
    setMemberLifeStatus(m.life_status ?? '')
    setShowMemberForm(true)
  }

  function closeMemberForm() {
    setShowMemberForm(false)
    setEditingMemberId(null)
    setMemberForm(EMPTY_PERSON)
    setMemberPhotoPreview(null)
    setMemberPhotoFile(null)
    setMemberCropSrc(null)
    setMemberLifeStatus('')
  }

  async function changeMemberLifeStatus(status) {
    if (!editingMemberId) return
    try {
      await memberApi.updateLifeStatus(editingMemberId, status)
      setMemberLifeStatus(status)
      loadMembers()
    } catch {
      setError('Error al actualizar el estado.')
    }
  }

  function openMemberCrop(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setMemberCropSrc(URL.createObjectURL(file))
  }

  function handleMemberCropConfirm(blob) {
    const url = URL.createObjectURL(blob)
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
    setMemberPhotoPreview(url)
    setMemberPhotoFile(file)
    setMemberCropSrc(null)
  }

  async function uploadMemberPhoto() {
    if (!memberPhotoFile || !editingMemberId) return
    setUploadingMemberPhoto(true)
    setError('')
    try {
      await memberApi.uploadPhoto(editingMemberId, memberPhotoFile)
      setMemberPhotoFile(null)
      loadMembers()
    } catch {
      setError('Error al subir la foto.')
    } finally {
      setUploadingMemberPhoto(false)
    }
  }

  async function saveMember(e) {
    e.preventDefault()
    setAddingMember(true)
    setError('')
    try {
      if (editingMemberId) await memberApi.update(editingMemberId, memberForm)
      else await memberApi.create(memberForm)
      closeMemberForm()
      loadMembers()
      loadCapacity()
    } catch (err) {
      setError(err.response?.data?.error === 'capacity_exceeded'
        ? 'Ya alcanzaste el límite de personas de tus suscripciones.'
        : (err.response?.data?.error || 'Error al guardar la persona.'))
    } finally {
      setAddingMember(false)
    }
  }

  async function removeMember(id) {
    if (!confirm('¿Quitar a esta persona de tu grupo cubierto?')) return
    setError('')
    try {
      await memberApi.remove(id)
      loadMembers()
      loadCapacity()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al quitar a la persona.')
    }
  }

  // Le crea una cuenta real a la persona cubierta para que pueda iniciar sesión como médico —
  // no le da is_doctor de inmediato, solo acceso para completar su perfil y ser validada por
  // un admin (ver comentario en NominateDoctor en el backend).
  async function nominateDoctor(m) {
    if (!confirm(`¿Nombrar médico a ${m.first_name}? Le enviaremos un correo a ${m.email} para que defina su propia contraseña y pueda iniciar sesión.`)) return
    setNominatingId(m.id)
    setNominateMsg('')
    setError('')
    try {
      await memberApi.nominateDoctor(m.id)
      setNominateMsg(`Le enviamos un correo a ${m.email} para que active su cuenta de médico.`)
      loadMembers()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al nombrar médico.')
    } finally {
      setNominatingId(null)
    }
  }

  const confirming = !capacity || capacity.total_capacity === 0
  const atCapacity = capacity && capacity.used_capacity >= capacity.total_capacity
  const coveredMembers = members.filter((m) => m.user_id !== user?.id)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" />
        <div className="header-actions"><span>{user?.email}</span></div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Completa tus datos</h2>
          <p className="page-subtitle">Registra tu perfil y el de las personas que cubre tu suscripción.</p>
        </div>

        {confirming && (
          <div className="alert alert-info">Confirmando tu pago... esto puede tardar unos segundos.</div>
        )}

        {!confirming && (
          <>
            <div style={{ marginBottom: '1.5rem', maxWidth: 400 }}>
              <CapacityMeter used={capacity.used_capacity} total={capacity.total_capacity} />
            </div>

            {error && <div className="alert alert-error">{error}</div>}
            {nominateMsg && <div className="alert alert-info">{nominateMsg}</div>}

            <div className="profile-section-title">Tus datos</div>
            <form onSubmit={saveOwnProfile} style={{ maxWidth: 700 }}>
              <PersonFields form={ownForm} onChange={setOwnForm} />
              <button type="submit" className="btn btn-primary" disabled={savingOwn}>
                {savingOwn ? 'Guardando...' : ownSaved ? 'Actualizar mis datos' : 'Guardar mis datos'}
              </button>
            </form>

            <div className="profile-section-title">Personas cubiertas</div>
            {/* memberApi.list() incluye también el perfil propio del titular (user_id === el
                propio) — se excluye acá porque "tus datos" ya se muestra arriba. Ojo: no
                alcanza con "!m.user_id" — una persona cubierta nombrada médico también tiene
                user_id propio (el suyo, no el del titular) y debe seguir apareciendo acá. */}
            {coveredMembers.length === 0 && (
              <p className="empty-state-inline">Aún no agregaste a nadie más.</p>
            )}
            {coveredMembers.length > 0 && (
              <div className="record-list" style={{ marginBottom: '1rem' }}>
                {coveredMembers.map((m) => (
                  <div key={m.id} className="record-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1 }}>
                      {m.profile_photo_url
                        ? <img src={API_BASE + m.profile_photo_url} alt={m.first_name}
                            style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                        : <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--bg-muted, #eee)' }} />}
                      <strong>{m.first_name} {m.last_name}</strong>
                    </div>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {m.email && !m.user_id && (
                        <button type="button" className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }}
                          disabled={nominatingId === m.id} onClick={() => nominateDoctor(m)}>
                          {nominatingId === m.id ? 'Enviando...' : 'Nombrar médico'}
                        </button>
                      )}
                      <button type="button" className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => openEditMember(m)}>Editar</button>
                      <button type="button" className="btn" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => removeMember(m.id)}>Quitar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!showMemberForm && !atCapacity && (
              <button type="button" className="btn btn-outline" onClick={openAddMember}>
                + Agregar persona cubierta
              </button>
            )}
            {atCapacity && <p className="empty-state-inline">Ya registraste a todas las personas de tu capacidad comprada.</p>}

            {showMemberForm && (
              <form onSubmit={saveMember} className="clinical-form" style={{ maxWidth: 700, marginTop: '1rem' }}>
                {!editingMemberId && (
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    Podrás agregar una foto después de guardar, desde "Editar".
                  </p>
                )}
                {editingMemberId && (
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.25rem' }}>
                    <div
                      className="upload-preview"
                      onClick={() => memberPhotoRef.current.click()}
                      title="Seleccionar foto"
                      style={{ cursor: 'pointer' }}
                    >
                      {memberPhotoPreview
                        ? <img src={memberPhotoPreview} alt="Foto" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                        : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '0 0.5rem' }}>Haz clic para<br />seleccionar foto</span>}
                    </div>
                    <div>
                      <input ref={memberPhotoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={openMemberCrop} />
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => memberPhotoRef.current.click()}>
                          {memberPhotoPreview ? 'Cambiar foto' : 'Seleccionar foto'}
                        </button>
                        {memberPhotoFile && (
                          <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={uploadMemberPhoto} disabled={uploadingMemberPhoto}>
                            {uploadingMemberPhoto ? 'Guardando...' : 'Guardar foto'}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                {editingMemberId && (
                  <div style={{ marginBottom: '1.25rem' }}>
                    <LifeStatusControls status={memberLifeStatus} onChange={changeMemberLifeStatus}
                      personLabel={memberForm.first_name || 'esta persona'} />
                  </div>
                )}
                <PersonFields form={memberForm} onChange={setMemberForm} showEmail />
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button type="submit" className="btn btn-primary" disabled={addingMember}>
                    {addingMember ? 'Guardando...' : editingMemberId ? 'Actualizar' : 'Agregar'}
                  </button>
                  <button type="button" className="btn btn-outline" onClick={closeMemberForm}>Cancelar</button>
                </div>
              </form>
            )}

            {memberCropSrc && (
              <CropModal
                src={memberCropSrc} aspect={3 / 4}
                title="Ajustar foto"
                hint="Arrastra para posicionar · rueda del ratón o deslizador para hacer zoom"
                onConfirm={handleMemberCropConfirm}
                onCancel={() => setMemberCropSrc(null)}
              />
            )}

            {ownSaved && (
              <div style={{ marginTop: '2rem' }}>
                <button className="btn btn-primary" onClick={() => navigate('/dashboard')}>Ir al dashboard</button>
              </div>
            )}
          </>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
