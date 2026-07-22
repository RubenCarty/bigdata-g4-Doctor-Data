import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import Screen from '../components/Screen'

export default function LoginScreen({ navigation }) {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      const data = await login(email, password)
      if (data.verification_required) {
        navigation.navigate('VerifyCode', { email: data.email, reason: data.reason, devCode: data.dev_code })
      }
      // Si no, el navigator maneja la redirección según el estado de auth
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar sesión')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/images/Doctor_Data_logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Iniciar sesión</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Correo electrónico"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          placeholder="Contraseña (mín. 8 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleLogin}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Ingresando...' : 'Ingresar'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} style={styles.link}>
          <Text style={styles.linkText}>¿Olvidaste tu contraseña?</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.link}>
          <Text style={styles.linkText}>Crear cuenta nueva</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f0f9ff',
  },
  logo: { width: '100%', height: 56, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  error: {
    backgroundColor: '#fef2f2',
    color: '#dc2626',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    fontSize: 14,
  },
  input: {
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontWeight: '600', fontSize: 16 },
  link: { marginTop: 16, alignItems: 'center' },
  linkText: { color: '#2563eb', fontSize: 14 },
})
