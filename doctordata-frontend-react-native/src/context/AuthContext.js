import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authApi, setOnUnauthorized } from '../services/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  // initStep/initError alimentan la pantalla de carga (ver LoadingScreen.jsx) — sin esto no
  // hay forma de distinguir "todavía cargando" de "colgado", que es exactamente el problema
  // reportado: no había ningún indicio en pantalla de en qué paso se quedaba la app.
  const [initStep, setInitStep] = useState('checking_session')
  const [initError, setInitError] = useState(null)

  const runInitCheck = useCallback(() => {
    setInitError(null)
    setInitStep('checking_session')
    AsyncStorage.getItem('token').then((token) => {
      if (!token) { setInitStep('done'); setLoading(false); return }
      setInitStep('connecting')
      authApi.me()
        .then((res) => setUser(res.data))
        .catch((err) => {
          AsyncStorage.removeItem('token')
          // ECONNABORTED (timeout de axios) o "Network Error" — no es una sesión inválida,
          // es que no se pudo llegar al servidor. Vale la pena decírselo a quien lo usa en
          // vez de mandarlo a Login como si nada, sin explicación.
          if (err.code === 'ECONNABORTED' || err.message === 'Network Error') {
            setInitError('network')
          }
        })
        .finally(() => { setInitStep('done'); setLoading(false) })
    })
  }, [])

  useEffect(() => { runInitCheck() }, [runInitCheck])

  // Sesión invalidada del lado del servidor (token vencido/revocado): api.js no puede usar
  // hooks, así que solo avisa acá — AppNavigator ya cambia solo al stack sin sesión apenas
  // `user` pasa a null (mismo mecanismo que el logout manual).
  useEffect(() => {
    setOnUnauthorized(() => setUser(null))
  }, [])

  // login/register/verifyCode comparten forma de respuesta (igual que la web — ver
  // AuthContext.jsx allá): o bien {verification_required: true, email, reason, dev_code?}
  // (falta confirmar un código de 6 dígitos por correo — correo nunca verificado o
  // dispositivo nuevo para esa cuenta) o bien {token, user} (sesión completa). Solo en el
  // segundo caso se guarda el token — el caller (LoginScreen/RegisterScreen) decide qué
  // pantalla mostrar según cuál llegó.
  const login = useCallback(async (email, password) => {
    const res = await authApi.login(email, password)
    if (res.data.token) {
      await AsyncStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  const register = useCallback(async (email, password) => {
    const res = await authApi.register(email, password)
    if (res.data.token) {
      await AsyncStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  const verifyCode = useCallback(async (email, code) => {
    const res = await authApi.verifyCode(email, code)
    if (res.data.token) {
      await AsyncStorage.setItem('token', res.data.token)
      setUser(res.data.user)
    }
    return res.data
  }, [])

  const logout = useCallback(async () => {
    await AsyncStorage.removeItem('token')
    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{
      user, loading, login, register, verifyCode, logout,
      initStep, initError, retryInit: runInitCheck,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}
