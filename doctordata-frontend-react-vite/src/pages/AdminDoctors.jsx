import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080'

const STATUS_TABS = [
  { key: '',         label: 'Todos' },
  { key: 'pending',  label: 'En revisión' },
  { key: 'approved', label: 'Aprobados' },
  { key: 'rejected', label: 'Rechazados' },
]

const STATUS_STYLES = {
  pending:  { color: '#b45309', bg: '#fef3c7', label: 'En revisión' },
  approved: { color: '#166534', bg: '#dcfce7', label: 'Aprobado' },
  rejected: { color: '#991b1b', bg: '#fee2e2', label: 'Rechazado' },
}

export default function AdminDoctors() {
  const { user } = useAuth()
  const [tab, setTab] = useState('pending')
  const [doctors, setDoctors] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null) // doctor en el modal
  const [notes, setNotes] = useState('')
  const [acting, setActing] = useState(false)
  const [msg, setMsg] = useState('')

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listDoctors(tab)
      .then((r) => setDoctors(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [tab])

  useEffect(() => { reload() }, [reload])

  async function validate(action) {
    if (!selected) return
    setActing(true)
    try {
      await adminApi.validateDoctor(selected.id, action, notes)
      setMsg(action === 'approve' ? '✓ Médico aprobado.' : '✗ Médico rechazado.')
      setSelected(null)
      setNotes('')
      reload()
    } catch (err) {
      setMsg(err.response?.data?.error || 'Error al validar.')
    } finally { setActing(false) }
  }

  function fmt(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-PE')
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard">
          <img src={logo} alt="Logotipo Doctor Data" title="Volver al inicio"
            className="dashboard-header-logo" />
        </Link>
        <div className="header-actions">
          <span>{user?.email}</span>
          <span className="badge badge-admin">Admin</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>
            ← Dashboard
          </Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Médicos pendientes de validación</h2>
          <p className="page-subtitle">
            Revisa los datos del carné CMP y aprueba o rechaza cada solicitud.
          </p>
        </div>

        {msg && (
          <div className="alert alert-info" style={{ marginBottom: '1rem' }}>
            {msg}
          </div>
        )}

        <div className="tabs" style={{ marginBottom: '1.25rem' }}>
          {STATUS_TABS.map((t) => (
            <button key={t.key} className={`tab ${tab === t.key ? 'tab-active' : ''}`}
              onClick={() => { setTab(t.key); setMsg('') }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading && <div className="loading">Cargando...</div>}

        {!loading && doctors.length === 0 && (
          <div className="empty-state">No hay solicitudes en esta categoría.</div>
        )}

        {!loading && doctors.length > 0 && (
          <div className="record-list">
            {doctors.map((d) => {
              const st = STATUS_STYLES[d.validation_status] ?? STATUS_STYLES.pending
              return (
                <div key={d.id} className="record-card doctor-card">
                  {/* Fotos */}
                  <div style={{ display: 'flex', gap: '1rem', marginBottom: '0.75rem' }}>
                    <div style={{ width: 72, height: 90, flexShrink: 0 }}>
                      {d.profile_photo_url
                        ? <img src={API_BASE + d.profile_photo_url} alt="Foto personal"
                            style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                        : <div style={{ width: '100%', height: '100%', background: '#f3f4f6', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem' }}>👤</div>}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1.05rem' }}>{d.last_name}, {d.first_name}</strong>
                        <span style={{ background: st.bg, color: st.color, borderRadius: '6px', padding: '0.15rem 0.5rem', fontSize: '0.78rem', fontWeight: 600 }}>
                          {st.label}
                        </span>
                      </div>
                      <p style={{ margin: '0.15rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{d.email}</p>
                      <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '0.4rem', fontSize: '0.85rem' }}>
                        <span><strong>CMP:</strong> {d.cmp_number || '—'}</span>
                        <span><strong>Expedición:</strong> {fmt(d.expedition_date)}</span>
                        <span><strong>Revalidación:</strong> {fmt(d.revalidation_date)}</span>
                      </div>
                      {(d.specialty || d.position || d.institution) && (
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          {[d.specialty, d.position, d.institution].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      {d.validation_notes && (
                        <p style={{ margin: '0.3rem 0 0', fontSize: '0.82rem', color: '#991b1b' }}>
                          Nota: {d.validation_notes}
                        </p>
                      )}
                    </div>
                    {/* Foto carné */}
                    {d.cmp_card_url && (
                      <a href={API_BASE + d.cmp_card_url} target="_blank" rel="noreferrer"
                        style={{ display: 'block', width: 140, flexShrink: 0 }}>
                        <img src={API_BASE + d.cmp_card_url} alt="Carné CMP"
                          style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: '6px', border: '1px solid #e5e7eb' }} />
                        <p style={{ textAlign: 'center', fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Ver carné completo</p>
                      </a>
                    )}
                  </div>

                  {/* Acciones */}
                  {d.validation_status !== 'approved' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-primary" style={{ fontSize: '0.8rem', padding: '0.3rem 0.9rem', background: 'var(--green)', borderColor: 'var(--green)' }}
                        onClick={() => { setSelected(d); setNotes('') }}>
                        Revisar
                      </button>
                    </div>
                  )}
                  {d.validation_status === 'approved' && (
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button className="btn btn-outline" style={{ fontSize: '0.8rem', padding: '0.3rem 0.9rem', color: '#991b1b', borderColor: '#fca5a5' }}
                        onClick={() => { setSelected(d); setNotes('') }}>
                        Revocar aprobación
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Modal de validación */}
        {selected && (
          <div className="modal-backdrop" onClick={() => setSelected(null)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginBottom: '0.5rem' }}>
                {selected.last_name}, {selected.first_name}
              </h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                CMP {selected.cmp_number} · {selected.email}
              </p>

              {selected.cmp_card_url && (
                <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
                  <img src={API_BASE + selected.cmp_card_url} alt="Carné CMP"
                    style={{ maxWidth: '100%', maxHeight: 220, objectFit: 'contain', borderRadius: '8px', border: '1px solid #e5e7eb' }} />
                </div>
              )}

              <div className="form-group">
                <label>Nota (opcional)</label>
                <input value={notes} onChange={(e) => setNotes(e.target.value)}
                  placeholder="Motivo del rechazo o comentario de aprobación..." />
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" disabled={acting}
                  style={{ background: 'var(--green)', borderColor: 'var(--green)' }}
                  onClick={() => validate('approve')}>
                  {acting ? 'Procesando...' : '✓ Aprobar'}
                </button>
                <button className="btn" disabled={acting}
                  style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                  onClick={() => validate('reject')}>
                  ✗ Rechazar
                </button>
                <button className="btn btn-outline" onClick={() => setSelected(null)}>Cancelar</button>
              </div>
            </div>
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
