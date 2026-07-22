import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { billingApi } from '../services/api'
import logo from '../assets/images/Doctor_Data_logo.png'

// Pantalla de pago SIMULADO — solo existe porque PAYMENT_GATEWAY=stub en el backend
// (desarrollo local, sin credenciales reales de Izipay). Nunca se enlaza desde la
// navegación normal; solo se llega aquí vía la RedirectURL que genera StubGateway.
export default function CheckoutStub() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const orderRef = params.get('order_ref')
  const amountCents = Number(params.get('amount_cents') || 0)
  const currency = params.get('currency') || 'PEN'
  const gatewayRef = `stub_${orderRef}`

  async function resolve(status) {
    setSubmitting(true)
    setError('')
    try {
      await billingApi.confirmStubPayment(gatewayRef, status)
      if (status === 'paid') {
        navigate('/onboarding/profile', { replace: true })
      } else {
        navigate('/register', { replace: true })
      }
    } catch {
      setError('No se pudo confirmar el pago simulado.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-layout">
      <main className="auth-main" style={{ flex: 1, width: '100%' }}>
        <div className="auth-card">
          <img src={logo} alt="Logotipo Doctor Data" className="auth-card-logo" />
          <div className="alert alert-info">Modo de prueba — no es un pago real</div>
          <h2>Confirmar pago simulado</h2>
          <p className="auth-card-subtitle">
            Total: {currency} {(amountCents / 100).toFixed(2)}
          </p>

          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
            <button
              className="btn btn-primary"
              onClick={() => resolve('paid')}
              disabled={submitting}
            >
              Aprobar pago
            </button>
            <button
              className="btn btn-outline"
              onClick={() => resolve('failed')}
              disabled={submitting}
            >
              Rechazar pago
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
