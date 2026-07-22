import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auditApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

export default function AdminAuditLog() {
  const { user: me } = useAuth()
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    auditApi.list()
      .then((r) => setEntries(r.data ?? []))
      .catch(() => setError('Error al cargar el audit log.'))
      .finally(() => setLoading(false))
  }, [])

  function fmt(d) {
    return new Date(d).toLocaleString('es-PE', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        <div className="header-actions">
          <span>{me?.email}</span>
          <span className="badge badge-admin">Super admin</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Audit Log</h2>
          <p className="page-subtitle">Actividad del sistema — registros, suscripciones, pacientes agregados y acciones administrativas.</p>
        </div>

        {error && <div className="alert alert-error">{error}</div>}
        {loading && <div className="loading">Cargando...</div>}

        {!loading && entries.length === 0 && <div className="empty-state">Todavía no hay eventos registrados.</div>}

        {!loading && entries.length > 0 && (
          <div className="record-list">
            {entries.map((e) => (
              <div key={e.id} className="record-card">
                <div style={{ flex: 1 }}>
                  <p style={{ margin: 0 }}>{e.description}</p>
                  <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)' }}>{fmt(e.created_at)}</p>
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
