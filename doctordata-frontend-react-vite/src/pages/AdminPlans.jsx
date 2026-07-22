import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const EMPTY = {
  name: '', description: '', billing_period: 'monthly', covered_capacity: 1,
  price_cents: 0, is_active: true, is_featured: false, allows_discounts: true, sort_order: 0,
  promo_label: '', available_until: '', renewal_price_cents: '',
}

function toDateTimeInput(d) {
  return d ? new Date(d).toISOString().substring(0, 16) : ''
}

export default function AdminPlans() {
  const { user: me } = useAuth()
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [editing, setEditing] = useState(null) // null = cerrado, {} = nuevo, plan = editar
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listPlans()
      .then((r) => setPlans(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar planes.' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  function openNew() {
    setForm(EMPTY)
    setEditing({})
  }

  function openEdit(plan) {
    setForm({
      name: plan.name, description: plan.description ?? '',
      billing_period: plan.billing_period, covered_capacity: plan.covered_capacity,
      price_cents: plan.price_cents, is_active: plan.is_active,
      is_featured: plan.is_featured ?? false, allows_discounts: plan.allows_discounts ?? true,
      sort_order: plan.sort_order ?? 0,
      promo_label: plan.promo_label ?? '', available_until: toDateTimeInput(plan.available_until),
      renewal_price_cents: plan.renewal_price_cents ?? '',
    })
    setEditing(plan)
  }

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    const payload = {
      ...form,
      available_until: form.available_until ? new Date(form.available_until).toISOString() : null,
      renewal_price_cents: form.renewal_price_cents === '' ? null : form.renewal_price_cents,
    }
    try {
      if (editing.id) {
        await adminApi.updatePlan(editing.id, payload)
        setMsg({ type: 'ok', text: 'Plan actualizado.' })
      } else {
        await adminApi.createPlan(payload)
        setMsg({ type: 'ok', text: 'Plan creado.' })
      }
      setEditing(null)
      reload()
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar el plan.' })
    } finally {
      setSaving(false)
    }
  }

  async function toggleActive(plan) {
    try {
      await adminApi.updatePlan(plan.id, { is_active: !plan.is_active })
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
            <h2 style={{ marginBottom: '0.2rem' }}>Planes de suscripción</h2>
            <p className="page-subtitle">Periodo x capacidad de personas cubiertas.</p>
          </div>
          <button className="btn btn-primary" onClick={openNew}>+ Nuevo plan</button>
        </div>

        {msg.text && (
          <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`}>{msg.text}</div>
        )}

        {loading && <div className="loading">Cargando...</div>}

        {!loading && plans.length === 0 && <div className="empty-state">No hay planes creados todavía.</div>}

        {!loading && plans.length > 0 && (
          <div className="record-list">
            {plans.map((p) => (
              <div key={p.id} className="record-card" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <strong>{p.name}</strong>
                  {p.is_featured && <span className="badge badge-admin" style={{ marginLeft: '0.5rem' }}>★ Destacado</span>}
                  {p.promo_label && <span className="badge badge-high" style={{ marginLeft: '0.5rem' }}>{p.promo_label}</span>}
                  {!p.allows_discounts && <span className="badge" style={{ marginLeft: '0.5rem' }}>Sin descuentos</span>}
                  {!p.is_active && <span className="badge" style={{ marginLeft: '0.5rem' }}>Inactivo</span>}
                  <p>
                    {p.billing_period === 'annual' ? 'Anual' : 'Mensual'} · hasta {p.covered_capacity} persona(s) · S/ {(p.price_cents / 100).toFixed(2)}
                    {p.available_until && ` · disponible hasta ${new Date(p.available_until).toLocaleString('es-PE')}`}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => openEdit(p)}>Editar</button>
                  <button className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={() => toggleActive(p)}>
                    {p.is_active ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <AppFooter />

      {editing && (
        <div className="modal-backdrop" onClick={() => setEditing(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginBottom: '1rem' }}>{editing.id ? 'Editar plan' : 'Nuevo plan'}</h3>
            <form onSubmit={save}>
              <div className="form-group">
                <label>Nombre</label>
                <input type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Descripción</label>
                <input type="text" value={form.description} onChange={(e) => set('description', e.target.value)} />
              </div>
              <div className="profile-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Periodo</label>
                  <select className="form-select" value={form.billing_period} onChange={(e) => set('billing_period', e.target.value)}>
                    <option value="monthly">Mensual</option>
                    <option value="annual">Anual</option>
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Capacidad (personas)</label>
                  <input type="number" min={1} value={form.covered_capacity}
                    onChange={(e) => set('covered_capacity', Number(e.target.value))} required />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Precio (S/)</label>
                  <input type="number" min={0} step="0.01" value={form.price_cents / 100}
                    onChange={(e) => set('price_cents', Math.round(Number(e.target.value) * 100))} required />
                </div>
              </div>
              <label className="check-label">
                <input type="checkbox" checked={form.is_featured}
                  onChange={(e) => set('is_featured', e.target.checked)} />
                Destacado (se muestra como el plan recomendado)
              </label>
              <label className="check-label" style={{ marginTop: '0.5rem' }}>
                <input type="checkbox" checked={form.allows_discounts}
                  onChange={(e) => set('allows_discounts', e.target.checked)} />
                Admite códigos de descuento (desmarcar para ofertas ya rebajadas, ej. Fundador)
              </label>
              <div className="profile-row" style={{ marginTop: '1rem' }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Etiqueta de promoción (opcional)</label>
                  <input type="text" value={form.promo_label}
                    onChange={(e) => set('promo_label', e.target.value)}
                    placeholder="Ej: Fundador, Cyber Days" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>Disponible hasta (opcional)</label>
                  <input type="datetime-local" value={form.available_until}
                    onChange={(e) => set('available_until', e.target.value)} />
                </div>
              </div>
              <div className="form-group" style={{ maxWidth: 220 }}>
                <label>Precio de renovación (S/, opcional)</label>
                <input type="number" min={0} step="0.01"
                  value={form.renewal_price_cents === '' ? '' : form.renewal_price_cents / 100}
                  onChange={(e) => set('renewal_price_cents', e.target.value === '' ? '' : Math.round(Number(e.target.value) * 100))}
                  placeholder="Igual al precio de oferta" />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Lo que pagaría el cliente al renovar después del periodo de oferta (ej. precio Normal). Vacío = se renueva al mismo precio.
                </span>
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
