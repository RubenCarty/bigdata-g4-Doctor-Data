import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const ROLE_TABS = [
  { key: '',        label: 'Todos' },
  { key: 'doctor',  label: 'Médicos' },
  { key: 'patient', label: 'Pacientes' },
  { key: 'admin',   label: 'Administradores' },
]

const DOCTOR_STATUS = {
  approved: { label: 'Aprobado',    color: '#166534', bg: '#dcfce7' },
  pending:  { label: 'En revisión', color: '#b45309', bg: '#fef3c7' },
  rejected: { label: 'Rechazado',   color: '#991b1b', bg: '#fee2e2' },
}

export default function AdminUsers() {
  const { user: me } = useAuth()
  const [tab, setTab]         = useState('')
  const [search, setSearch]   = useState('')
  const [users, setUsers]     = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg]         = useState({ type: '', text: '' })
  const [toDelete, setToDelete] = useState(null) // usuario a eliminar (confirm modal)
  const [acting, setActing]   = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listUsers({ role: tab, search })
      .then((r) => setUsers(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar usuarios.' }))
      .finally(() => setLoading(false))
  }, [tab, search])

  useEffect(() => {
    const t = setTimeout(reload, search ? 350 : 0)
    return () => clearTimeout(t)
  }, [reload])

  async function toggleAdmin(u) {
    setActing(true)
    try {
      await adminApi.updateUser(u.id, { is_admin: !u.is_admin })
      setMsg({ type: 'ok', text: u.is_admin ? `${u.email} ya no es administrador.` : `${u.email} ahora es administrador.` })
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al actualizar.' })
    } finally { setActing(false) }
  }

  async function toggleSuperAdmin(u) {
    setActing(true)
    try {
      await adminApi.updateUser(u.id, { is_super_admin: !u.is_super_admin })
      setMsg({ type: 'ok', text: u.is_super_admin ? `${u.email} ya no es super admin.` : `${u.email} ahora es super admin.` })
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al actualizar.' })
    } finally { setActing(false) }
  }

  async function toggleAccounting(u) {
    setActing(true)
    try {
      await adminApi.updateUser(u.id, { is_accounting: !u.is_accounting })
      setMsg({ type: 'ok', text: u.is_accounting ? `${u.email} ya no es Contabilidad.` : `${u.email} ahora es Contabilidad.` })
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al actualizar.' })
    } finally { setActing(false) }
  }

  async function toggleSales(u) {
    setActing(true)
    try {
      await adminApi.updateUser(u.id, { is_sales: !u.is_sales })
      setMsg({ type: 'ok', text: u.is_sales ? `${u.email} ya no es Ventas.` : `${u.email} ahora es Ventas.` })
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al actualizar.' })
    } finally { setActing(false) }
  }

  async function toggleActive(u) {
    setActing(true)
    try {
      await adminApi.updateUser(u.id, { is_active: !u.is_active })
      setMsg({ type: 'ok', text: u.is_active ? `${u.email} desactivado.` : `${u.email} reactivado.` })
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al actualizar.' })
    } finally { setActing(false) }
  }

  async function confirmDelete() {
    if (!toDelete) return
    setActing(true)
    try {
      await adminApi.deleteUser(toDelete.id)
      setMsg({ type: 'ok', text: `${toDelete.email} eliminado.` })
      setToDelete(null)
      reload()
    } catch (e) {
      setMsg({ type: 'err', text: e.response?.data?.error || 'Error al eliminar.' })
      setToDelete(null)
    } finally { setActing(false) }
  }

  function fmt(d) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard">
          <img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" />
        </Link>
        <div className="header-actions">
          <span>{me?.email}</span>
          <span className="badge badge-admin">Admin</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Gestión de usuarios</h2>
          <p className="page-subtitle">Ver, modificar roles y eliminar cuentas del sistema.</p>
        </div>

        {msg.text && (
          <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}
            style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            {msg.text}
            <button onClick={() => setMsg({ type: '', text: '' })} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem' }}>✕</button>
          </div>
        )}

        {/* Filtros */}
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem', alignItems: 'center' }}>
          <div className="tabs" style={{ marginBottom: 0 }}>
            {ROLE_TABS.map((t) => (
              <button key={t.key} className={`tab ${tab === t.key ? 'tab-active' : ''}`}
                onClick={() => { setTab(t.key); setMsg({ type: '', text: '' }) }}>
                {t.label}
              </button>
            ))}
          </div>
          <input
            type="search" placeholder="Buscar por email..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: '1', minWidth: 200, padding: '0.45rem 0.75rem', borderRadius: 8, border: '1px solid var(--border)', fontSize: '0.9rem' }}
          />
        </div>

        {loading && <div className="loading">Cargando...</div>}

        {!loading && users.length === 0 && (
          <div className="empty-state">No hay usuarios en esta categoría.</div>
        )}

        {!loading && users.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table className="admin-users-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Admin</th>
                  <th>Super admin</th>
                  <th>Contabilidad</th>
                  <th>Ventas</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isSelf = u.id === me?.id
                  const ds = u.doctor_status ? DOCTOR_STATUS[u.doctor_status] : null
                  return (
                    <tr key={u.id}>
                      <td>
                        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', alignItems: 'center', marginBottom: '0.2rem' }}>
                          <strong style={{ fontSize: '0.95rem' }}>{u.email}</strong>
                          {u.is_doctor && <span className="badge badge-doctor" style={{ fontSize: '0.7rem' }}>Médico</span>}
                          {!u.is_active && <span style={{ background: '#f3f4f6', color: '#6b7280', borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 600 }}>Inactivo</span>}
                          {isSelf && <span style={{ background: '#e0e7ff', color: '#4338ca', borderRadius: 6, padding: '0.1rem 0.45rem', fontSize: '0.7rem', fontWeight: 600 }}>Tú</span>}
                        </div>
                        {u.patient_name && (
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.1rem 0' }}>
                            Paciente: {u.patient_name}
                          </p>
                        )}
                        {u.doctor_name && (
                          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0.1rem 0' }}>
                            Dr. {u.doctor_name}
                            {u.cmp_number && <> · CMP {u.cmp_number}</>}
                            {ds && <span style={{ marginLeft: '0.5rem', background: ds.bg, color: ds.color, borderRadius: 6, padding: '0.1rem 0.4rem', fontSize: '0.75rem', fontWeight: 600 }}>{ds.label}</span>}
                          </p>
                        )}
                        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                          Registrado el {fmt(u.created_at)}
                        </p>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={u.is_admin} disabled={acting || isSelf || !me?.is_super_admin}
                          onChange={() => toggleAdmin(u)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={u.is_super_admin} disabled={acting || isSelf || !me?.is_super_admin}
                          onChange={() => toggleSuperAdmin(u)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={u.is_accounting} disabled={acting || isSelf || !me?.is_admin}
                          onChange={() => toggleAccounting(u)} />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input type="checkbox" checked={u.is_sales} disabled={acting || isSelf || !me?.is_admin}
                          onChange={() => toggleSales(u)} />
                      </td>
                      <td>
                        {!isSelf && (
                          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }}
                              onClick={() => toggleActive(u)} disabled={acting}>
                              {u.is_active ? 'Desactivar' : 'Reactivar'}
                            </button>
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', color: '#dc2626', borderColor: '#fca5a5' }}
                              onClick={() => { setToDelete(u); setMsg({ type: '', text: '' }) }} disabled={acting}>
                              Eliminar
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      <AppFooter />

      {/* Modal de confirmación de eliminación */}
      {toDelete && (
        <div className="modal-backdrop" onClick={() => setToDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '0.5rem', color: '#dc2626' }}>Eliminar usuario</h3>
            <p style={{ marginBottom: '1.25rem' }}>
              ¿Eliminar la cuenta de <strong>{toDelete.email}</strong>? Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn" style={{ borderColor: '#fca5a5', color: '#dc2626' }}
                onClick={confirmDelete} disabled={acting}>
                {acting ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
              <button className="btn btn-outline" onClick={() => setToDelete(null)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
