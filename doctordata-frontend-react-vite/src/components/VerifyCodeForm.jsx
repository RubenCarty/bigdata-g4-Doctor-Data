import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'

// Pantalla compartida de "ingresa el código de 6 dígitos" — la usan tanto Register.jsx
// (correo recién registrado) como Login.jsx (dispositivo nunca antes visto para esa
// cuenta). Ambos casos resuelven exactamente igual del lado del backend
// (POST /auth/verify-code), así que comparten esta única implementación.
export default function VerifyCodeForm({ email, reason, devCode, onVerified }) {
  const { verifyCode } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [currentDevCode, setCurrentDevCode] = useState(devCode)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setVerifying(true)
    try {
      const data = await verifyCode(email, code)
      onVerified(data)
    } catch (err) {
      setError(err.response?.data?.error || 'Código inválido o vencido')
    } finally {
      setVerifying(false)
    }
  }

  async function handleResend() {
    setError('')
    setResending(true)
    setResent(false)
    try {
      const res = await authApi.resendCode(email)
      setCurrentDevCode(res.data.dev_code || '')
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    } catch {
      setError('No se pudo reenviar el código. Inténtalo de nuevo.')
    } finally {
      setResending(false)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <p className="auth-card-subtitle" style={{ marginBottom: '1rem' }}>
        {reason === 'new_device'
          ? 'Detectamos un inicio de sesión desde un dispositivo nuevo. Ingresa el código que enviamos a '
          : 'Ingresa el código que enviamos a '}
        <strong>{email}</strong> para continuar.
      </p>

      {currentDevCode && (
        <div className="alert alert-info">
          Modo desarrollo (sin SMTP configurado) — tu código es: <strong>{currentDevCode}</strong>
        </div>
      )}
      {error && <div className="alert alert-error">{error}</div>}
      {resent && <div className="alert alert-info">Enviamos un nuevo código.</div>}

      <div className="form-group">
        <label htmlFor="verify-code">Código de verificación</label>
        <input
          id="verify-code"
          type="text"
          inputMode="numeric"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
          autoComplete="one-time-code"
          style={{ letterSpacing: code ? '0.3em' : 'normal', fontSize: '1.2rem', textAlign: 'center' }}
        />
      </div>

      <button type="submit" className="btn btn-primary btn-full" disabled={verifying || code.length !== 6}>
        {verifying ? 'Verificando...' : 'Verificar'}
      </button>

      <button type="button" className="btn btn-outline btn-full" style={{ marginTop: '0.6rem' }}
        onClick={handleResend} disabled={resending}>
        {resending ? 'Reenviando...' : '¿No te llegó? Reenviar código'}
      </button>
    </form>
  )
}
