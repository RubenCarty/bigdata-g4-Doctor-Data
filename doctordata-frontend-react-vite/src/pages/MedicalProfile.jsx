import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { medicalApi } from '../services/api'
import CropModalShared from '../components/CropModal'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const STATUS_LABELS = {
  pending:  { label: 'En revisión',  color: '#b45309', bg: '#fef3c7' },
  approved: { label: 'Aprobado',     color: '#166534', bg: '#dcfce7' },
  rejected: { label: 'Rechazado',    color: '#991b1b', bg: '#fee2e2' },
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function MedicalProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [msg, setMsg]         = useState({ type: '', text: '' })
  const [isNew, setIsNew]     = useState(false)

  const [form, setForm] = useState({
    first_name: '', last_name: '', cmp_number: '',
    expedition_date: '', revalidation_date: '',
    specialty: '', position: '', institution: '',
  })

  const [photoPreview, setPhotoPreview] = useState(null)
  const [cardPreview,  setCardPreview]  = useState(null)
  const [photoFile, setPhotoFile] = useState(null)
  const [cardFile,  setCardFile]  = useState(null)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [uploadingCard,  setUploadingCard]  = useState(false)
  const [cropModal, setCropModal] = useState(null) // { src, type }

  const photoRef = useRef()
  const cardRef  = useRef()

  useEffect(() => {
    medicalApi.getMyMedicalProfile()
      .then((r) => {
        const p = r.data
        setProfile(p)
        setForm({
          first_name:        p.first_name        ?? '',
          last_name:         p.last_name         ?? '',
          cmp_number:        p.cmp_number        ?? '',
          expedition_date:   p.expedition_date   ? p.expedition_date.substring(0,10)   : '',
          revalidation_date: p.revalidation_date ? p.revalidation_date.substring(0,10) : '',
          specialty:         p.specialty         ?? '',
          position:          p.position          ?? '',
          institution:       p.institution       ?? '',
        })
        if (p.profile_photo_url) setPhotoPreview(API_BASE + p.profile_photo_url)
        if (p.cmp_card_url)      setCardPreview(API_BASE + p.cmp_card_url)
      })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false))
  }, [])

  function setField(f, v) { setForm(p => ({ ...p, [f]: v })) }

  function openCrop(e, type) {
    const file = e.target.files[0]
    if (!file) return
    e.target.value = ''
    setCropModal({ src: URL.createObjectURL(file), type })
  }

  function handleCropConfirm(blob) {
    const isPhoto = cropModal.type === 'photo'
    const url  = URL.createObjectURL(blob)
    const file = new File([blob], isPhoto ? 'photo.jpg' : 'card.jpg', { type: 'image/jpeg' })
    if (isPhoto) { setPhotoPreview(url); setPhotoFile(file) }
    else          { setCardPreview(url);  setCardFile(file)  }
    setCropModal(null)
  }

  async function uploadPhoto() {
    if (!photoFile) return
    setUploadingPhoto(true)
    try {
      await medicalApi.uploadProfilePhoto(photoFile)
      setPhotoFile(null)
      setMsg({ type:'ok', text:'Foto personal guardada.' })
    } catch { setMsg({ type:'err', text:'Error al subir la foto personal.' }) }
    finally  { setUploadingPhoto(false) }
  }

  async function uploadCard() {
    if (!cardFile) return
    setUploadingCard(true)
    try {
      await medicalApi.uploadCMPCard(cardFile)
      setCardFile(null)
      setMsg({ type:'ok', text:'Carné CMP guardado.' })
    } catch { setMsg({ type:'err', text:'Error al subir el carné CMP.' }) }
    finally  { setUploadingCard(false) }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.first_name.trim() || !form.last_name.trim() || !form.cmp_number.trim()) {
      setMsg({ type:'err', text:'Apellidos, nombres y número de colegiatura son obligatorios.' })
      return
    }
    setSaving(true); setMsg({ type:'', text:'' })
    try {
      await medicalApi.updateMyMedicalProfile(form)
      const r = await medicalApi.getMyMedicalProfile()
      setProfile(r.data); setIsNew(false)
      setMsg({ type:'ok', text: isNew
        ? 'Solicitud enviada. Un administrador revisará tus datos y los corroborará con el carné que subiste.'
        : 'Datos actualizados. Tu solicitud vuelve a estado "En revisión".' })
    } catch (err) {
      setMsg({ type:'err', text: err.response?.data?.error || 'Error al guardar.' })
    } finally { setSaving(false) }
  }

  const canEdit = isNew || !profile || profile.validation_status !== 'approved'
  const status  = profile ? STATUS_LABELS[profile.validation_status] : null

  if (loading) return (
    <div className="dashboard">
      <MedHeader user={user} />
      <main className="dashboard-content"><div className="loading">Cargando...</div></main>
    </div>
  )

  return (
    <div className="dashboard">
      <MedHeader user={user} />

      <main className="dashboard-content">
        <div style={{ marginBottom:'1.25rem' }}>
          <h2 style={{ marginBottom:'0.2rem' }}>Perfil de profesional de la salud</h2>
          <p className="page-subtitle">Registra los datos de tu carné del Colegio Médico del Perú (CMP).</p>
        </div>

        {status && (
          <div style={{ display:'inline-flex', alignItems:'center', gap:'0.5rem', background:status.bg, color:status.color, borderRadius:'8px', padding:'0.5rem 1rem', fontWeight:600, marginBottom:'1.25rem', fontSize:'0.9rem' }}>
            {profile.validation_status === 'pending'  && '⏳ '}
            {profile.validation_status === 'approved' && '✓ '}
            {profile.validation_status === 'rejected' && '✗ '}
            {status.label}
            {profile.validation_notes && <span style={{ fontWeight:400 }}>— {profile.validation_notes}</span>}
          </div>
        )}

        <div className="alert alert-info" style={{ marginBottom:'1.5rem' }}>
          <strong>Registro manual:</strong> Los datos que ingreses serán corroborados manualmente
          con el carné que subas. El acceso como profesional de salud se habilitará una vez
          que un administrador valide tu información.
        </div>

        {/* Fotografías */}
        <div className="profile-section-title">Fotografías</div>
        <div style={{ display:'flex', gap:'2rem', flexWrap:'wrap', marginBottom:'1.5rem', alignItems:'flex-start' }}>

          {/* Foto personal (3:4 — retrato) */}
          <div className="upload-card">
            <p style={{ fontWeight:600, marginBottom:'0.5rem' }}>Foto personal *</p>
            <div className="upload-preview" onClick={() => photoRef.current.click()} title="Seleccionar foto">
              {photoPreview
                ? <img src={photoPreview} alt="Foto personal" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'6px' }} />
                : <span style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'0 0.5rem' }}>Haz clic para<br />seleccionar foto</span>}
            </div>
            <input ref={photoRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => openCrop(e, 'photo')} />
            <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.5rem' }}>
              <button className="btn btn-outline" style={{ fontSize:'0.78rem', padding:'0.25rem 0.7rem' }} onClick={() => photoRef.current.click()}>
                {photoPreview ? 'Cambiar' : 'Seleccionar'}
              </button>
              {photoFile && (
                <button className="btn btn-primary" style={{ fontSize:'0.78rem', padding:'0.25rem 0.7rem' }} onClick={uploadPhoto} disabled={uploadingPhoto}>
                  {uploadingPhoto ? 'Guardando...' : 'Guardar foto'}
                </button>
              )}
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.4rem' }}>Cualquier formato de imagen</p>
          </div>

          {/* Carné CMP (apaisado — proporción tarjeta ID) */}
          <div className="upload-card">
            <p style={{ fontWeight:600, marginBottom:'0.5rem' }}>Foto del carné CMP *</p>
            <div className="upload-preview upload-preview-wide" onClick={() => cardRef.current.click()} title="Seleccionar carné">
              {cardPreview
                ? <img src={cardPreview} alt="Carné CMP" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'6px' }} />
                : <span style={{ color:'var(--text-muted)', fontSize:'0.82rem', textAlign:'center', padding:'0 0.5rem' }}>Haz clic para<br />seleccionar el carné</span>}
            </div>
            <input ref={cardRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e => openCrop(e, 'card')} />
            <div style={{ display:'flex', gap:'0.4rem', marginTop:'0.5rem' }}>
              <button className="btn btn-outline" style={{ fontSize:'0.78rem', padding:'0.25rem 0.7rem' }} onClick={() => cardRef.current.click()}>
                {cardPreview ? 'Cambiar' : 'Seleccionar'}
              </button>
              {cardFile && (
                <button className="btn btn-primary" style={{ fontSize:'0.78rem', padding:'0.25rem 0.7rem' }} onClick={uploadCard} disabled={uploadingCard}>
                  {uploadingCard ? 'Guardando...' : 'Guardar carné'}
                </button>
              )}
            </div>
            <p style={{ fontSize:'0.72rem', color:'var(--text-muted)', marginTop:'0.4rem' }}>Foto nítida del carné físico</p>
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ maxWidth:700 }}>
          <div className="profile-section-title">Datos del carné CMP</div>
          <div className="profile-row">
            <div className="form-group" style={{ flex:1 }}>
              <label>Apellidos *</label>
              <input value={form.last_name} onChange={e => setField('last_name', e.target.value)}
                placeholder="Tal como aparecen en el carné" disabled={!canEdit} required />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Nombres *</label>
              <input value={form.first_name} onChange={e => setField('first_name', e.target.value)}
                placeholder="Tal como aparecen en el carné" disabled={!canEdit} required />
            </div>
          </div>
          <div className="profile-row">
            <div className="form-group" style={{ flex:0.6 }}>
              <label>Número de Colegiatura *</label>
              <input value={form.cmp_number} onChange={e => setField('cmp_number', e.target.value)}
                placeholder="Ej.: 111427" disabled={!canEdit} required />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Fecha de Expedición</label>
              <input type="date" value={form.expedition_date} onChange={e => setField('expedition_date', e.target.value)} disabled={!canEdit} />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Fecha de Revalidación</label>
              <input type="date" value={form.revalidation_date} onChange={e => setField('revalidation_date', e.target.value)} disabled={!canEdit} />
            </div>
          </div>

          <div className="profile-section-title">Información adicional</div>
          <div className="profile-row">
            <div className="form-group" style={{ flex:1 }}>
              <label>Especialidad</label>
              <input value={form.specialty} onChange={e => setField('specialty', e.target.value)}
                placeholder="Medicina general, Geriatría, Cardiología..." />
            </div>
            <div className="form-group" style={{ flex:1 }}>
              <label>Puesto</label>
              <input value={form.position} onChange={e => setField('position', e.target.value)}
                placeholder="Médico asistente, Director de Geriatría, Jefe de UCI..." />
            </div>
          </div>
          <div className="form-group">
            <label>Institución actual</label>
            <input value={form.institution} onChange={e => setField('institution', e.target.value)}
              placeholder="Hospital Nacional Arzobispo Loayza, Clínica San Felipe..." />
          </div>

          {profile?.validation_status === 'approved' && (
            <div className="alert alert-info" style={{ marginBottom:'1rem' }}>
              Tu perfil ya está aprobado. Solo puedes editar especialidad, puesto e institución.
            </div>
          )}

          <div style={{ marginTop:'1.5rem' }}>
            <div style={{ display:'flex', gap:'0.75rem', alignItems:'center' }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Enviando...' : isNew ? 'Enviar solicitud' : 'Actualizar datos'}
              </button>
              <Link to="/dashboard" className="btn btn-outline">Cancelar</Link>
            </div>
            {msg.text && (
              <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`} style={{ marginTop:'0.75rem', marginBottom:0 }}>
                {msg.text}
              </div>
            )}
          </div>
        </form>
      </main>

      <AppFooter />

      {cropModal?.type === 'photo' && (
        <CropModalShared src={cropModal.src} aspect={3/4}
          title="Ajustar foto personal"
          hint="Arrastra para posicionar · rueda del ratón o deslizador para hacer zoom"
          onConfirm={handleCropConfirm} onCancel={() => setCropModal(null)} />
      )}
      {cropModal?.type === 'card' && (
        <CropModalShared src={cropModal.src} aspect={85.6/54}
          title="Ajustar foto del carné CMP"
          hint="Arrastra para encuadrar el carné · rueda del ratón o deslizador para ajustar"
          onConfirm={handleCropConfirm} onCancel={() => setCropModal(null)} />
      )}
    </div>
  )
}

function MedHeader({ user }) {
  return (
    <header className="dashboard-header">
      <Link to="/dashboard">
        <img src={logo} alt="Logotipo Doctor Data" title="Volver al inicio" className="dashboard-header-logo" />
      </Link>
      <div className="header-actions">
        <span>{user?.email}</span>
        {user?.is_doctor && <span className="badge badge-doctor">Médico</span>}
        <Link to="/dashboard" className="btn btn-outline" style={{ fontSize:'0.85rem' }}>← Dashboard</Link>
      </div>
    </header>
  )
}
