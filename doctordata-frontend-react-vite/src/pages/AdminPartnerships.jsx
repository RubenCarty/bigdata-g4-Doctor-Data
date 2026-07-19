import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const STATUS_LABELS = { pending: 'Pendiente', contacted: 'Contactado', closed: 'Cerrado' }

export default function AdminPartnerships() {
  const { user: me } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listPartnershipRequests()
      .then((r) => setRequests(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar solicitudes.' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  async function setStatus(id, status) {
    try {
      await adminApi.updatePartnershipRequestStatus(id, status)
      reload()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al actualizar.' })
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        <div className="header-actions">
          <span>{me?.email}</span>
          <span className="badge badge-admin">Admin</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Alianzas y convenios</h2>
          <p className="page-subtitle">
            Solicitudes enviadas desde el formulario público del index. Si un convenio
            procede, crea el código de descuento correspondiente en Códigos de descuento.
          </p>
        </div>

        {msg.text && (
          <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}>{msg.text}</div>
        )}

        {loading && <div className="loading">Cargando...</div>}

        {!loading && requests.length === 0 && <div className="empty-state">No hay solicitudes todavía.</div>}

        {!loading && requests.length > 0 && (
          <div className="record-list">
            {requests.map((r) => (
              <div key={r.id} className="record-card" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{r.company_name}</strong>
                  <span className="badge" style={{ marginLeft: '0.5rem' }}>{STATUS_LABELS[r.status] ?? r.status}</span>
                  <p>
                    {r.contact_name} · {r.email}{r.phone && ` · ${r.phone}`}
                    {r.estimated_employees > 0 && ` · ~${r.estimated_employees} empleados`}
                  </p>
                  {r.message && <p style={{ fontStyle: 'italic' }}>“{r.message}”</p>}
                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    Recibido {new Date(r.created_at).toLocaleString('es-PE')}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {r.status !== 'contacted' && (
                    <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => setStatus(r.id, 'contacted')}>
                      Marcar contactado
                    </button>
                  )}
                  {r.status !== 'closed' && (
                    <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => setStatus(r.id, 'closed')}>
                      Cerrar
                    </button>
                  )}
                  {r.status !== 'pending' && (
                    <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => setStatus(r.id, 'pending')}>
                      Reabrir
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
