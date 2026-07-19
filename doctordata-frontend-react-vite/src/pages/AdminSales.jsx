import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

function soles(cents) { return `S/ ${(cents / 100).toFixed(2)}` }
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-PE') : '—' }

const BOLETA_STATUS_ES = { pending: 'Pendiente', sent: 'Enviada' }
const FACTURA_STATUS_ES = { pending: 'Pendiente', sent: 'Enviada', paid: 'Pagada' }

const FACTURA_EMPTY = { invoice_number: '', company_name: '', ruc: '', amount_cents: 0, description: '' }

export default function AdminSales() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState('boletas') // 'boletas' | 'facturas'
  const isAccountingOnly = me?.is_accounting && !me?.is_admin

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        <div className="header-actions">
          <span>{me?.email}</span>
          <span className="badge badge-admin">{isAccountingOnly ? 'Contabilidad' : 'Admin'}</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Boletas y facturas</h2>
          <p className="page-subtitle">
            Boletas: una por cada venta de suscripción, automática — solo falta marcar cuáles
            ya emitió el contador por el portal de SUNAT. Facturas: convenios empresariales,
            se cargan a mano.
          </p>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'boletas' ? 'tab-active' : ''}`} onClick={() => setTab('boletas')}>Boletas</button>
          <button className={`tab ${tab === 'facturas' ? 'tab-active' : ''}`} onClick={() => setTab('facturas')}>Facturas (convenios)</button>
        </div>

        {tab === 'boletas' ? <BoletasTab /> : <FacturasTab />}
      </main>

      <AppFooter />
    </div>
  )
}

function BoletasTab() {
  const [boletas, setBoletas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [msg, setMsg] = useState('')
  const [editingNumber, setEditingNumber] = useState({}) // { [id]: string }

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listBoletas(filter || undefined)
      .then((r) => setBoletas(r.data ?? []))
      .catch(() => setMsg('Error al cargar boletas.'))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(reload, [reload])

  async function markSent(b) {
    try {
      await adminApi.updateBoleta(b.id, { status: 'sent', boleta_number: editingNumber[b.id] || '' })
      reload()
    } catch {
      setMsg('Error al actualizar la boleta.')
    }
  }

  async function markPending(b) {
    try {
      await adminApi.updateBoleta(b.id, { status: 'pending' })
      reload()
    } catch {
      setMsg('Error al actualizar la boleta.')
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', alignItems: 'center' }}>
        <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar:</label>
        <select className="form-select" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todas</option>
          <option value="pending">Pendientes</option>
          <option value="sent">Enviadas</option>
        </select>
      </div>

      {msg && <div className="alert alert-error">{msg}</div>}
      {loading && <div className="loading">Cargando...</div>}
      {!loading && boletas.length === 0 && <div className="empty-state">No hay boletas registradas todavía.</div>}

      {!loading && boletas.length > 0 && (
        <div className="record-list">
          {boletas.map((b) => (
            <div key={b.id} className="record-card" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{soles(b.amount_cents)}</strong>
                <span className={`badge ${b.status === 'sent' ? 'badge-doctor' : ''}`} style={{ marginLeft: '0.5rem' }}>
                  {BOLETA_STATUS_ES[b.status] ?? b.status}
                </span>
                <p>{b.patient_name || 'Sin registrar'} (DNI {b.patient_document_number || '—'}) · {b.user?.email} · {b.user_subscription?.plan?.name}</p>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  Vendida: {fmtDate(b.created_at)}
                  {b.boleta_number && <> · N° {b.boleta_number}</>}
                  {b.sent_at && <> · Enviada: {fmtDate(b.sent_at)}</>}
                </p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                {b.status === 'pending' ? (
                  <>
                    <input type="text" placeholder="N° de boleta (opcional)" style={{ fontSize: '0.8rem', padding: '0.3rem 0.5rem', width: 160 }}
                      value={editingNumber[b.id] ?? ''}
                      onChange={(e) => setEditingNumber((m) => ({ ...m, [b.id]: e.target.value }))} />
                    <button className="btn btn-primary" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => markSent(b)}>
                      Marcar enviada
                    </button>
                  </>
                ) : (
                  <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => markPending(b)}>
                    Volver a pendiente
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FacturasTab() {
  const [facturas, setFacturas] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(FACTURA_EMPTY)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listFacturas(filter || undefined)
      .then((r) => setFacturas(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar facturas.' }))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(reload, [reload])

  function openNew() {
    setForm(FACTURA_EMPTY)
    setEditing({})
  }

  function openEdit(f) {
    setForm({
      invoice_number: f.invoice_number, company_name: f.company_name, ruc: f.ruc ?? '',
      amount_cents: f.amount_cents, description: f.description ?? '', status: f.status,
    })
    setEditing(f)
  }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      if (editing.id) {
        await adminApi.updateFactura(editing.id, { ...form, status: form.status || 'pending' })
      } else {
        await adminApi.createFactura(form)
      }
      setMsg({ type: 'ok', text: 'Factura guardada.' })
      setEditing(null)
      reload()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar la factura.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove(f) {
    if (!confirm(`¿Eliminar la factura ${f.invoice_number} de ${f.company_name}?`)) return
    try {
      await adminApi.deleteFactura(f.id)
      reload()
    } catch {
      setMsg({ type: 'err', text: 'Error al eliminar la factura.' })
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <label style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Filtrar:</label>
          <select className="form-select" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="sent">Enviadas</option>
            <option value="paid">Pagadas</option>
          </select>
        </div>
        <button className="btn btn-primary" onClick={openNew}>+ Nueva factura</button>
      </div>

      {msg.text && <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}>{msg.text}</div>}
      {loading && <div className="loading">Cargando...</div>}
      {!loading && facturas.length === 0 && <div className="empty-state">No hay facturas registradas todavía.</div>}

      {!loading && facturas.length > 0 && (
        <div className="record-list">
          {facturas.map((f) => (
            <div key={f.id} className="record-card" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{f.company_name}</strong>
                <span className="badge" style={{ marginLeft: '0.5rem' }}>{FACTURA_STATUS_ES[f.status] ?? f.status}</span>
                <p>{soles(f.amount_cents)} · N° {f.invoice_number}{f.ruc && <> · RUC {f.ruc}</>}</p>
                {f.description && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{f.description}</p>}
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Creada: {fmtDate(f.created_at)}</p>
              </div>
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => openEdit(f)}>Editar</button>
                <button className="btn" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem', borderColor: '#fca5a5', color: '#dc2626' }} onClick={() => remove(f)}>Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editing.id ? 'Editar factura' : 'Nueva factura'}</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Número de factura</label>
                <input type="text" value={form.invoice_number} onChange={(e) => set('invoice_number', e.target.value)}
                  placeholder="F001-00045" required />
              </div>
              <div className="form-group">
                <label>Empresa</label>
                <input type="text" value={form.company_name} onChange={(e) => set('company_name', e.target.value)}
                  placeholder="Samsung, Repsol, Burns the Agency..." required />
              </div>
              <div className="form-group">
                <label>RUC</label>
                <input type="text" value={form.ruc} onChange={(e) => set('ruc', e.target.value)}
                  placeholder="20123456789" maxLength={11} />
              </div>
              <div className="form-group">
                <label>Monto (S/)</label>
                <input type="number" min={0} step="0.01" value={form.amount_cents / 100}
                  onChange={(e) => set('amount_cents', Math.round(Number(e.target.value) * 100))} required />
              </div>
              <div className="form-group">
                <label>Descripción (opcional)</label>
                <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)}
                  placeholder="Convenio corporativo — 500 colaboradores" />
              </div>
              {editing.id && (
                <div className="form-group">
                  <label>Estado</label>
                  <select className="form-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                    <option value="pending">Pendiente</option>
                    <option value="sent">Enviada</option>
                    <option value="paid">Pagada</option>
                  </select>
                </div>
              )}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
                <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
