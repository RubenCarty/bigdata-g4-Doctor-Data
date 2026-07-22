import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { authApi } from '../services/api'
import Screen from '../components/Screen'

// Pantalla compartida de "ingresa el código de 6 dígitos" — la usan tanto RegisterScreen
// (correo recién registrado) como LoginScreen (dispositivo nunca antes visto para esa
// cuenta). Ambos casos resuelven exactamente igual del lado del backend
// (POST /auth/verify-code), así que comparten esta única implementación — mismo patrón que
// VerifyCodeForm.jsx en la web.
export default function VerifyCodeScreen({ route, navigation }) {
  const { email, reason, devCode } = route.params
  const { verifyCode } = useAuth()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [resending, setResending] = useState(false)
  const [resent, setResent] = useState(false)
  const [currentDevCode, setCurrentDevCode] = useState(devCode)

  async function handleSubmit() {
    setError('')
    setVerifying(true)
    try {
      await verifyCode(email, code)
      // El navigator maneja la redirección según el estado de auth (mismo mecanismo que login)
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
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Verifica tu correo</Text>
        <Text style={styles.subtitle}>
          {reason === 'new_device'
            ? 'Detectamos un inicio de sesión desde un dispositivo nuevo. '
            : ''}
          Ingresa el código que enviamos a <Text style={styles.bold}>{email}</Text> para continuar.
        </Text>

        {currentDevCode ? (
          <Text style={styles.info}>
            Modo desarrollo (sin SMTP configurado) — tu código es: {currentDevCode}
          </Text>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {resent ? <Text style={styles.info}>Enviamos un nuevo código.</Text> : null}

        <TextInput
          style={[styles.input, styles.codeInput]}
          placeholder="000000"
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          maxLength={6}
        />

        <TouchableOpacity
          style={[styles.btn, (verifying || code.length !== 6) && styles.btnDisabled]}
          onPress={handleSubmit}
          disabled={verifying || code.length !== 6}
        >
          <Text style={styles.btnText}>{verifying ? 'Verificando...' : 'Verificar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.linkBtn, resending && styles.btnDisabled]} onPress={handleResend} disabled={resending}>
          <Text style={styles.linkText}>{resending ? 'Reenviando...' : '¿No te llegó? Reenviar código'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f0f9ff' },
  title: { fontSize: 24, fontWeight: '700', color: '#2563eb', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20, lineHeight: 20 },
  bold: { fontWeight: '700', color: '#111827' },
  info: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 13 },
  error: { backgroundColor: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  input: {
    backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12,
  },
  codeInput: { fontSize: 24, textAlign: 'center', letterSpacing: 6 },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  linkBtn: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 14 },
})
