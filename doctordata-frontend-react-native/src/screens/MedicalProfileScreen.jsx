import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { medicalApi, API_BASE } from '../services/api'
import Screen from '../components/Screen'

const STATUS = {
  pending:  { label: 'En revisión',  color: '#b45309', bg: '#fef3c7' },
  approved: { label: 'Aprobado',     color: '#166534', bg: '#dcfce7' },
  rejected: { label: 'Rechazado',    color: '#991b1b', bg: '#fee2e2' },
}

const EMPTY = {
  last_name: '', first_name: '', cmp_number: '',
  expedition_date: '', revalidation_date: '',
  specialty: '', position: '', institution: '',
}

export default function MedicalProfileScreen() {
  const [form, setForm]         = useState(EMPTY)
  const [profile, setProfile]   = useState(null)
  const [loading, setLoading]   = useState(true)
  const [saving, setSaving]     = useState(false)
  const [isNew, setIsNew]       = useState(false)
  const [photoUri, setPhotoUri] = useState(null)
  const [cardUri, setCardUri]   = useState(null)
  const [msg, setMsg]           = useState({ type: '', text: '' })

  useEffect(() => {
    medicalApi.getMyMedicalProfile()
      .then((r) => {
        const p = r.data
        setProfile(p)
        if (p.profile_photo_url) setPhotoUri(API_BASE + p.profile_photo_url)
        if (p.cmp_card_url)      setCardUri(API_BASE + p.cmp_card_url)
        setForm({
          last_name:         p.last_name         ?? '',
          first_name:        p.first_name        ?? '',
          cmp_number:        p.cmp_number        ?? '',
          expedition_date:   p.expedition_date   ? p.expedition_date.substring(0, 10)   : '',
          revalidation_date: p.revalidation_date ? p.revalidation_date.substring(0, 10) : '',
          specialty:         p.specialty         ?? '',
          position:          p.position          ?? '',
          institution:       p.institution       ?? '',
        })
      })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function pickImage(type) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería.')
      return
    }
    const isPhoto = type === 'photo'
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: isPhoto ? [3, 4] : [85, 54],
      quality: 0.85,
    })
    if (result.canceled) return
    const uri = result.assets[0].uri
    try {
      if (isPhoto) {
        setPhotoUri(uri)
        await medicalApi.uploadProfilePhoto(uri)
        setMsg({ type: 'ok', text: 'Foto personal guardada.' })
      } else {
        setCardUri(uri)
        await medicalApi.uploadCMPCard(uri)
        setMsg({ type: 'ok', text: 'Foto del carné guardada.' })
      }
    } catch {
      setMsg({ type: 'err', text: `Error al subir ${isPhoto ? 'la foto personal' : 'el carné'}.` })
    }
  }

  async function save() {
    if (!form.last_name.trim() || !form.first_name.trim() || !form.cmp_number.trim()) {
      Alert.alert('Campos requeridos', 'Nombres, apellidos y número CMP son obligatorios.')
      return
    }
    setSaving(true)
    setMsg({ type: '', text: '' })
    try {
      const r = await medicalApi.updateMyMedicalProfile(form)
      setProfile(r.data)
      setIsNew(false)
      setMsg({ type: 'ok', text: isNew ? 'Solicitud enviada. Un administrador revisará tu CMP.' : 'Datos actualizados correctamente.' })
    } catch (err) {
      setMsg({ type: 'err', text: err.response?.data?.error || 'Error al guardar los datos.' })
    } finally { setSaving(false) }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#16a34a" /></View>
  }

  const vs = profile?.validation_status
  const canEdit = !vs || vs === 'pending' || vs === 'rejected'
  const statusInfo = vs ? STATUS[vs] : null

  return (
    <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {/* Estado de validación */}
        {statusInfo && (
          <View style={[s.statusBox, { backgroundColor: statusInfo.bg }]}>
            <Text style={[s.statusText, { color: statusInfo.color }]}>
              Estado CMP: {statusInfo.label}
            </Text>
          </View>
        )}

        {isNew && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Ingresa los datos de tu carné CMP. Un administrador verificará tu colegiatura antes de aprobarla.
            </Text>
          </View>
        )}

        {vs === 'approved' && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>
              Tu perfil está aprobado. Solo puedes editar especialidad, puesto e institución.
            </Text>
          </View>
        )}

        {/* ── Fotos ─────────────────────────────────────── */}
        <SectionTitle>Fotos</SectionTitle>
        <View style={s.photosRow}>
          {/* Foto personal */}
          <View style={s.photoCol}>
            <Text style={s.photoLabel}>Foto personal</Text>
            <TouchableOpacity onPress={() => pickImage('photo')}>
              {photoUri
                ? <Image source={{ uri: photoUri }} style={s.photoPortrait} />
                : <View style={[s.photoPortrait, s.photoEmpty]}>
                    <Text style={s.photoEmptyText}>Seleccionar</Text>
                  </View>}
            </TouchableOpacity>
          </View>
          {/* Foto del carné */}
          <View style={s.photoCol}>
            <Text style={s.photoLabel}>Carné CMP</Text>
            <TouchableOpacity onPress={() => pickImage('card')}>
              {cardUri
                ? <Image source={{ uri: cardUri }} style={s.photoCard} />
                : <View style={[s.photoCard, s.photoEmpty]}>
                    <Text style={s.photoEmptyText}>Seleccionar</Text>
                  </View>}
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Datos del carné CMP ────────────────────────── */}
        <SectionTitle>Datos del carné CMP</SectionTitle>
        <Row>
          <Field label="Apellidos *" flex={1}>
            <TextInput style={[s.input, !canEdit && s.inputDisabled]}
              value={form.last_name} onChangeText={(v) => set('last_name', v)}
              placeholder="Tal como aparecen en el carné" editable={canEdit} />
          </Field>
          <Field label="Nombres *" flex={1}>
            <TextInput style={[s.input, !canEdit && s.inputDisabled]}
              value={form.first_name} onChangeText={(v) => set('first_name', v)}
              placeholder="Tal como aparecen en el carné" editable={canEdit} />
          </Field>
        </Row>

        <Row>
          <Field label="N.º Colegiatura *" flex={1}>
            <TextInput style={[s.input, !canEdit && s.inputDisabled]}
              value={form.cmp_number} onChangeText={(v) => set('cmp_number', v)}
              placeholder="Ej.: 111427" editable={canEdit} />
          </Field>
          <Field label="Fecha Expedición" flex={1}>
            <TextInput style={[s.input, !canEdit && s.inputDisabled]}
              value={form.expedition_date} onChangeText={(v) => set('expedition_date', v)}
              placeholder="AAAA-MM-DD" editable={canEdit} />
          </Field>
        </Row>

        <Field label="Fecha Revalidación">
          <TextInput style={[s.input, !canEdit && s.inputDisabled]}
            value={form.revalidation_date} onChangeText={(v) => set('revalidation_date', v)}
            placeholder="AAAA-MM-DD" editable={canEdit} />
        </Field>

        {/* ── Información adicional ─────────────────────── */}
        <SectionTitle>Información adicional</SectionTitle>
        <Field label="Especialidad">
          <TextInput style={s.input} value={form.specialty}
            onChangeText={(v) => set('specialty', v)}
            placeholder="Medicina general, Geriatría, Cardiología..." />
        </Field>
        <Field label="Puesto">
          <TextInput style={s.input} value={form.position}
            onChangeText={(v) => set('position', v)}
            placeholder="Médico asistente, Director de Geriatría..." />
        </Field>
        <Field label="Institución actual">
          <TextInput style={s.input} value={form.institution}
            onChangeText={(v) => set('institution', v)}
            placeholder="Hospital Nacional Arzobispo Loayza..." />
        </Field>

        {/* Mensaje de estado */}
        {msg.text ? (
          <View style={[s.msgBox, msg.type === 'ok' ? s.msgOk : s.msgErr]}>
            <Text style={[s.msgText, msg.type === 'ok' ? s.msgTextOk : s.msgTextErr]}>{msg.text}</Text>
          </View>
        ) : null}

        {/* Guardar */}
        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={s.btnText}>{isNew ? 'Enviar solicitud' : 'Actualizar datos'}</Text>}
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
    </Screen>
  )
}

function SectionTitle({ children }) {
  return <Text style={s.sectionTitle}>{children}</Text>
}

function Row({ children }) {
  return <View style={s.row}>{children}</View>
}

function Field({ label, children, flex }) {
  return (
    <View style={[s.field, flex != null && { flex }]}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  statusBox: { borderRadius: 8, padding: 12, marginBottom: 12 },
  statusText: { fontSize: 14, fontWeight: '600' },
  infoBox: { backgroundColor: '#dbeafe', borderRadius: 8, padding: 12, marginBottom: 12 },
  infoText: { color: '#1e40af', fontSize: 13, lineHeight: 18 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 20, marginBottom: 10,
  },
  photosRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  photoCol: { flex: 1, alignItems: 'center' },
  photoLabel: { fontSize: 12, color: '#6b7280', marginBottom: 6 },
  photoPortrait: { width: '100%', aspectRatio: 3 / 4, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  photoCard: { width: '100%', aspectRatio: 85.6 / 54, borderRadius: 6, borderWidth: 1, borderColor: '#e5e7eb' },
  photoEmpty: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  photoEmptyText: { color: '#9ca3af', fontSize: 11 },
  row: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827', backgroundColor: 'white',
  },
  inputDisabled: { backgroundColor: '#f9fafb', color: '#9ca3af' },
  msgBox: { borderRadius: 8, padding: 12, marginTop: 8 },
  msgOk: { backgroundColor: '#dcfce7' },
  msgErr: { backgroundColor: '#fee2e2' },
  msgText: { fontSize: 14 },
  msgTextOk: { color: '#166534' },
  msgTextErr: { color: '#991b1b' },
  btn: {
    backgroundColor: '#16a34a', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
})
