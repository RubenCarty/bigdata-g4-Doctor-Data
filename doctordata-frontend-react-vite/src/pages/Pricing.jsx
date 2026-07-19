import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PlanPicker from '../components/PlanPicker'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'

export default function Pricing() {
  const { user } = useAuth()
  const navigate = useNavigate()

  function handleCheckout(session) {
    if (session.already_paid) {
      // Carrito en S/ 0.00 (descuento de 100%) — el backend lo activó directo, sin pasar por
      // ninguna pasarela (Izipay rechaza cobros por ese monto).
      navigate('/onboarding/profile')
    } else if (session.form_token) {
      navigate('/checkout/izipay', { state: { formToken: session.form_token, publicKey: session.public_key } })
    } else if (session.checkout_url) {
      window.location.href = session.checkout_url
    }
  }

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to={user ? '/dashboard' : '/'}>
          <img src={logo} alt="Logotipo Doctor Data" className="dashboard-header-logo" />
        </Link>
        <div className="header-actions">
          {user
            ? <Link to="/dashboard" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>← Dashboard</Link>
            : <Link to="/login" className="btn btn-outline" style={{ fontSize: '0.85rem' }}>Iniciar sesión</Link>}
        </div>
      </header>

      <main className="dashboard-content">
        <div style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '0.25rem' }}>Planes de suscripción</h2>
          <p className="page-subtitle">
            Elige mensual o anual, y cuántas personas quieres cubrir. Puedes combinar
            varios planes — se suman en una sola cuenta.
          </p>
        </div>

        <PlanPicker onCheckout={handleCheckout} />
      </main>

      <AppFooter />
    </div>
  )
}
