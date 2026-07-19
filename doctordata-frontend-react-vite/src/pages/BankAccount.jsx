import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { bankAccountApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

const EMPTY = { bank_name: '', bank_account_number: '', bank_cci: '' }

export default function BankAccount() {
  const { user } = useAuth()
  const [form, setForm] = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    bankAccountApi.getMine()
      .then((r) => setForm({
        bank_name: r.data.bank_name ?? '',
        bank_account_number: r.data.bank_account_number ?? '',
        bank_cci: r.data.bank_cci ?? '',
      }))
      .catch(() => setMsg({ type: 'err', text: 'Error al cargar tu cuenta bancaria.' }))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function save(e) {
    e.preventDefault()
    setSaving(true)
    try {
      await bankAccountApi.updateMine(form)
      setMsg({ type: 'ok', text: 'Cuenta bancaria guardada.' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar.' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        <div className="header-actions">
          <span>{user?.email}</span>
          <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
        </div>
      </header>

      <main className="dashboard-content" style={{ maxWidth: 480 }}>
        <div style={{ marginBottom: '1.25rem' }}>
          <h2 style={{ marginBottom: '0.2rem' }}>Cuenta bancaria</h2>
          <p className="page-subtitle">
            La cuenta a la que te corresponde que se te pague (comisión, sueldo, etc).
          </p>
        </div>

        {msg.text && <div className={`alert ${msg.type === 'ok' ? 'alert-info' : 'alert-error'}`} style={{ marginBottom: '1rem' }}>{msg.text}</div>}
        {loading && <div className="loading">Cargando...</div>}

        {!loading && (
          <form onSubmit={save}>
            <div className="form-group">
              <label htmlFor="bank_name">Banco</label>
              <input id="bank_name" type="text" value={form.bank_name}
                onChange={(e) => set('bank_name', e.target.value)}
                placeholder="Ej: Interbank, BCP, BBVA..." />
            </div>
            <div className="form-group">
              <label htmlFor="bank_account_number">Cuenta bancaria</label>
              <input id="bank_account_number" type="text" value={form.bank_account_number}
                onChange={(e) => set('bank_account_number', e.target.value)} />
            </div>
            <div className="form-group">
              <label htmlFor="bank_cci">Código de Cuenta Interbancaria (CCI)</label>
              <input id="bank_cci" type="text" value={form.bank_cci}
                onChange={(e) => set('bank_cci', e.target.value)} />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar'}
            </button>
          </form>
        )}
      </main>

      <AppFooter />
    </div>
  )
}
