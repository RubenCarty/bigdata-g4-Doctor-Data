import { useState, useEffect } from 'react'
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, Image, KeyboardAvoidingView, Platform,
  ActivityIndicator,
} from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { patientApi, API_BASE } from '../services/api'
import SelectModal from '../components/SelectModal'
import Screen from '../components/Screen'

const GENDERS = [
  { value: '', label: 'Prefiero no indicar' },
  { value: 'male', label: 'Masculino' },
  { value: 'female', label: 'Femenino' },
  { value: 'other', label: 'Otro' },
]

const BLOOD_TYPES = [
  { value: '', label: 'Desconocido' },
  ...['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((v) => ({ value: v, label: v })),
]

const DOC_TYPES = [
  { value: '', label: 'Seleccionar' },
  ...['DNI', 'PASSPORT', 'CIP', 'CE'].map((v) => ({ value: v, label: v })),
]

const EMPTY = {
  first_name: '', last_name: '', birth_date: '', gender: '',
  phone: '', document_type: '', document_number: '',
  address_street: '', address_city: '', address_state: '',
  address_country: 'PE', address_postal_code: '',
  blood_type: '', is_smoker: false,
  is_alcohol_consumer: false, has_psychological_conditions: false,
}

export default function PatientProfileScreen() {
  const [form, setForm]       = useState(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [isNew, setIsNew]     = useState(false)
  const [photoUri, setPhotoUri]     = useState(null)
  const [uploading, setUploading]   = useState(false)
  const [picker, setPicker]         = useState(null)

  useEffect(() => {
    patientApi.getMyProfile()
      .then((r) => {
        const p = r.data
        if (p.profile_photo_url) setPhotoUri(API_BASE + p.profile_photo_url)
        setForm({
          first_name:                   p.first_name ?? '',
          last_name:                    p.last_name ?? '',
          birth_date:                   p.birth_date ? p.birth_date.substring(0, 10) : '',
          gender:                       p.gender ?? '',
          phone:                        p.phone ?? '',
          document_type:                p.document_type ?? '',
          document_number:              p.document_number ?? '',
          address_street:               p.address_street ?? '',
          address_city:                 p.address_city ?? '',
          address_state:                p.address_state ?? '',
          address_country:              p.address_country ?? 'PE',
          address_postal_code:          p.address_postal_code ?? '',
          blood_type:                   p.blood_type ?? '',
          is_smoker:                    p.is_smoker ?? false,
          is_alcohol_consumer:          p.is_alcohol_consumer ?? false,
          has_psychological_conditions: p.has_psychological_conditions ?? false,
        })
      })
      .catch((err) => {
        if (err.response?.data?.error === 'no_profile') setIsNew(true)
      })
      .finally(() => setLoading(false))
  }, [])

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function pickPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso requerido', 'Se necesita acceso a la galería para seleccionar fotos.')
      return
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [3, 4],
      quality: 0.85,
    })
    if (result.canceled) return
    const uri = result.assets[0].uri
    setPhotoUri(uri)
    setUploading(true)
    try {
      await patientApi.uploadProfilePhoto(uri)
      Alert.alert('Foto guardada', 'Tu foto de perfil fue actualizada.')
    } catch {
      Alert.alert('Error', 'No se pudo subir la foto.')
    } finally { setUploading(false) }
  }

  async function save() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y apellido son obligatorios.')
      return
    }
    setSaving(true)
    try {
      await patientApi.updateMyProfile(form)
      setIsNew(false)
      Alert.alert('Guardado', isNew ? 'Perfil creado correctamente.' : 'Cambios guardados.')
    } catch {
      Alert.alert('Error', 'No se pudo guardar el perfil. Verifica tu conexión.')
    } finally { setSaving(false) }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#16a34a" /></View>
  }

  const genderLabel = GENDERS.find((g) => g.value === form.gender)?.label || 'Seleccionar'
  const bloodLabel  = BLOOD_TYPES.find((b) => b.value === form.blood_type)?.label || 'Desconocido'
  const docLabel    = DOC_TYPES.find((d) => d.value === form.document_type)?.label || 'Seleccionar'

  return (
    <Screen>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">

        {isNew && (
          <View style={s.infoBox}>
            <Text style={s.infoText}>Completa tu perfil para activar el código QR de emergencia.</Text>
          </View>
        )}

        {/* ── Foto de perfil ─────────────────────────── */}
        <SectionTitle>Foto de perfil</SectionTitle>
        <View style={s.photoRow}>
          <TouchableOpacity onPress={pickPhoto} disabled={uploading}>
            {photoUri
              ? <Image source={{ uri: photoUri }} style={s.photoPreview} />
              : <View style={[s.photoPreview, s.photoEmpty]}>
                  <Text style={s.photoEmptyText}>Sin foto</Text>
                </View>}
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <TouchableOpacity style={s.btnOutline} onPress={pickPhoto} disabled={uploading}>
              {uploading
                ? <ActivityIndicator size="small" color="#16a34a" />
                : <Text style={s.btnOutlineText}>{photoUri ? 'Cambiar foto' : 'Seleccionar foto'}</Text>}
            </TouchableOpacity>
            <Text style={s.hint}>Aparecerá en tu perfil público de emergencia.</Text>
          </View>
        </View>

        {/* ── Identificación ─────────────────────────── */}
        <SectionTitle>Identificación</SectionTitle>
        <Row>
          <Field label="Nombre *" flex={1}>
            <TextInput style={s.input} value={form.first_name}
              onChangeText={(v) => set('first_name', v)} placeholder="Nombre" />
          </Field>
          <Field label="Apellido *" flex={1}>
            <TextInput style={s.input} value={form.last_name}
              onChangeText={(v) => set('last_name', v)} placeholder="Apellido" />
          </Field>
        </Row>

        <Row>
          <Field label="Fecha de nacimiento" flex={1}>
            <TextInput style={s.input} value={form.birth_date}
              onChangeText={(v) => set('birth_date', v)} placeholder="AAAA-MM-DD" />
          </Field>
          <Field label="Género" flex={1}>
            <TouchableOpacity style={s.select} onPress={() => setPicker('gender')}>
              <Text style={form.gender ? s.selectText : s.selectPlaceholder}>{genderLabel}</Text>
            </TouchableOpacity>
          </Field>
        </Row>

        <Field label="Teléfono">
          <TextInput style={s.input} value={form.phone}
            onChangeText={(v) => set('phone', v)} placeholder="+51 999 999 999"
            keyboardType="phone-pad" />
        </Field>

        <Row>
          <Field label="Tipo de documento" flex={1}>
            <TouchableOpacity style={s.select} onPress={() => setPicker('document_type')}>
              <Text style={form.document_type ? s.selectText : s.selectPlaceholder}>{docLabel}</Text>
            </TouchableOpacity>
          </Field>
          <Field label="Número" flex={1.3}>
            <TextInput style={s.input} value={form.document_number}
              onChangeText={(v) => set('document_number', v)} placeholder="12345678" />
          </Field>
        </Row>

        {/* ── Dirección ─────────────────────────────── */}
        <SectionTitle>Dirección</SectionTitle>
        <Field label="Calle / Av.">
          <TextInput style={s.input} value={form.address_street}
            onChangeText={(v) => set('address_street', v)} placeholder="Av. Universitaria 1801" />
        </Field>
        <Row>
          <Field label="Ciudad" flex={1}>
            <TextInput style={s.input} value={form.address_city}
              onChangeText={(v) => set('address_city', v)} placeholder="Lima" />
          </Field>
          <Field label="Región" flex={1}>
            <TextInput style={s.input} value={form.address_state}
              onChangeText={(v) => set('address_state', v)} placeholder="Lima" />
          </Field>
        </Row>

        {/* ── Información clínica rápida ──────────────── */}
        <SectionTitle>Información clínica rápida</SectionTitle>
        <Text style={s.hint}>Visible para cualquier médico que escanee tu QR — crucial en emergencias.</Text>

        <Field label="Grupo sanguíneo">
          <TouchableOpacity style={s.select} onPress={() => setPicker('blood_type')}>
            <Text style={s.selectText}>{bloodLabel}</Text>
          </TouchableOpacity>
        </Field>

        <Toggle label="Fumador" value={form.is_smoker} onChange={(v) => set('is_smoker', v)} />
        <Toggle label="Consume alcohol" value={form.is_alcohol_consumer} onChange={(v) => set('is_alcohol_consumer', v)} />
        <Toggle label="Presenta condición psicológica o psiquiátrica"
          value={form.has_psychological_conditions} onChange={(v) => set('has_psychological_conditions', v)} />

        {/* ── Guardar ─────────────────────────────────── */}
        <TouchableOpacity style={[s.btn, saving && s.btnDisabled]} onPress={save} disabled={saving}>
          {saving
            ? <ActivityIndicator color="white" />
            : <Text style={s.btnText}>{isNew ? 'Crear perfil' : 'Guardar cambios'}</Text>}
        </TouchableOpacity>

      </ScrollView>

      <SelectModal visible={picker === 'gender'} title="Género"
        options={GENDERS} value={form.gender}
        onSelect={(v) => set('gender', v)} onClose={() => setPicker(null)} />
      <SelectModal visible={picker === 'blood_type'} title="Grupo sanguíneo"
        options={BLOOD_TYPES} value={form.blood_type}
        onSelect={(v) => set('blood_type', v)} onClose={() => setPicker(null)} />
      <SelectModal visible={picker === 'document_type'} title="Tipo de documento"
        options={DOC_TYPES} value={form.document_type}
        onSelect={(v) => set('document_type', v)} onClose={() => setPicker(null)} />
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

function Toggle({ label, value, onChange }) {
  return (
    <TouchableOpacity style={s.toggle} onPress={() => onChange(!value)} activeOpacity={0.7}>
      <View style={[s.checkbox, value && s.checkboxChecked]}>
        {value && <Text style={s.checkmark}>✓</Text>}
      </View>
      <Text style={s.toggleLabel}>{label}</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  infoBox: { backgroundColor: '#dbeafe', borderRadius: 8, padding: 12, marginBottom: 16 },
  infoText: { color: '#1e40af', fontSize: 14 },
  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#6b7280',
    textTransform: 'uppercase', letterSpacing: 0.6,
    marginTop: 20, marginBottom: 10,
  },
  photoRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  photoPreview: { width: 90, height: 120, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  photoEmpty: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  photoEmptyText: { color: '#9ca3af', fontSize: 11, textAlign: 'center' },
  btnOutline: {
    borderWidth: 1, borderColor: '#16a34a', borderRadius: 8,
    padding: 10, alignItems: 'center',
  },
  btnOutlineText: { color: '#16a34a', fontSize: 14, fontWeight: '500' },
  hint: { color: '#9ca3af', fontSize: 12, marginTop: 6, lineHeight: 17 },
  row: { flexDirection: 'row', gap: 10 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 15, color: '#111827', backgroundColor: 'white',
  },
  select: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'white',
  },
  selectText: { fontSize: 15, color: '#111827' },
  selectPlaceholder: { fontSize: 15, color: '#9ca3af' },
  toggle: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12, gap: 12 },
  checkbox: {
    width: 22, height: 22, borderWidth: 1.5, borderColor: '#d1d5db',
    borderRadius: 4, justifyContent: 'center', alignItems: 'center',
    marginTop: 1,
  },
  checkboxChecked: { backgroundColor: '#16a34a', borderColor: '#16a34a' },
  checkmark: { color: 'white', fontSize: 13, fontWeight: '700' },
  toggleLabel: { fontSize: 14, color: '#374151', flex: 1 },
  btn: {
    backgroundColor: '#16a34a', borderRadius: 10,
    padding: 15, alignItems: 'center', marginTop: 24,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
})
