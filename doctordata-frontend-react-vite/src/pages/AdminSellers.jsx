import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { adminApi, billingApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

function soles(cents) {
  return `S/ ${(cents / 100).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
function fmtDate(d) { return d ? new Date(d).toLocaleDateString('es-PE') : '—' }

export default function AdminSellers() {
  const { user: me } = useAuth()
  const [tab, setTab] = useState('leaderboard') // 'leaderboard' | 'codes' | 'calculator'
  const isSalesOnly = me?.is_sales && !me?.is_admin

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        <div className="header-actions">
          <span>{me?.email}</span>
          <span className="badge badge-admin">{isSalesOnly ? 'Ventas' : 'Admin'}</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Ventas</h2>
          <p className="page-subtitle">
            Leaderboard de comisiones del equipo comercial, tus códigos de descuento propios
            y la calculadora de convenios B2B.
          </p>
        </div>

        <div className="tabs">
          <button className={`tab ${tab === 'leaderboard' ? 'tab-active' : ''}`} onClick={() => setTab('leaderboard')}>Leaderboard</button>
          <button className={`tab ${tab === 'codes' ? 'tab-active' : ''}`} onClick={() => setTab('codes')}>Mis códigos</button>
          <button className={`tab ${tab === 'calculator' ? 'tab-active' : ''}`} onClick={() => setTab('calculator')}>Calculadora B2B</button>
        </div>

        {tab === 'leaderboard' && <LeaderboardTab />}
        {tab === 'codes' && <MyCodesTab />}
        {tab === 'calculator' && <CalculatorTab isSalesOnly={isSalesOnly} />}
      </main>

      <AppFooter />
    </div>
  )
}

function LeaderboardTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    adminApi.getLeaderboard()
      .then((r) => setData(r.data))
      .catch(() => setMsg('Error al cargar el leaderboard.'))
      .finally(() => setLoading(false))
  }, [])

  const rows = data?.leaderboard ?? []

  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Últimos 30 días — ventana móvil, se recalcula sola cada día, no hace falta tocar nada.
      </p>

      {msg && <div className="alert alert-error">{msg}</div>}
      {loading && <div className="loading">Cargando...</div>}
      {!loading && rows.length === 0 && (
        <div className="empty-state">Todavía no hay ventas atribuidas a ningún código de vendedor en los últimos 30 días.</div>
      )}

      {!loading && rows.length > 0 && (
        <div className="record-list">
          {rows.map((row, i) => (
            <div key={row.seller_id} className="record-card">
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>#{i + 1} — {row.email}</strong>
                <p>{row.sales_count} venta{row.sales_count === 1 ? '' : 's'}</p>
              </div>
              <strong style={{ fontSize: '1.1rem', color: 'var(--green)' }}>{soles(row.commission_cents)}</strong>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MyCodesTab() {
  const [codes, setCodes] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [code, setCode] = useState('')
  const [percent, setPercent] = useState(10)
  const [saving, setSaving] = useState(false)

  const reload = useCallback(() => {
    setLoading(true)
    adminApi.listMyDiscountCodes()
      .then((r) => setCodes(r.data ?? []))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar tus códigos.' }))
      .finally(() => setLoading(false))
  }, [])

  useEffect(reload, [reload])

  async function create(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await adminApi.createMyDiscountCode({ code: code.trim().toUpperCase(), percent_off: percent })
      setMsg({ type: 'ok', text: 'Código creado.' })
      setCode('')
      setPercent(10)
      reload()
    } catch (err) {
      const code = err.response?.data?.error
      setMsg({
        type: 'err',
        text: code === 'code_already_taken'
          ? 'Ese código ya está reservado por otro vendedor — prueba una variante (ej. agregando un número al final).'
          : code || 'Error al crear el código.',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <form onSubmit={create} className="record-card" style={{ flexWrap: 'wrap', gap: '1rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Código</label>
          <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: JUAN30" required />
        </div>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
          <label>Descuento: {percent}%</label>
          <input type="range" min={1} max={50} value={percent} onChange={(e) => setPercent(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Creando...' : 'Crear código'}
        </button>
      </form>

      {msg.text && <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`} style={{ marginTop: '1rem' }}>{msg.text}</div>}
      {loading && <div className="loading">Cargando...</div>}
      {!loading && codes.length === 0 && <div className="empty-state">Todavía no creaste ningún código.</div>}

      {!loading && codes.length > 0 && (
        <div className="record-list" style={{ marginTop: '1rem' }}>
          {codes.map((c) => (
            <div key={c.id} className="record-card">
              <div style={{ flex: 1, minWidth: 220 }}>
                <strong>{c.code}</strong> — {c.percent_off}%
                <p>Vigente hasta {fmtDate(c.valid_until)} · usos {c.times_redeemed}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Tramos de activación fijos (en céntimos) — regla de negocio, no editable desde la UI.
function activacionCentsFor(n) {
  if (n <= 20) return 35000
  if (n <= 50) return 60000
  if (n <= 150) return 95000
  return 95000 + (n - 150) * 400
}

function CalculatorTab({ isSalesOnly }) {
  const [plans, setPlans] = useState([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [n, setN] = useState(10)
  const [discount, setDiscount] = useState(10)

  useEffect(() => {
    billingApi.listPlans()
      .then((r) => setPlans(r.data ?? []))
      .finally(() => setLoadingPlans(false))
  }, [])

  // P = precio por persona: el plan destacado, anual, que admite descuentos — nunca
  // hardcodeado, así que si Planes cambia el precio la calculadora queda al día sola.
  const plan = useMemo(
    () => plans.find((p) => p.is_featured && p.allows_discounts && p.billing_period === 'annual'),
    [plans]
  )

  const results = useMemo(() => {
    if (!plan) return null
    const N = Math.max(1, Math.floor(n) || 1)
    const subsidioCents = Math.round(N * plan.price_cents * (discount / 100))
    const activacionCents = activacionCentsFor(N)
    const margenCents = Math.round(0.25 * (subsidioCents + activacionCents))
    const totalCents = subsidioCents + activacionCents + margenCents
    const comisionCents = Math.round(0.10 * totalCents)
    const netoCents = totalCents - comisionCents
    return { subsidioCents, activacionCents, margenCents, totalCents, comisionCents, netoCents }
  }, [plan, n, discount])

  if (loadingPlans) return <div className="loading" style={{ marginTop: '1rem' }}>Cargando...</div>

  if (!plan) {
    return (
      <div className="alert alert-error" style={{ marginTop: '1rem' }}>
        No hay un plan destacado anual con descuentos habilitado — revísalo en Planes (necesita
        estar marcado como destacado, con periodicidad anual, y con descuentos permitidos).
      </div>
    )
  }

  return (
    <div style={{ marginTop: '1rem' }}>
      <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Precio base: {plan.name} — {soles(plan.price_cents)} por persona/año.
      </p>

      <div className="profile-row" style={{ marginBottom: '1.5rem' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Cantidad de personas (N)</label>
          <input type="number" min={1} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </div>
        <div className="form-group" style={{ flex: 1 }}>
          <label>Descuento: {discount}%</label>
          <input type="range" min={1} max={50} value={discount} onChange={(e) => setDiscount(Number(e.target.value))} style={{ width: '100%' }} />
        </div>
      </div>

      {results && (
        <>
          <div className="summary-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="summary-card" style={{ alignItems: 'flex-start' }}>
              <span className="summary-label">Total a cobrar a la empresa</span>
              <span className="summary-number">{soles(results.totalCents)}</span>
            </div>
            <div className="summary-card" style={{ alignItems: 'flex-start' }}>
              <span className="summary-label">Comisión del vendedor (10%)</span>
              <span className="summary-number">{soles(results.comisionCents)}</span>
            </div>
          </div>

          {/* El desglose interno (subsidio/activación/margen/neto) es solo para admin/super
              admin — a un vendedor solo le importa cuánto se le paga a él, mostrarle el resto
              solo genera preguntas sobre números que no le corresponden. */}
          {!isSalesOnly && (
            <div className="card-grid">
              <div className="card"><h3>Subsidio</h3><p>{soles(results.subsidioCents)}</p></div>
              <div className="card"><h3>Activación</h3><p>{soles(results.activacionCents)}</p></div>
              <div className="card"><h3>Margen (25%)</h3><p>{soles(results.margenCents)}</p></div>
              <div className="card"><h3>Neto para DoctorData</h3><p>{soles(results.netoCents)}</p></div>
            </div>
          )}

          <CompanyBankInfo />
        </>
      )}
    </div>
  )
}

// Datos bancarios de la empresa — para que el vendedor se los pase de una vez al cliente
// justo después de mostrarle el total a cobrar. Vienen del .env (BANK_NAME/BANK_CC/BANK_CCI/
// BANK_RUC/BANK_USER en el backend), no de la base de datos — no confundir con la cuenta
// bancaria PROPIA de cada vendedor (esa está en /account/bank).
function CompanyBankInfo() {
  const [info, setInfo] = useState(null)

  useEffect(() => {
    adminApi.getCompanyBankInfo().then((r) => setInfo(r.data)).catch(() => {})
  }, [])

  if (!info || !info.bank_name) return null

  return (
    <div className="card" style={{ marginTop: '1.5rem', maxWidth: 420 }}>
      <h3>Cuenta para el convenio</h3>
      <p>{info.bank_name} — {info.account_user}</p>
      <p>Cuenta: {info.account}</p>
      <p>CCI: {info.cci}</p>
      <p>RUC: {info.ruc}</p>
    </div>
  )
}
