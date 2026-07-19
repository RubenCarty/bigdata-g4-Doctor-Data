import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

function toDateInput(d) {
  return d ? new Date(d).toISOString().substring(0, 10) : ''
}

const EMPTY = {
  code: '', type: 'fixed', amount_cents: 0, percent_off: 10,
  valid_from: '', valid_until: '', max_redemptions: '', notes: '',
}

export default function AdminDiscounts() {
  const { user: me } = useAuth()
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listDiscountCodes()
      .then((r) => setCodes(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar códigos.' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  // Agrupa por texto de código para que se vean juntas las distintas ventanas de
  // vigencia que comparten el mismo texto (p.ej. "AUTONOMA26" con reglas de temporada).
  const grouped = useMemo(() => {
    const map = {}
    for (const c of codes) {
      if (!map[c.code]) map[c.code] = []
      map[c.code].push(c)
    }
    return Object.entries(map)
  }, [codes])

  function openNew() {
    setForm(EMPTY)
    setEditing({})
  }

  function openEdit(dc) {
    setForm({
      code: dc.code, type: dc.type, amount_cents: dc.amount_cents ?? 0,
      percent_off: dc.percent_off ?? 10, valid_from: toDateInput(dc.valid_from),
      valid_until: toDateInput(dc.valid_until), max_redemptions: dc.max_redemptions ?? '',
      notes: dc.notes ?? '',
    })
    setEditing(dc)
  }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      code: form.code.trim().toUpperCase(),
      type: form.type,
      amount_cents: form.type === 'fixed' ? form.amount_cents : 0,
      percent_off: form.type === 'percentage' ? form.percent_off : 0,
      valid_from: new Date(form.valid_from).toISOString(),
      valid_until: new Date(form.valid_until).toISOString(),
      max_redemptions: form.max_redemptions === '' ? null : Number(form.max_redemptions),
      notes: form.notes,
    }
    try {
      let res
      if (editing.id) {
        res = await adminApi.updateDiscountCode(editing.id, payload)
      } else {
        res = await adminApi.createDiscountCode(payload)
      }
      const warning = res?.data?.warning
      setMsg({
        type: 'ok',
        text: warning === 'overlapping_window_same_code'
          ? 'Código guardado — atención: se solapa con otra ventana de vigencia del mismo texto.'
          : 'Código guardado.',
      })
      setEditing(null)
      reload()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar el código.' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(dc) {
    try {
      await adminApi.updateDiscountCode(dc.id, { is_active: !dc.is_active })
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem' }}>
          <div>
            <h2 style={{ marginBottom: '0.2rem' }}>Códigos de descuento</h2>
            <p className="page-subtitle">
              Fijos o porcentuales, con vigencia por fecha. El mismo texto puede repetirse
              con reglas y temporadas distintas.
            </p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo código</button>
        </div>

        {msg.text && (
          <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}>{msg.text}</div>
        )}

        {loading && <div className="loading">Cargando...</div>}

        {!loading && grouped.length === 0 && <div className="empty-state">No hay códigos creados todavía.</div>}

        {!loading && grouped.map(([code, group]) => (
          <div key={code} style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>{code}</h3>
            <div className="record-list">
              {group.map((dc) => (
                <div key={dc.id} className="record-card" style={{ alignItems: 'flex-start' }}>
                  <div style={{ flex: 1, minWidth: 220 }}>
                    <strong>
                      {dc.type === 'fixed' ? `S/ ${(dc.amount_cents / 100).toFixed(2)} fijo` : `${dc.percent_off}% de descuento`}
                    </strong>
                    {!dc.is_active && <span className="badge" style={{ marginLeft: '0.5rem' }}>Inactivo</span>}
                    <p>
                      Vigente {toDateInput(dc.valid_from)} → {toDateInput(dc.valid_until)}
                      {dc.max_redemptions != null && <> · usos {dc.times_redeemed}/{dc.max_redemptions}</>}
                      {dc.max_redemptions == null && <> · usos {dc.times_redeemed}</>}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => openEdit(dc)}>Editar</button>
                    <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => toggleActive(dc)}>
                      {dc.is_active ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

      <AppFooter />

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editing.id ? 'Editar código' : 'Nuevo código'}</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Código</label>
                <input type="text" value={form.code} onChange={(e) => set('code', e.target.value)} required />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select className="form-select" value={form.type} onChange={(e) => set('type', e.target.value)}>
                  <option value="fixed">Fijo (S/)</option>
                  <option value="percentage">Porcentual (%)</option>
                </select>
              </div>

              {form.type === 'fixed' ? (
                <div className="form-group">
                  <label>Monto (S/)</label>
                  <input type="number" min={0} step="0.01" value={form.amount_cents / 100}
                    onChange={(e) => set('amount_cents', Math.round(Number(e.target.value) * 100))} required />
                </div>
              ) : (
                <div className="form-group">
                  <label>Porcentaje</label>
                  <input type="number" min={1} max={100} value={form.percent_off}
                    onChange={(e) => set('percent_off', Number(e.target.value))} required />
                </div>
              )}

              <div className="profile-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Vigente desde</label>
                  <input type="date" value={form.valid_from} onChange={(e) => set('valid_from', e.target.value)} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Vigente hasta</label>
                  <input type="date" value={form.valid_until} onChange={(e) => set('valid_until', e.target.value)} required />
                </div>
              </div>

              <div className="form-group">
                <label>Límite de usos (opcional)</label>
                <input type="number" min={1} value={form.max_redemptions}
                  onChange={(e) => set('max_redemptions', e.target.value)} placeholder="Sin límite" />
              </div>

              <div className="form-group">
                <label>Notas (opcional)</label>
                <input type="text" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>

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
