import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AppFooter from '../components/AppFooter'
import VerifyCodeForm from '../components/VerifyCodeForm'
import logo from '../assets/images/Doctor_Data_logo.png'
import formImg from '../assets/images/imgForm.png'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const sessionExpired = new URLSearchParams(location.search).get('reason') === 'inactivity'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Se llena cuando el backend responde verification_required (correo aún no verificado o
  // dispositivo nunca antes visto para esta cuenta) en vez de {token, user} directo.
  const [pendingVerification, setPendingVerification] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if (data.verification_required) {
        setPendingVerification({ email: data.email, reason: data.reason, devCode: data.dev_code })
      } else {
        navigate('/dashboard')
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-body">
        <aside className="auth-panel">
          <img src={formImg} alt="Ilustración del formulario de inicio de sesión" title="Formulario de inicio de sesión" className="auth-panel-img" />
          <p className="auth-panel-tagline">Tu salud, bien resguardada</p>
        </aside>

        <main className="auth-main">
          <div className="auth-card">
            <Link to="/">
              <img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — volver al inicio" className="auth-card-logo" />
            </Link>
            <h2>Iniciar sesión</h2>

            {pendingVerification ? (
              <VerifyCodeForm
                email={pendingVerification.email}
                reason={pendingVerification.reason}
                devCode={pendingVerification.devCode}
                onVerified={() => navigate('/dashboard')}
              />
            ) : (
              <>
                <p className="auth-card-subtitle">Bienvenido de regreso</p>

                {sessionExpired && (
                  <div className="alert alert-info">
                    Sesión cerrada por inactividad. Inicia sesión de nuevo.
                  </div>
                )}
                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleSubmit}>
                  <div className="form-group">
                    <label htmlFor="email">Correo electrónico</label>
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoComplete="email"
                      placeholder="tu@correo.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="password">Contraseña</label>
                    <input
                      id="password"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      placeholder="Mínimo 8 caracteres"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                    {loading ? 'Ingresando...' : 'Ingresar'}
                  </button>
                </form>

                <div className="auth-links">
                  <Link to="/forgot-password">¿Olvidaste tu contraseña?</Link>
                  <Link to="/register">Crear cuenta nueva</Link>
                  <Link to="/">← Volver al inicio</Link>
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      <AppFooter className="auth-footer" />
    </div>
  )
}
