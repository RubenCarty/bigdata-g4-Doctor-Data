import { useState } from 'react'
import {
  Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { authApi } from '../services/api'
import Screen from '../components/Screen'

export default function ForgotPasswordScreen({ navigation }) {
  const [step, setStep] = useState('request')
  const [email, setEmail] = useState('')
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRequest() {
    setError('')
    setLoading(true)
    try {
      const res = await authApi.forgotPassword(email)
      if (res.data.reset_token) {
        setToken(res.data.reset_token)
        setMessage('Token generado. En producción se enviaría por email.')
      } else {
        setMessage(res.data.message)
      }
      setStep('reset')
    } catch (err) {
      setError(err.response?.data?.error || 'Error al solicitar recuperación')
    } finally {
      setLoading(false)
    }
  }

  async function handleReset() {
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    setLoading(true)
    try {
      await authApi.resetPassword(token, password)
      setMessage('Contraseña cambiada correctamente')
      setStep('done')
    } catch (err) {
      setError(err.response?.data?.error || 'Token inválido o expirado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Recuperar contraseña</Text>

        {message ? <Text style={styles.info}>{message}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {step === 'request' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Correo electrónico"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRequest} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Enviando...' : 'Solicitar recuperación'}</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'reset' && (
          <>
            <TextInput
              style={styles.input}
              placeholder="Token de recuperación"
              value={token}
              onChangeText={setToken}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.input}
              placeholder="Nueva contraseña"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
            />
            <TextInput
              style={styles.input}
              placeholder="Confirmar contraseña"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
            />
            <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleReset} disabled={loading}>
              <Text style={styles.btnText}>{loading ? 'Cambiando...' : 'Cambiar contraseña'}</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>Volver al inicio de sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f0f9ff' },
  title: { fontSize: 22, fontWeight: '700', color: '#2563eb', marginBottom: 20 },
  info: { backgroundColor: '#eff6ff', color: '#1d4ed8', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  error: { backgroundColor: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  input: {
    backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 12,
  },
  btn: { backgroundColor: '#2563eb', borderRadius: 8, padding: 14, alignItems: 'center', marginTop: 4 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 14 },
})
