import { useState } from 'react'
import { useLocation, useNavigate, useSearchParams, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import IzipayEmbeddedForm from '../components/IzipayEmbeddedForm'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'
import formImg from '../assets/images/imgForm.png'

// Recibe formToken/publicKey vía location.state (no query string, para no dejar el token en
// el historial del navegador) cuando viene de Pricing.jsx/Register.jsx en la misma pestaña —
// apenas POST /me/subscriptions/checkout devuelve un form_token real de Izipay. Como respaldo,
// también los lee de la query string: la app nativa abre esta página en el navegador del
// sistema (una navegación fresca, sin location.state posible) — ver PricingScreen.jsx allá.
export default function IzipayCheckout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()
  const [error, setError] = useState('')
  const [succeeded, setSucceeded] = useState(false)

  const formToken = location.state?.formToken || searchParams.get('formToken')
  const publicKey = location.state?.publicKey || searchParams.get('publicKey')

  function handleSuccess() {
    // Si esta pestaña no tiene sesión web (abierta desde la app nativa), no tiene sentido
    // mandarla a /onboarding/profile — PrivateRoute la rebotaría a /login. La app nativa ya
    // confirma el pago por su cuenta (polling a /me/subscriptions/capacity).
    if (user) navigate('/onboarding/profile')
    else setSucceeded(true)
  }

  if (succeeded) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" />
        </header>
        <main className="dashboard-content">
          <div className="alert alert-info">
            ¡Pago exitoso! Ya puedes cerrar esta pestaña y volver a la app de DoctorData.
          </div>
        </main>
        <AppFooter />
      </div>
    )
  }

  if (!formToken || !publicKey) {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
        </header>
        <main className="dashboard-content">
          <div className="alert alert-error">No hay una sesión de pago activa.</div>
          <Link to="/pricing" className="btn btn-outline" style={{ marginTop: '1rem' }}>Volver a planes</Link>
        </main>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/dashboard"><img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" /></Link>
      </header>

      <main className="dashboard-content" style={{ maxWidth: 900 }}>
        <div className="checkout-card">
          <aside className="checkout-panel">
            <img src={formImg} alt="Ilustración de pago seguro"
              title="Completa tu pago" className="checkout-panel-img"
              width="375" height="600" loading="lazy" />
            <p className="checkout-tagline">Pago seguro procesado por Izipay</p>
          </aside>

          <div className="checkout-form-panel">
            <h2 style={{ marginBottom: '1rem' }}>Completa tu pago</h2>
            {error && <div className="alert alert-error" style={{ marginBottom: '1rem' }}>{error}</div>}
            <IzipayEmbeddedForm
              formToken={formToken}
              publicKey={publicKey}
              onSuccess={handleSuccess}
              onError={setError}
            />
          </div>
        </div>
      </main>

      <AppFooter />
    </div>
  )
}
