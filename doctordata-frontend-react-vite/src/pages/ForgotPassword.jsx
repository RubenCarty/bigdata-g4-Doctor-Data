import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { authApi } from '../services/api'
import AppFooter from '../components/AppFooter'
import logo from '../assets/images/Doctor_Data_logo.png'
import formImg from '../assets/images/imgForm.png'

export default function ForgotPassword() {
  const [searchParams] = useSearchParams()
  const tokenFromLink = searchParams.get('token')
  // Con ?token= en la URL (ej. el link de invitación de NominateDoctor) saltamos directo al
  // paso de definir contraseña — sin esto, el usuario tendría que copiar/pegar el token a mano.
  const [step, setStep] = useState(tokenFromLink ? 'reset' : 'request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState(tokenFromLink ?? '')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await authApi.forgotPassword(email)
      if (res.data.reset_token) {
        setToken(res.data.reset_token)
        setMessage('Token de recuperación generado. En producción se enviaría por email.')
      } else {
        setMessage(res.data.message)
      }
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar la solicitud')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset(e) {
    e.preventDefault()
    setError('')
    if (password !== confirm) {
      setError('Las contraseñas no coinciden')
      return
    }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setMessage('Contraseña actualizada correctamente. Ya puedes iniciar sesión.')
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.error || 'Token inválido o expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-layout">
      <div className="auth-body">
        <aside className="auth-panel">
          <img src={formImg} alt="Ilustración de recuperación de contraseña" title="Recuperación de contraseña" className="auth-panel-img" />
          <p className="auth-panel-tagline">Tu salud, bien resguardada</p>
        </aside>

        <main className="auth-main">
          <div className="auth-card">
          <Link to="/">
            <img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — volver al inicio" className="auth-card-logo" />
          </Link>
          <h2>Recuperar contraseña</h2>
          <p className="auth-card-subtitle">Ingresa tu correo para continuar</p>

          {message && <div className="alert alert-info">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}

          {step === 'request' && (
            <form onSubmit={handleRequest}>
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
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Enviando...' : 'Solicitar recuperación'}
              </button>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleReset}>
              <div className="form-group">
                <label htmlFor="token">Token de recuperación</label>
                <input
                  id="token"
                  type="text"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="Token recibido"
                />
              </div>
              <div className="form-group">
                <label htmlFor="password">Nueva contraseña</label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
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
                />
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={loading}>
                {loading ? 'Actualizando...' : 'Cambiar contraseña'}
              </button>
            </form>
          )}

          <div className="auth-links">
            <Link to="/login">← Volver al inicio de sesión</Link>
            <Link to="/">← Volver al inicio</Link>
          </div>
          </div>
        </main>
      </div>

      <AppFooter className="auth-footer" />
    </div>
  )
}
