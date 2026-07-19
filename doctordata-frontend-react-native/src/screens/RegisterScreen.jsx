import { useState } from 'react'
import {
  View, Text, TextInput, TouchableOpacity, Image,
  StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Linking,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import Screen from '../components/Screen'

// Mismos documentos que sirve la web (doctordata-frontend-react-vite/public/docs/) — ahí se
// sirven sin hash de Vite justo para tener una URL estable a la que este link nativo pueda
// apuntar siempre, sin depender del nombre de archivo que genere cada build del frontend web.
const TERMS_URL = 'https://qa.mydoctordata.net/docs/Terminos_y_Condiciones_DoctorData.pdf'
const PRIVACY_URL = 'https://qa.mydoctordata.net/docs/Politica_de_Privacidad_DoctorData.pdf'

export default function RegisterScreen({ navigation }) {
  const { register } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [acceptedPrivacy, setAcceptedPrivacy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister() {
    setError('')
    if (password !== confirm) { setError('Las contraseñas no coinciden'); return }
    if (password.length < 8) { setError('La contraseña debe tener al menos 8 caracteres'); return }
    if (!acceptedTerms || !acceptedPrivacy) {
      setError('Debes aceptar los términos y condiciones y la política de privacidad')
      return
    }
    setLoading(true)
    try {
      const data = await register(email, password)
      if (data.verification_required) {
        navigation.navigate('VerifyCode', { email: data.email, reason: data.reason, devCode: data.dev_code })
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Error al registrarse')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <Image source={require('../assets/images/Doctor_Data_logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.subtitle}>Crear cuenta</Text>

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
        />
        <TextInput
          style={styles.input}
          placeholder="Confirmar contraseña"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
        />

        <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedTerms((v) => !v)} activeOpacity={0.7}>
          <View style={[styles.checkbox, acceptedTerms && styles.checkboxChecked]}>
            {acceptedTerms && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            Acepto haber leído y estar de acuerdo con los{' '}
            <Text style={styles.checkLink} onPress={() => Linking.openURL(TERMS_URL)}>términos y condiciones</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => setAcceptedPrivacy((v) => !v)} activeOpacity={0.7}>
          <View style={[styles.checkbox, acceptedPrivacy && styles.checkboxChecked]}>
            {acceptedPrivacy && <Text style={styles.checkboxMark}>✓</Text>}
          </View>
          <Text style={styles.checkLabel}>
            Acepto haber leído y estar de acuerdo con las{' '}
            <Text style={styles.checkLink} onPress={() => Linking.openURL(PRIVACY_URL)}>políticas de privacidad</Text>.
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleRegister}
          disabled={loading}
        >
          <Text style={styles.btnText}>{loading ? 'Registrando...' : 'Crear cuenta'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.link}>
          <Text style={styles.linkText}>¿Ya tienes cuenta? Iniciar sesión</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, justifyContent: 'center', padding: 24, backgroundColor: '#f0f9ff' },
  logo: { width: '100%', height: 56, marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6b7280', marginBottom: 24 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10, gap: 10 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: '#9ca3af',
    alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: 'white',
  },
  checkboxChecked: { backgroundColor: '#2563eb', borderColor: '#2563eb' },
  checkboxMark: { color: 'white', fontSize: 13, fontWeight: '700' },
  checkLabel: { flex: 1, fontSize: 13, color: '#374151', lineHeight: 18 },
  checkLink: { color: '#2563eb', textDecorationLine: 'underline' },
  error: {
    backgroundColor: '#fef2f2', color: '#dc2626',
    padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 14,
  },
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
