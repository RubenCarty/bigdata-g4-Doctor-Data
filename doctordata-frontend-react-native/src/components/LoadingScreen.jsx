import { View, Image, Text, StyleSheet, TouchableOpacity } from 'react-native'
import { API_BASE } from '../services/api'

// Marcador de build, a mano (no depende de ningún módulo nativo como expo-constants) — la
// forma más a prueba de balas de confirmar en pantalla, apenas React pinta algo, que el APK
// instalado es realmente el build nuevo y no uno viejo que quedó pegado por un reinstalo que
// no se completó. Bump manual en cada build de diagnóstico.
export const BUILD_MARKER = 'build 8 SDK54 - 2026-07-15'

// Pantalla de carga con progreso real por pasos — reemplaza el spinner genérico de antes, que
// no distinguía "cargando" de "colgado". Cada paso de arranque real de la app (fuentes →
// sesión guardada → conexión al servidor) mueve la barra y cambia el mensaje, así que si algo
// se traba, se ve EXACTAMENTE en qué paso quedó — no hace falta conectar el celular a nada
// para diagnosticarlo, todo queda visible en la propia pantalla.
const STEPS = {
  fonts:            { progress: 0.30, message: 'Cargando recursos...' },
  checking_session: { progress: 0.55, message: 'Verificando sesión guardada...' },
  connecting:       { progress: 0.80, message: `Conectando con ${API_BASE}...` },
  done:             { progress: 1.00, message: 'Listo' },
}

const ERRORS = {
  network: {
    title: 'No se pudo conectar al servidor',
    message: `${API_BASE}\nRevisa tu conexión a internet e intenta de nuevo.`,
  },
  fonts: {
    title: 'No se pudieron cargar los recursos',
    message: 'Vuelve a abrir la app. Si el problema sigue, puede que la instalación esté dañada.',
  },
}

export default function LoadingScreen({ step, error, onRetry }) {
  const { progress, message } = STEPS[step] || STEPS.fonts
  const errorInfo = error ? ERRORS[error] : null

  return (
    <View style={s.container}>
      <Image
        source={require('../assets/images/Doctor_Data_logo.png')}
        style={s.logo}
        resizeMode="contain"
      />
      <Text style={s.buildMarker}>{BUILD_MARKER}</Text>

      {!errorInfo ? (
        <>
          <View style={s.track}>
            <View style={[s.fill, { width: `${Math.round(progress * 100)}%` }]} />
          </View>
          <Text style={s.message}>{message}</Text>
        </>
      ) : (
        <>
          <Text style={s.errorTitle}>{errorInfo.title}</Text>
          <Text style={s.errorMessage}>{errorInfo.message}</Text>
          {onRetry && (
            <TouchableOpacity style={s.retryBtn} onPress={onRetry}>
              <Text style={s.retryBtnText}>Reintentar</Text>
            </TouchableOpacity>
          )}
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 48,
  },
  logo: { width: '100%', height: 80 },
  buildMarker: { fontSize: 10, color: '#d1d5db', marginTop: 4, marginBottom: 28 },
  track: {
    width: '100%', height: 6, borderRadius: 3,
    backgroundColor: '#e5e7eb', overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: '#16a34a', borderRadius: 3 },
  message: { marginTop: 12, fontSize: 13, color: '#6b7280' },
  errorTitle: { fontSize: 16, fontWeight: '700', color: '#dc2626', textAlign: 'center' },
  errorMessage: { marginTop: 8, fontSize: 13, color: '#6b7280', textAlign: 'center', lineHeight: 19 },
  retryBtn: { marginTop: 20, backgroundColor: '#16a34a', borderRadius: 8, paddingHorizontal: 24, paddingVertical: 12 },
  retryBtnText: { color: 'white', fontSize: 15, fontWeight: '600' },
})
