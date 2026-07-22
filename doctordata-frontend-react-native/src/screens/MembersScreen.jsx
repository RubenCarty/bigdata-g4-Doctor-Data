import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native'
import { useAuth } from '../context/AuthContext'
import { memberApi } from '../services/api'
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
  first_name: '', last_name: '', birth_date: '', gender: '', phone: '', email: '',
  document_type: '', document_number: '', blood_type: '', health_insurance: '',
  emergency_contact_name: '', emergency_contact_phone: '', emergency_contact_relationship: '',
}

// Gestión de las personas cubiertas por la suscripción del titular — mismos campos que
// PersonFields en OnboardingProtive.jsx (web). Los datos propios del titular se editan en
// PatientProfileScreen (no se duplican acá).
export default function MembersScreen({ navigation }) {
  const { user } = useAuth()
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [nominatingId, setNominatingId] = useState(null)
  const [picker, setPicker] = useState(null)

  // memberApi.list() incluye también el perfil propio del titular (user_id === el propio) —
  // se excluye acá porque "mis datos" ya se edita aparte en PatientProfileScreen. Ojo: no
  // alcanza con "!m.user_id" — una persona cubierta nombrada médico también tiene user_id
  // propio (el suyo, no el del titular) y debe seguir apareciendo en esta lista.
  const load = useCallback(() => {
    setLoading(true)
    memberApi.list()
      .then((r) => setMembers((r.data ?? []).filter((m) => m.user_id !== user?.id)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [user?.id])

  useFocusEffect(useCallback(() => { load() }, [load]))

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  function openAdd() { setForm(EMPTY); setEditingId(null) }

  function openEdit(m) {
    setForm({
      first_name: m.first_name ?? '', last_name: m.last_name ?? '',
      birth_date: m.birth_date ? m.birth_date.substring(0, 10) : '',
      gender: m.gender ?? '', phone: m.phone ?? '', email: m.email ?? '',
      document_type: m.document_type ?? '', document_number: m.document_number ?? '',
      blood_type: m.blood_type ?? '', health_insurance: m.health_insurance ?? '',
      emergency_contact_name: m.emergency_contact_name ?? '',
      emergency_contact_phone: m.emergency_contact_phone ?? '',
      emergency_contact_relationship: m.emergency_contact_relationship ?? '',
    })
    setEditingId(m.id)
  }

  async function save() {
    if (!form.first_name.trim() || !form.last_name.trim()) {
      Alert.alert('Campos requeridos', 'Nombre y apellido son obligatorios.')
      return
    }
    setSaving(true)
    try {
      if (editingId) await memberApi.update(editingId, form)
      else await memberApi.create(form)
      setForm(null)
      setEditingId(null)
      load()
    } catch (err) {
      const code = err.response?.data?.error
      Alert.alert('Error', code === 'capacity_exceeded'
        ? 'Ya alcanzaste el límite de personas de tus suscripciones.'
        : (code || 'No se pudo guardar.'))
    } finally { setSaving(false) }
  }

  function remove(m) {
    Alert.alert('Quitar persona', `¿Quitar a ${m.first_name} de tu grupo cubierto?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Quitar', style: 'destructive',
        onPress: async () => {
          try { await memberApi.remove(m.id); load() }
          catch { Alert.alert('Error', 'No se pudo quitar a la persona.') }
        },
      },
    ])
  }

  function nominateDoctor(m) {
    Alert.alert(
      'Nombrar médico',
      `¿Nombrar médico a ${m.first_name}? Le enviaremos un correo a ${m.email} para que defina su propia contraseña y pueda iniciar sesión.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Nombrar médico',
          onPress: async () => {
            setNominatingId(m.id)
            try {
              await memberApi.nominateDoctor(m.id)
              Alert.alert('Listo', `Le enviamos un correo a ${m.email} para que active su cuenta de médico.`)
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'No se pudo nombrar médico.')
            } finally { setNominatingId(null) }
          },
        },
      ],
    )
  }

  const genderLabel = form ? (GENDERS.find((g) => g.value === form.gender)?.label || 'Seleccionar') : ''
  const bloodLabel  = form ? (BLOOD_TYPES.find((b) => b.value === form.blood_type)?.label || 'Desconocido') : ''
  const docLabel    = form ? (DOC_TYPES.find((d) => d.value === form.document_type)?.label || 'Seleccionar') : ''

  return (
    <Screen>
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerText}>{members.length} persona(s) cubierta(s)</Text>
        <TouchableOpacity style={s.addBtn} onPress={openAdd}>
          <Text style={s.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#16a34a" />
      ) : members.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.empty}>Aún no agregaste a nadie más.</Text>
        </View>
      ) : (
        <FlatList
          data={members}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <View style={s.card}>
              <View style={{ flex: 1 }}>
                <Text style={s.cardTitle}>{item.first_name} {item.last_name}</Text>
                {item.email ? <Text style={s.cardSub}>{item.email}</Text> : null}
              </View>
              <View style={s.cardActions}>
                {item.email && !item.user_id && (
                  <TouchableOpacity
                    style={[s.smallBtn, s.smallBtnOutline]}
                    onPress={() => nominateDoctor(item)}
                    disabled={nominatingId === item.id}
                  >
                    <Text style={s.smallBtnOutlineText}>
                      {nominatingId === item.id ? 'Enviando...' : 'Nombrar médico'}
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[s.smallBtn, s.smallBtnOutline]} onPress={() => openEdit(item)}>
                  <Text style={s.smallBtnOutlineText}>Editar</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.smallBtn, s.smallBtnDanger]} onPress={() => remove(item)}>
                  <Text style={s.smallBtnDangerText}>Quitar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      {form && (
        <Modal visible animationType="slide" onRequestClose={() => setForm(null)}>
          <View style={m.container}>
            <View style={m.header}>
              <Text style={m.title}>{editingId ? 'Editar persona' : 'Agregar persona cubierta'}</Text>
              <TouchableOpacity onPress={() => setForm(null)}>
                <Text style={m.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
              <MField label="Nombres *">
                <TextInput style={m.input} value={form.first_name} onChangeText={(v) => set('first_name', v)} />
              </MField>
              <MField label="Apellidos *">
                <TextInput style={m.input} value={form.last_name} onChangeText={(v) => set('last_name', v)} />
              </MField>
              <MField label="Fecha de nacimiento">
                <TextInput style={m.input} value={form.birth_date} onChangeText={(v) => set('birth_date', v)} placeholder="AAAA-MM-DD" />
              </MField>
              <MField label="Género">
                <TouchableOpacity style={m.select} onPress={() => setPicker('gender')}>
                  <Text style={m.selectText}>{genderLabel}</Text>
                </TouchableOpacity>
              </MField>
              <MField label="Teléfono">
                <TextInput style={m.input} value={form.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
              </MField>
              <MField label="Correo electrónico">
                <TextInput style={m.input} value={form.email} onChangeText={(v) => set('email', v)}
                  placeholder="Necesario para poder nombrarla médico" keyboardType="email-address" autoCapitalize="none" />
              </MField>
              <MField label="Tipo de documento">
                <TouchableOpacity style={m.select} onPress={() => setPicker('document_type')}>
                  <Text style={m.selectText}>{docLabel}</Text>
                </TouchableOpacity>
              </MField>
              <MField label="Número de documento">
                <TextInput style={m.input} value={form.document_number} onChangeText={(v) => set('document_number', v)} />
              </MField>
              <MField label="Grupo sanguíneo">
                <TouchableOpacity style={m.select} onPress={() => setPicker('blood_type')}>
                  <Text style={m.selectText}>{bloodLabel}</Text>
                </TouchableOpacity>
              </MField>
              <MField label="Seguro de salud">
                <TextInput style={m.input} value={form.health_insurance} onChangeText={(v) => set('health_insurance', v)}
                  placeholder="EsSalud, SIS, Rimac..." />
              </MField>
              <MField label="Contacto de emergencia">
                <TextInput style={m.input} value={form.emergency_contact_name} onChangeText={(v) => set('emergency_contact_name', v)} />
              </MField>
              <MField label="Teléfono de emergencia">
                <TextInput style={m.input} value={form.emergency_contact_phone} onChangeText={(v) => set('emergency_contact_phone', v)} keyboardType="phone-pad" />
              </MField>
              <MField label="Parentesco / relación">
                <TextInput style={m.input} value={form.emergency_contact_relationship} onChangeText={(v) => set('emergency_contact_relationship', v)}
                  placeholder="Ej. Madre, esposo, hijo" />
              </MField>

              <TouchableOpacity style={[m.btn, saving && m.btnDisabled]} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color="white" /> : <Text style={m.btnText}>Guardar</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>

          <SelectModal visible={picker === 'gender'} title="Género" options={GENDERS}
            value={form.gender} onSelect={(v) => set('gender', v)} onClose={() => setPicker(null)} />
          <SelectModal visible={picker === 'blood_type'} title="Grupo sanguíneo" options={BLOOD_TYPES}
            value={form.blood_type} onSelect={(v) => set('blood_type', v)} onClose={() => setPicker(null)} />
          <SelectModal visible={picker === 'document_type'} title="Tipo de documento" options={DOC_TYPES}
            value={form.document_type} onSelect={(v) => set('document_type', v)} onClose={() => setPicker(null)} />
        </Modal>
      )}
    </View>
    </Screen>
  )
}

function MField({ label, children }) {
  return (
    <View style={m.field}>
      <Text style={m.label}>{label}</Text>
      {children}
    </View>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  headerText: { fontSize: 13, color: '#6b7280' },
  addBtn: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  empty: { textAlign: 'center', color: '#6b7280', fontSize: 15 },
  list: { padding: 16, gap: 10 },
  card: { backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  cardSub: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  smallBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  smallBtnOutline: { borderWidth: 1, borderColor: '#16a34a' },
  smallBtnOutlineText: { color: '#16a34a', fontSize: 12, fontWeight: '500' },
  smallBtnDanger: { borderWidth: 1, borderColor: '#fca5a5' },
  smallBtnDangerText: { color: '#dc2626', fontSize: 12, fontWeight: '500' },
})

const m = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  title: { fontSize: 18, fontWeight: '700', color: '#111827' },
  close: { fontSize: 20, color: '#6b7280', paddingHorizontal: 4 },
  content: { padding: 20, paddingBottom: 48 },
  field: { marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: 'white' },
  select: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 12, backgroundColor: 'white' },
  selectText: { fontSize: 15, color: '#111827' },
  btn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
})
