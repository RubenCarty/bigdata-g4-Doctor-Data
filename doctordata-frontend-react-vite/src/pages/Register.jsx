import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PlanPicker from '../components/PlanPicker'
import AppFooter from '../components/AppFooter'
import VerifyCodeForm from '../components/VerifyCodeForm'
import terminosPdf from '../assets/docs/Terminos_y_Condiciones_DoctorData.pdf'
import privacidadPdf from '../assets/docs/Politica_de_Privacidad_DoctorData.pdf'
import logo from '../assets/images/Doctor_Data_logo.png'
import formImg from '../assets/images/imgForm.png'

// Nota: esta ruta NO se envuelve con <PublicRoute> en App.jsx (a diferencia de
// /login) porque un usuario recién registrado ya tiene `user` truthy pero todavía no
// tiene suscripción activa — PublicRoute lo mandaría a /dashboard antes de poder ver el
// paso de selección de plan. El guard de "ya tiene todo, mándalo al dashboard" se hace
// aquí mismo, condicionado a has_active_subscription.
export default function Register() {
  const { user, loading: authLoading, register } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState('account') // 'account' | 'verify' | 'plans'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  // Se llena cuando el registro responde verification_required en vez de {token, user}
  // directo — el correo siempre queda sin verificar hasta confirmar el código.
  const [pendingVerification, setPendingVerification] = useState(null)

  useEffect(() => {
    if (authLoading) return
    if (user) {
      if (user.has_active_subscription) {
        navigate('/dashboard', { replace: true })
      } else {
        setStep('plans')
      }
    }
  }, [authLoading, user, navigate])

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      const data = await register(email, password)
      if (data.verification_required) {
        setPendingVerification({ email: data.email, reason: data.reason, devCode: data.dev_code })
        setStep('verify')
      }
      // Si en algún momento el backend devolviera {token, user} directo, el effect de
      // arriba avanza el paso solo apenas `user` quede seteado — no hace falta manejarlo acá.
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

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

  if (authLoading) return <div className="loading">Cargando...</div>

  if (step === 'verify' && pendingVerification) {
    return (
      <div className="auth-layout">
        <div className="auth-body">
          <aside className="auth-panel">
            <img src={formImg} alt="Ilustración del formulario de registro de nueva cuenta" title="Formulario de registro" className="auth-panel-img" />
            <p className="auth-panel-tagline">Empieza a gestionar tu salud hoy</p>
          </aside>

          <main className="auth-main">
            <div className="auth-card">
              <Link to="/">
                <img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — volver al inicio" className="auth-card-logo" />
              </Link>
              <h2>Verifica tu correo</h2>
              <VerifyCodeForm
                email={pendingVerification.email}
                reason={pendingVerification.reason}
                devCode={pendingVerification.devCode}
                onVerified={() => setStep('plans')}
              />
            </div>
          </main>
        </div>
        <AppFooter className="auth-footer" />
      </div>
    )
  }

  if (step === 'plans') {
    return (
      <div className="dashboard">
        <header className="dashboard-header">
          <Link to="/"><img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — volver al inicio" className="dashboard-header-logo" /></Link>
        </header>
        <main className="dashboard-content">
          <div style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>Elige tu plan</h2>
            <p className="page-subtitle">
              Tu cuenta ya está creada. Para empezar a registrar tus datos y los de las
              personas que quieras cubrir, elige y paga al menos un plan.
            </p>
          </div>
          <PlanPicker onCheckout={handleCheckout} />
        </main>
        <AppFooter />
      </div>
    )
  }

  return (
    <div className="auth-layout">
      <div className="auth-body">
        <aside className="auth-panel">
          <img src={formImg} alt="Ilustración del formulario de registro de nueva cuenta" title="Formulario de registro" className="auth-panel-img" />
          <p className="auth-panel-tagline">Empieza a gestionar tu salud hoy</p>
        </aside>

        <main className="auth-main">
          <div className="auth-card">
            <Link to="/">
              <img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — volver al inicio" className="auth-card-logo" />
            </Link>
            <h2>Crear cuenta</h2>
            <p className="auth-card-subtitle">Un paso más y eliges tu plan</p>

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
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                />
              </div>

              <div className="form-group">
                <label htmlFor="confirm">Confirmar contraseña</label>
                <input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  placeholder="Repite tu contraseña"
                />
              </div>

              <div className="consent-group">
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    required
                  />
                  <span>
                    Acepto haber y estar de acuerdo leído los{' '}
                    <a href={terminosPdf} target="_blank" rel="noopener noreferrer">términos y condiciones</a>.
                  </span>
                </label>
                <label className="check-label">
                  <input
                    type="checkbox"
                    checked={acceptedPrivacy}
                    onChange={(e) => setAcceptedPrivacy(e.target.checked)}
                    required
                  />
                  <span>
                    Acepto haber y estar de acuerdo leído las{' '}
                    <a href={privacidadPdf} target="_blank" rel="noopener noreferrer">políticas de privacidad</a>.
                  </span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Enviando código de verificación...' : 'Continuar'}
              </button>
            </form>

            <div className="auth-links">
              <Link to="/login">¿Ya tienes cuenta? Inicia sesión</Link>
              <Link to="/">← Volver al inicio</Link>
            </div>
          </div>
        </main>
      </div>

      <AppFooter className="auth-footer" />
    </div>
  )
}
