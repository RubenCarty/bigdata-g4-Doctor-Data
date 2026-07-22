import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { authApi } from '../services/api'

const AuthContext = createContext(null)

const INACTIVITY_MS = 5 * 60 * 1000 // 5 minutos

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const inactivityTimer = useRef(null)

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem('token')
    setUser(null)
    clearTimeout(inactivityTimer.current)
  }, [])

  // ── Timer de inactividad ──────────────────────────────────────────────────
  const resetInactivityTimer = useCallback(() => {
    clearTimeout(inactivityTimer.current)
    inactivityTimer.current = setTimeout(() => {
      logout()
      window.location.href = '/login?reason=inactivity'
    }, INACTIVITY_MS)
  }, [logout])

  // Registra eventos de interacción solo cuando hay sesión activa
  useEffect(() => {
    if (!user) return

    const events = ['click', 'keydown', 'scroll', 'mousemove', 'touchstart']
    events.forEach((e) => window.addEventListener(e, resetInactivityTimer, { passive: true }))
    resetInactivityTimer()

    return () => {
      events.forEach((e) => window.removeEventListener(e, resetInactivityTimer))
      clearTimeout(inactivityTimer.current)
    }
  }, [user, resetInactivityTimer])

  // ── Restaurar sesión al montar ────────────────────────────────────────────
  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setLoading(false)
      return
    }
    authApi.me()
      .then((res) => setUser(res.data))
      .catch(() => {
        localStorage.removeItem('token')
      })
      .finally(() => setLoading(false))
  }, [])

  // ── Login / Register ──────────────────────────────────────────────────────
  // Login, Register y VerifyCode comparten forma de respuesta: o bien
  // { verification_required: true, email, dev_code? } (falta confirmar un código de 6
  // dígitos por correo — correo nunca verificado, o dispositivo nuevo para esa cuenta) o
  // bien { token, user } (sesión completa). Solo en el segundo caso se guarda el token —
  // el caller (Login.jsx/Register.jsx) decide qué pantalla mostrar según cuál llegó.
  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    if (res.data.token) {
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  const register = useCallback(async (email, password) => {
    const res = await authApi.register(email, password)
    if (res.data.token) {
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  const verifyCode = useCallback(async (email, code) => {
    const res = await authApi.verifyCode(email, code)
    if (res.data.token) {
      localStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  // Vuelve a pedir /auth/me — necesario porque `user` (con has_active_subscription,
  // is_doctor, etc.) solo se carga al iniciar sesión/registrarse; acciones posteriores
  // en la misma sesión (comprar una suscripción, activar perfil médico) no lo actualizan
  // solas. Las páginas que dependen de esos campos deben llamar esto al montar.
  const refreshUser = useCallback(async () => {
    const res = await authApi.me()
    setUser(res.data)
    return res.data
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, verifyCode, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
