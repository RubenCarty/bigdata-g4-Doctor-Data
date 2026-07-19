import { useState, useEffect } from 'react'
import { View, Text, StyleSheet } from 'react-native'
import axios from 'axios'
import { API_BASE } from '../services/api'

const DEBUG = process.env.EXPO_PUBLIC_DEBUG_MODE === 'true'

// Banner fijo en la parte de arriba de la pantalla — solo cuando EXPO_PUBLIC_DEBUG_MODE=true
// (así queda apagado en un build de producción real). En una APK instalada no hay forma de
// ver console.log, así que esto hace las veces de "devlog": confirma que el JS está vivo
// (si esto se ve, la app no está congelada) y si el servidor configurado responde — para
// distinguir "está cargando" de "no puede llegar a QA" sin adivinar.
export default function DebugBanner() {
  const [status, setStatus] = useState('checking') // checking | ok | error

  useEffect(() => {
    if (!DEBUG) return
    let cancelled = false
    // /public/plans: mismo endpoint que la app ya usa de verdad (sin auth) — confirma no solo
    // que el servidor responde, sino que la ruta /api/* de Caddy y el backend están sanos.
    axios.get(`${API_BASE}/public/plans`, { timeout: 8000 })
      .then(() => { if (!cancelled) setStatus('ok') })
      .catch(() => { if (!cancelled) setStatus('error') })
    return () => { cancelled = true }
  }, [])

  if (!DEBUG) return null

  return (
    <View style={s.banner} pointerEvents="none">
      <Text style={s.text} numberOfLines={1}>
        🐛 QA · {API_BASE} · {status === 'checking' ? 'conectando...' : status === 'ok' ? 'servidor OK' : 'sin conexión al servidor'}
      </Text>
    </View>
  )
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 9999,
    backgroundColor: '#111827', paddingTop: 28, paddingBottom: 6, paddingHorizontal: 10,
  },
  text: { color: '#facc15', fontSize: 10, fontFamily: 'monospace' },
})
