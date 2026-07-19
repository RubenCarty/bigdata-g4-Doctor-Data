import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { patientApi } from '../services/api'
import CropModal from '../components/CropModal'
import AppFooter from '../components/AppFooter'
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
// Sugerencias comunes en Perú — texto libre (datalist), no una lista cerrada: cualquier
// paciente puede tener un seguro que no esté acá.
const HEALTH_INSURANCE_SUGGESTIONS = ['EsSalud', 'SIS', 'Rimac', 'Pacífico', 'Mapfre', 'La Positiva', 'Sanitas', 'Ninguno']

const EMPTY = {
  first_name: '', last_name: '', birth_date: '', gender: '', phone: '',
  document_type: '', document_number: '',
  address_street: '', address_city: '', address_state: '',
  address_country: 'PE', address_postal_code: '',
  blood_type: '', health_insurance: '', is_smoker: false, is_alcohol_consumer: false,
  has_psychological_conditions: false,
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
}

export default function Profile() {
  const { user } = useAuth()
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState('')
  const [isNew, setIsNew]     = useState(false)
  const [lifeStatus, setLifeStatus] = useState('')

  const [photoPreview, setPhotoPreview] = useState(null)
  const [photoFile, setPhotoFile]       = useState(null)
  const [uploading, setUploading]       = useState(false)
  const [cropSrc, setCropSrc]           = useState(null)
  const photoRef = useRef()

  useEffect(() => {
    patientApi.getMyProfile()
      .then((r) => {
        const p = r.data
        if (p.profile_photo_url) setPhotoPreview(API_BASE + p.profile_photo_url)
        setForm({
          first_name: p.first_name ?? '',
          last_name: p.last_name ?? '',
          birth_date: p.birth_date ? p.birth_date.substring(0, 10) : '',
          gender: p.gender ?? '',
          phone: p.phone ?? '',
          document_type: p.document_type ?? '',
          document_number: p.document_number ?? '',
          address_street: p.address_street ?? '',
          address_city: p.address_city ?? '',
          address_state: p.address_state ?? '',
          address_country: p.address_country ?? 'PE',
          address_postal_code: p.address_postal_code ?? '',
          blood_type: p.blood_type ?? '',
          health_insurance: p.health_insurance ?? '',
          is_smoker: p.is_smoker ?? false,
          is_alcohol_consumer: p.is_alcohol_consumer ?? false,
          has_psychological_conditions: p.has_psychological_conditions ?? false,
          emergency_contact_name: p.emergency_contact_name ?? '',
          emergency_contact_phone: p.emergency_contact_phone ?? '',
          emergency_contact_relationship: p.emergency_contact_relationship ?? '',
        })
        setLifeStatus(p.life_status ?? '')
      })
      .catch((err) => {
        if (err.response?.data?.error === 'no_profile') setIsNew(true)
      })
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function changeLifeStatus(status) {
    try {
      await patientApi.updateLifeStatus(status)
      setLifeStatus(status)
    } catch {
      setError('Error al actualizar el estado.')
    }
  }

  function openCrop(e) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setCropSrc(URL.createObjectURL(file))
  }

  function handleCropConfirm(blob) {
    const url  = URL.createObjectURL(blob)
    const file = new File([blob], 'photo.jpg', { type: 'image/jpeg' })
    setPhotoPreview(url)
    setPhotoFile(file)
    setCropSrc(null)
  }

  async function uploadPhoto() {
    if (!photoFile) return
    setUploading(true)
    try {
      await patientApi.uploadProfilePhoto(photoFile)
      setPhotoFile(null)
      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
    } catch {
      setError('Error al subir la foto.')
    } finally { setUploading(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('Nombre y apellido son obligatorios')
      return
    }
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      await patientApi.updateMyProfile(form)
      setSuccess(true)
      setIsNew(false)
      setTimeout(() => setSuccess(false), 4000)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar el perfil')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="dashboard">
        <ProfileHeader user={user} />
        <main className="dashboard-content">
          <div className="loading">Cargando perfil...</div>
        </main>
      </div>
    )
  }

  return (
    <div className="dashboard">
      <ProfileHeader user={user} />

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Datos personales</h2>
          <p className="page-subtitle">
            {isNew
              ? 'Completa tu perfil para activar el código QR y compartir tu historial médico.'
              : 'Actualiza tu información de paciente.'}
          </p>
        </div>

        {isNew && (
          <div className="alert alert-info" style={{ marginBottom: '1.5rem' }}>
            Aún no tienes perfil de paciente. Completa el formulario para crearlo.
          </div>
        )}

        {!isNew && (
          <div style={{ marginBottom: '1.5rem', maxWidth: 700 }}>
            <LifeStatusControls status={lifeStatus} onChange={changeLifeStatus} personLabel="ti" />
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ maxWidth: 700 }}>
          {/* Foto de perfil */}
          <div className="profile-section-title">Foto de perfil</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '1.25rem', marginBottom: '1.5rem' }}>
            <div
              className="upload-preview"
              onClick={() => photoRef.current.click()}
              title="Seleccionar foto"
              style={{ cursor: 'pointer' }}
            >
              {photoPreview
                ? <img src={photoPreview} alt="Foto de perfil" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px' }} />
                : <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center', padding: '0 0.5rem' }}>Haz clic para<br />seleccionar foto</span>}
            </div>
            <div>
              <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={openCrop} />
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem' }} onClick={() => photoRef.current.click()}>
                  {photoPreview ? 'Cambiar foto' : 'Seleccionar foto'}
                </button>
                {photoFile && (
                  <button type="button" className="btn btn-primary" style={{ fontSize: '0.8rem' }} onClick={uploadPhoto} disabled={uploading}>
                    {uploading ? 'Guardando...' : 'Guardar foto'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>
                Esta foto aparecerá en tu perfil público de emergencia.
              </p>
            </div>
          </div>

          {/* Nombre */}
          <div className="profile-section-title">Identificación</div>
          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="first_name">Nombres *</label>
              <input id="first_name" type="text" value={form.first_name}
                onChange={(e) => set('first_name', filterNameInput(e.target.value))} required />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="last_name">Apellidos *</label>
              <input id="last_name" type="text" value={form.last_name}
                onChange={(e) => set('last_name', filterNameInput(e.target.value))} required />
            </div>
          </div>

          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="birth_date">Fecha de nacimiento</label>
              <input id="birth_date" type="date" value={form.birth_date}
                onChange={(e) => set('birth_date', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="gender">Género</label>
              <select id="gender" value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
                className="form-select">
                {GENDERS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="phone">Teléfono</label>
              <input id="phone" type="tel" value={form.phone} maxLength={9}
                onChange={(e) => set('phone', filterDigits(e.target.value, 9))} placeholder="999999999" />
            </div>
          </div>

          <div className="profile-row">
            <div className="form-group" style={{ flex: 0.5 }}>
              <label htmlFor="document_type">Tipo de documento</label>
              <select id="document_type" value={form.document_type}
                onChange={(e) => set('document_type', e.target.value)}
                className="form-select">
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t || 'Seleccionar'}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="document_number">Número de documento</label>
              <input id="document_number" type="text" value={form.document_number}
                maxLength={form.document_type === 'DNI' ? 8 : 15}
                onChange={(e) => set('document_number', form.document_type === 'DNI'
                  ? filterDigits(e.target.value, 8)
                  : e.target.value.slice(0, 15))} />
            </div>
          </div>

          {/* Dirección */}
          <div className="profile-section-title">Dirección</div>
          <div className="form-group">
            <label htmlFor="address_street">Calle / Av.</label>
            <input id="address_street" type="text" value={form.address_street}
              onChange={(e) => set('address_street', e.target.value)} />
          </div>
          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="address_city">Ciudad</label>
              <input id="address_city" type="text" value={form.address_city}
                onChange={(e) => set('address_city', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="address_state">Región / Departamento</label>
              <input id="address_state" type="text" value={form.address_state}
                onChange={(e) => set('address_state', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 0.6 }}>
              <label htmlFor="address_postal_code">Código postal</label>
              <input id="address_postal_code" type="text" value={form.address_postal_code}
                onChange={(e) => set('address_postal_code', e.target.value)} />
            </div>
          </div>

          {/* Información clínica rápida */}
          <div className="profile-section-title">Información clínica rápida</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Esta información es visible para cualquier médico que escanee tu código QR
            y puede ser crucial en emergencias.
          </p>
          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="blood_type">Grupo sanguíneo</label>
              <select id="blood_type" value={form.blood_type}
                onChange={(e) => set('blood_type', e.target.value)}
                className="form-select">
                {BLOOD_TYPES.map((t) => <option key={t} value={t}>{t || 'Desconocido'}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="health_insurance">Seguro de salud</label>
              <input id="health_insurance" list="health-insurance-options" value={form.health_insurance}
                onChange={(e) => set('health_insurance', e.target.value)}
                placeholder="EsSalud, SIS, Rimac..." />
              <datalist id="health-insurance-options">
                {HEALTH_INSURANCE_SUGGESTIONS.map((h) => <option key={h} value={h} />)}
              </datalist>
            </div>
          </div>

          <div className="profile-checks">
            <label className="check-label">
              <input type="checkbox" checked={form.is_smoker}
                onChange={(e) => set('is_smoker', e.target.checked)} />
              Fumador
            </label>
            <label className="check-label">
              <input type="checkbox" checked={form.is_alcohol_consumer}
                onChange={(e) => set('is_alcohol_consumer', e.target.checked)} />
              Consumo de alcohol
            </label>
            <label className="check-label">
              <input type="checkbox" checked={form.has_psychological_conditions}
                onChange={(e) => set('has_psychological_conditions', e.target.checked)} />
              Presenta condición psicológica o psiquiátrica
            </label>
          </div>

          {/* Contacto de emergencia */}
          <div className="profile-section-title">Contacto de emergencia</div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            A quién debe llamar un médico o paramédico si te encuentran en una emergencia.
            También es visible en tu código QR.
          </p>
          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="emergency_contact_name">Nombre completo</label>
              <input id="emergency_contact_name" type="text" value={form.emergency_contact_name}
                onChange={(e) => set('emergency_contact_name', filterNameInput(e.target.value))} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="emergency_contact_phone">Teléfono</label>
              <input id="emergency_contact_phone" type="tel" value={form.emergency_contact_phone} maxLength={9}
                onChange={(e) => set('emergency_contact_phone', filterDigits(e.target.value, 9))} placeholder="999999999" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="emergency_contact_relationship">Parentesco / relación</label>
              <input id="emergency_contact_relationship" type="text" value={form.emergency_contact_relationship}
                onChange={(e) => set('emergency_contact_relationship', e.target.value)} placeholder="Ej. Madre, esposo, hijo" />
            </div>
          </div>

          <div style={{ marginTop: '2rem' }}>
            <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Guardando...' : isNew ? 'Crear perfil' : 'Actualizar cambios'}
              </button>
              <Link to="/dashboard" className="btn btn-outline">Cancelar</Link>
            </div>
            {success && (
              <div className="alert alert-info" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                Perfil guardado correctamente.
              </div>
            )}
            {error && (
              <div className="alert alert-error" style={{ marginTop: '0.75rem', marginBottom: 0 }}>
                {error}
              </div>
            )}
          </div>
        </form>
      </main>

      <AppFooter />

      {cropSrc && (
        <CropModal
          src={cropSrc} aspect={3 / 4}
          title="Ajustar foto de perfil"
          hint="Arrastra para posicionar · rueda del ratón o deslizador para hacer zoom"
          onConfirm={handleCropConfirm}
          onCancel={() => setCropSrc(null)}
        />
      )}
    </div>
  )
}

function ProfileHeader({ user }) {
  return (
    <header className="dashboard-header">
      <Link to="/dashboard">
        <img src={logo} alt="Logotipo Doctor Data" title="Volver al inicio"
          className="dashboard-header-logo" />
      </Link>
      <div className="header-actions">
        <span>{user?.email}</span>
        <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
          ← Dashboard
        </Link>
      </div>
    </header>
  )
}
