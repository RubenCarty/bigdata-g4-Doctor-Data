import { useState, useEffect, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TouchableOpacity, FlatList, StyleSheet,
  ActivityIndicator, Modal, TextInput, ScrollView, Alert,
} from 'react-native'
import { clinicalApi, memberApi } from '../services/api'
import SelectModal from '../components/SelectModal'
import Screen from '../components/Screen'

// ── Opciones para selects ────────────────────────────────────────────────────

const ALLERGY_CATEGORIES = [
  { value: 'food', label: 'Alimentaria' },
  { value: 'medication', label: 'Medicamento' },
  { value: 'environment', label: 'Ambiental' },
  { value: 'biologic', label: 'Biológica' },
  { value: 'other', label: 'Otra' },
]

const ALLERGY_CRITICALITIES = [
  { value: 'low', label: 'Baja' },
  { value: 'high', label: 'Alta' },
  { value: 'unable-to-assess', label: 'No evaluable' },
]

const CONDITION_STATUSES = [
  { value: 'active', label: 'Activa' },
  { value: 'recurrence', label: 'Recurrente' },
  { value: 'relapse', label: 'Recaída' },
  { value: 'inactive', label: 'Inactiva' },
  { value: 'remission', label: 'En remisión' },
  { value: 'resolved', label: 'Resuelta' },
]

const APPT_STATUSES = [
  { value: 'proposed', label: 'Propuesta' },
  { value: 'booked', label: 'Programada' },
  { value: 'arrived', label: 'Llegó' },
  { value: 'fulfilled', label: 'Atendida' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'noshow', label: 'No asistió' },
]

const RECORD_TYPES = [
  { value: 'vital-signs', label: 'Signos vitales' },
  { value: 'laboratory', label: 'Laboratorio' },
  { value: 'imaging', label: 'Imagen' },
  { value: 'procedure', label: 'Procedimiento' },
  { value: 'medication', label: 'Medicación' },
  { value: 'note', label: 'Nota clínica' },
  { value: 'social-history', label: 'Historia social' },
]

// ── Tabs ──────────────────────────────────────────────────────────────────────
// Ninguno de estos tabs está restringido a médicos — toda la información acá es del propio
// titular (o de una persona que administre), igual que ClinicalInfo.jsx en la web: la
// restricción "solo médicos" solo aplica cuando OTRO médico consulta por QR/ID, un caso fuera
// de alcance en esta app nativa (ver plan).

const TABS = [
  { key: 'allergies',       label: 'Alergias' },
  { key: 'conditions',      label: 'Condiciones' },
  { key: 'family-history',  label: 'Antecedentes' },
  { key: 'appointments',    label: 'Citas' },
  { key: 'leaves',          label: 'Descansos' },
  { key: 'records',         label: 'Registros' },
]

function fetchTab(key, pid) {
  if (key === 'allergies')      return clinicalApi.listAllergies(pid)
  if (key === 'conditions')     return clinicalApi.listConditions(pid)
  if (key === 'family-history') return clinicalApi.listFamilyHistory(pid)
  if (key === 'appointments')   return clinicalApi.listAppointments(pid)
  if (key === 'leaves')         return clinicalApi.listMedicalLeaves(pid)
  if (key === 'records')        return clinicalApi.listClinicalRecords(pid)
}

// ── Screen principal ──────────────────────────────────────────────────────────

export default function ClinicalInfoScreen() {
  const [members, setMembers] = useState([])
  const [selectedId, setSelectedId] = useState(null) // patient_profile_id, null = propio
  const [memberPicker, setMemberPicker] = useState(false)

  const [activeTab, setActiveTab]   = useState('allergies')
  const [data, setData]             = useState([])
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [modal, setModal] = useState(null) // { type, item } — item null = alta, item = edición

  useFocusEffect(useCallback(() => {
    memberApi.list().then((r) => setMembers(r.data ?? [])).catch(() => {})
  }, []))

  const loadTab = useCallback((tab, pid) => {
    setLoading(true)
    setError('')
    fetchTab(tab, pid)
      .then((r) => setData(r.data || []))
      .catch(() => { setError('Error al cargar los datos.'); setData([]) })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { loadTab(activeTab, selectedId) }, [activeTab, selectedId, loadTab])

  function changeTab(tab) { setActiveTab(tab); setData([]) }

  function reload() { loadTab(activeTab, selectedId) }

  const memberOptions = [
    { value: null, label: 'Yo' },
    ...members.filter((m) => m.id !== selectedSelfId(members)).map((m) => ({
      value: m.id, label: `${m.first_name} ${m.last_name}`.trim() || 'Sin nombre',
    })),
  ]
  const selectedLabel = memberOptions.find((o) => o.value === selectedId)?.label || 'Yo'

  return (
    <Screen>
    <View style={s.container}>
      {members.length > 1 && (
        <TouchableOpacity style={s.memberSelector} onPress={() => setMemberPicker(true)}>
          <Text style={s.memberSelectorLabel}>Información de:</Text>
          <Text style={s.memberSelectorValue}>{selectedLabel} ›</Text>
        </TouchableOpacity>
      )}

      {/* Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabBar} contentContainerStyle={s.tabBarContent}>
        {TABS.map((t) => (
          <TouchableOpacity key={t.key} style={[s.tab, activeTab === t.key && s.tabActive]} onPress={() => changeTab(t.key)}>
            <Text style={[s.tabText, activeTab === t.key && s.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Encabezado del tab con botón añadir */}
      <View style={s.tabHeader}>
        <Text style={s.tabHeaderCount}>{data.length} registro{data.length !== 1 ? 's' : ''}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => setModal({ type: activeTab, item: null })}>
          <Text style={s.addBtnText}>+ Agregar</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={s.error}>{error}</Text> : null}

      {loading ? (
        <ActivityIndicator style={s.loader} size="large" color="#16a34a" />
      ) : data.length === 0 ? (
        <View style={s.emptyContainer}>
          <Text style={s.empty}>Sin registros</Text>
          <TouchableOpacity style={s.addBtnLarge} onPress={() => setModal({ type: activeTab, item: null })}>
            <Text style={s.addBtnLargeText}>+ Agregar {TABS.find(t => t.key === activeTab)?.label.toLowerCase()}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={data}
          keyExtractor={(item) => item.id}
          contentContainerStyle={s.list}
          renderItem={({ item }) => (
            <RecordItem
              tab={activeTab} item={item}
              onEdit={() => setModal({ type: activeTab, item })}
              onDelete={activeTab === 'allergies' || activeTab === 'conditions' || activeTab === 'family-history'
                ? () => handleDelete(activeTab, item.id, selectedId, reload)
                : null}
            />
          )}
        />
      )}

      {modal?.type === 'allergies' && (
        <AllergyModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateAllergy(modal.item.id, data, selectedId)
            else await clinicalApi.createAllergy(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'conditions' && (
        <ConditionModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateCondition(modal.item.id, data, selectedId)
            else await clinicalApi.createCondition(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'family-history' && (
        <FamilyHistoryModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateFamilyHistory(modal.item.id, data, selectedId)
            else await clinicalApi.createFamilyHistory(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'appointments' && (
        <AppointmentModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateAppointment(modal.item.id, data, selectedId)
            else await clinicalApi.createAppointment(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'leaves' && (
        <LeaveModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateMedicalLeave(modal.item.id, data, selectedId)
            else await clinicalApi.createMedicalLeave(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'records' && (
        <RecordModal
          initial={modal.item}
          onSave={async (data) => {
            if (modal.item) await clinicalApi.updateClinicalRecord(modal.item.id, data, selectedId)
            else await clinicalApi.createClinicalRecord(data, selectedId)
            setModal(null); reload()
          }}
          onClose={() => setModal(null)}
        />
      )}

      <SelectModal visible={memberPicker} title="¿De quién es esta información?"
        options={memberOptions} value={selectedId}
        onSelect={(v) => setSelectedId(v)} onClose={() => setMemberPicker(false)} />
    </View>
    </Screen>
  )
}

// memberApi.list() devuelve también el perfil propio del titular (managed_by_user_id ===
// user_id propio) — se excluye del picker de personas cubiertas porque "Yo" ya lo representa
// como opción fija (value: null).
function selectedSelfId(members) {
  const self = members.find((m) => m.user_id && m.user_id === m.managed_by_user_id)
  return self?.id
}

async function handleDelete(tab, id, pid, reload) {
  Alert.alert('Eliminar registro', '¿Seguro que deseas eliminarlo?', [
    { text: 'Cancelar', style: 'cancel' },
    {
      text: 'Eliminar', style: 'destructive',
      onPress: async () => {
        try {
          if (tab === 'allergies')      await clinicalApi.deleteAllergy(id, pid)
          if (tab === 'conditions')     await clinicalApi.deleteCondition(id, pid)
          if (tab === 'family-history') await clinicalApi.deleteFamilyHistory(id, pid)
          reload()
        } catch {
          Alert.alert('Error', 'No se pudo eliminar el registro.')
        }
      },
    },
  ])
}

// ── Componentes de lista ──────────────────────────────────────────────────────

function RecordItem({ tab, item, onEdit, onDelete }) {
  let title = '', sub = ''

  if (tab === 'allergies') {
    title = item.substance
    sub   = [item.category, item.criticality].filter(Boolean).join(' · ')
  } else if (tab === 'conditions') {
    title = item.display_name || item.icd10_code || 'Condición'
    sub   = [item.icd10_code, item.clinical_status].filter(Boolean).join(' · ')
  } else if (tab === 'family-history') {
    title = item.condition
    sub   = item.relationship
  } else if (tab === 'appointments') {
    title = item.start_time ? new Date(item.start_time).toLocaleString('es-PE') : 'Cita'
    sub   = [item.status, item.service_type].filter(Boolean).join(' · ')
  } else if (tab === 'leaves') {
    title = item.diagnosis_display || item.diagnosis_code || 'Descanso médico'
    sub   = `${item.start_date ? item.start_date.substring(0, 10) : ''} → ${item.end_date ? item.end_date.substring(0, 10) : ''} (${item.days_count || '?'} días)`
  } else if (tab === 'records') {
    title = item.display_name || item.record_type || 'Registro'
    sub   = item.loinc_code || item.value_string || ''
  }

  return (
    <TouchableOpacity style={s.recordCard} onPress={onEdit} activeOpacity={0.7}>
      <View style={{ flex: 1 }}>
        <Text style={s.recordTitle}>{title}</Text>
        {sub ? <Text style={s.recordSub}>{sub}</Text> : null}
      </View>
      {onDelete && (
        <TouchableOpacity onPress={onDelete} style={s.deleteBtn}>
          <Text style={s.deleteBtnText}>✕</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

// ── Modal base ──────────────────────────────────────────────────────────────

function FormModal({ title, onClose, onSave, children, saving }) {
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={m.container}>
        <View style={m.header}>
          <Text style={m.title}>{title}</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={m.close}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={m.content} keyboardShouldPersistTaps="handled">
          {children}
          <TouchableOpacity style={[m.btn, saving && m.btnDisabled]} onPress={onSave} disabled={saving}>
            {saving
              ? <ActivityIndicator color="white" />
              : <Text style={m.btnText}>Guardar</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
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

// ── Modal Alergia ─────────────────────────────────────────────────────────────

function AllergyModal({ initial, onSave, onClose }) {
  const [form, setForm]   = useState(initial
    ? { substance: initial.substance ?? '', category: initial.category ?? 'food', criticality: initial.criticality ?? 'low', reaction: initial.reaction ?? '' }
    : { substance: '', category: 'food', criticality: 'low', reaction: '' })
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(null)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.substance.trim()) { Alert.alert('Requerido', 'La sustancia es obligatoria.'); return }
    setSaving(true)
    try { await onSave(form) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  const catLabel  = ALLERGY_CATEGORIES.find(x => x.value === form.category)?.label    || ''
  const critLabel = ALLERGY_CRITICALITIES.find(x => x.value === form.criticality)?.label || ''

  return (
    <FormModal title={initial ? 'Editar alergia' : 'Nueva alergia'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Sustancia *">
        <TextInput style={m.input} value={form.substance} onChangeText={v => set('substance', v)} placeholder="Penicilina, mariscos, látex..." />
      </MField>
      <MField label="Categoría">
        <TouchableOpacity style={m.select} onPress={() => setPicker('cat')}>
          <Text style={m.selectText}>{catLabel}</Text>
        </TouchableOpacity>
      </MField>
      <MField label="Criticidad">
        <TouchableOpacity style={m.select} onPress={() => setPicker('crit')}>
          <Text style={m.selectText}>{critLabel}</Text>
        </TouchableOpacity>
      </MField>
      <MField label="Reacción (opcional)">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.reaction} onChangeText={v => set('reaction', v)}
          placeholder="Describe la reacción alérgica" multiline />
      </MField>
      <SelectModal visible={picker === 'cat'} title="Categoría" options={ALLERGY_CATEGORIES}
        value={form.category} onSelect={v => set('category', v)} onClose={() => setPicker(null)} />
      <SelectModal visible={picker === 'crit'} title="Criticidad" options={ALLERGY_CRITICALITIES}
        value={form.criticality} onSelect={v => set('criticality', v)} onClose={() => setPicker(null)} />
    </FormModal>
  )
}

// ── Modal Condición ──────────────────────────────────────────────────────────

function ConditionModal({ initial, onSave, onClose }) {
  const [form, setForm]   = useState(initial
    ? { icd10_code: initial.icd10_code ?? '', display_name: initial.display_name ?? '', clinical_status: initial.clinical_status ?? 'active', notes: initial.notes ?? '' }
    : { icd10_code: '', display_name: '', clinical_status: 'active', notes: '' })
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.display_name.trim() && !form.icd10_code.trim()) { Alert.alert('Requerido', 'El nombre o el código ICD-10 es obligatorio.'); return }
    setSaving(true)
    try { await onSave(form) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  const statusLabel = CONDITION_STATUSES.find(x => x.value === form.clinical_status)?.label || ''

  return (
    <FormModal title={initial ? 'Editar condición' : 'Nueva condición'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Código ICD-10">
        <TextInput style={m.input} value={form.icd10_code} onChangeText={v => set('icd10_code', v.toUpperCase())}
          placeholder="Ej.: E11, J45, M54.5..." autoCapitalize="characters" />
      </MField>
      <MField label="Nombre o descripción">
        <TextInput style={m.input} value={form.display_name} onChangeText={v => set('display_name', v)}
          placeholder="Diabetes mellitus tipo 2, Asma bronquial..." />
      </MField>
      <MField label="Estado clínico">
        <TouchableOpacity style={m.select} onPress={() => setPicker(true)}>
          <Text style={m.selectText}>{statusLabel}</Text>
        </TouchableOpacity>
      </MField>
      <MField label="Notas">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.notes} onChangeText={v => set('notes', v)}
          placeholder="Observaciones adicionales" multiline />
      </MField>
      <SelectModal visible={picker} title="Estado clínico" options={CONDITION_STATUSES}
        value={form.clinical_status} onSelect={v => set('clinical_status', v)} onClose={() => setPicker(false)} />
    </FormModal>
  )
}

// ── Modal Antecedente familiar ─────────────────────────────────────────────────

function FamilyHistoryModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? { relationship: initial.relationship ?? '', condition: initial.condition ?? '', notes: initial.notes ?? '' }
    : { relationship: '', condition: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.relationship.trim() || !form.condition.trim()) { Alert.alert('Requerido', 'Parentesco y condición son obligatorios.'); return }
    setSaving(true)
    try { await onSave(form) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  return (
    <FormModal title={initial ? 'Editar antecedente' : 'Nuevo antecedente familiar'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Parentesco *">
        <TextInput style={m.input} value={form.relationship} onChangeText={v => set('relationship', v)}
          placeholder="Abuela materna, tío primero, prima segunda..." />
      </MField>
      <MField label="Condición / enfermedad *">
        <TextInput style={m.input} value={form.condition} onChangeText={v => set('condition', v)}
          placeholder="Diabetes, cáncer, aneurisma..." />
      </MField>
      <MField label="Notas">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.notes} onChangeText={v => set('notes', v)} multiline />
      </MField>
    </FormModal>
  )
}

// ── Modal Cita ───────────────────────────────────────────────────────────────

function AppointmentModal({ initial, onSave, onClose }) {
  const [form, setForm]   = useState(initial
    ? { service_type: initial.service_type ?? '', start_time: initial.start_time ? initial.start_time.substring(0, 16).replace('T', ' ') : '', status: initial.status ?? 'booked', reason: initial.reason ?? '' }
    : { service_type: '', start_time: '', status: 'booked', reason: '' })
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.start_time.trim()) { Alert.alert('Requerido', 'La fecha y hora son obligatorias.'); return }
    setSaving(true)
    const payload = { ...form, start_time: new Date(form.start_time).toISOString() }
    try { await onSave(payload) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  const statusLabel = APPT_STATUSES.find(x => x.value === form.status)?.label || ''

  return (
    <FormModal title={initial ? 'Editar cita médica' : 'Nueva cita médica'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Tipo de servicio">
        <TextInput style={m.input} value={form.service_type} onChangeText={v => set('service_type', v)}
          placeholder="Consulta general, Pediatría, Cardiología..." />
      </MField>
      <MField label="Fecha y hora * (AAAA-MM-DD HH:MM)">
        <TextInput style={m.input} value={form.start_time} onChangeText={v => set('start_time', v)}
          placeholder="2026-07-15 09:00" />
      </MField>
      <MField label="Estado">
        <TouchableOpacity style={m.select} onPress={() => setPicker(true)}>
          <Text style={m.selectText}>{statusLabel}</Text>
        </TouchableOpacity>
      </MField>
      <MField label="Motivo">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.reason} onChangeText={v => set('reason', v)}
          placeholder="Motivo de la consulta" multiline />
      </MField>
      <SelectModal visible={picker} title="Estado de la cita" options={APPT_STATUSES}
        value={form.status} onSelect={v => set('status', v)} onClose={() => setPicker(false)} />
    </FormModal>
  )
}

// ── Modal Descanso médico ──────────────────────────────────────────────────────

function LeaveModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? {
        diagnosis_display: initial.diagnosis_display ?? '', diagnosis_code: initial.diagnosis_code ?? '',
        issue_date: initial.issue_date ? initial.issue_date.substring(0, 10) : '',
        start_date: initial.start_date ? initial.start_date.substring(0, 10) : '',
        end_date: initial.end_date ? initial.end_date.substring(0, 10) : '',
        institution: initial.institution ?? '', notes: initial.notes ?? '',
      }
    : { diagnosis_display: '', diagnosis_code: '', issue_date: '', start_date: '', end_date: '', institution: '', notes: '' })
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.diagnosis_display.trim() || !form.start_date || !form.end_date) {
      Alert.alert('Requerido', 'Diagnóstico, fecha de inicio y fecha de fin son obligatorios.')
      return
    }
    setSaving(true)
    try { await onSave(form) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  return (
    <FormModal title={initial ? 'Editar descanso médico' : 'Nuevo descanso médico'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Diagnóstico *">
        <TextInput style={m.input} value={form.diagnosis_display} onChangeText={v => set('diagnosis_display', v)} placeholder="Nombre del diagnóstico" />
      </MField>
      <MField label="Código ICD-10">
        <TextInput style={m.input} value={form.diagnosis_code} onChangeText={v => set('diagnosis_code', v)} placeholder="J06.9..." />
      </MField>
      <MField label="Fecha de emisión (AAAA-MM-DD)">
        <TextInput style={m.input} value={form.issue_date} onChangeText={v => set('issue_date', v)} placeholder="2026-07-15" />
      </MField>
      <MField label="Fecha inicio * (AAAA-MM-DD)">
        <TextInput style={m.input} value={form.start_date} onChangeText={v => set('start_date', v)} placeholder="2026-07-15" />
      </MField>
      <MField label="Fecha fin * (AAAA-MM-DD)">
        <TextInput style={m.input} value={form.end_date} onChangeText={v => set('end_date', v)} placeholder="2026-07-18" />
      </MField>
      <MField label="Institución">
        <TextInput style={m.input} value={form.institution} onChangeText={v => set('institution', v)} placeholder="Hospital, clínica..." />
      </MField>
      <MField label="Notas">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.notes} onChangeText={v => set('notes', v)} multiline />
      </MField>
    </FormModal>
  )
}

// ── Modal Registro clínico ─────────────────────────────────────────────────────

function RecordModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial
    ? {
        display_name: initial.display_name ?? '', record_type: initial.record_type ?? 'vital-signs',
        loinc_code: initial.loinc_code ?? '', effective_date: initial.effective_date ? initial.effective_date.substring(0, 10) : '',
        value_quantity: initial.value_quantity != null ? String(initial.value_quantity) : '',
        value_unit: initial.value_unit ?? '', value_string: initial.value_string ?? '', notes: initial.notes ?? '',
      }
    : { display_name: '', record_type: 'vital-signs', loinc_code: '', effective_date: '', value_quantity: '', value_unit: '', value_string: '', notes: '' })
  const [saving, setSaving] = useState(false)
  const [picker, setPicker] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    if (!form.display_name.trim() || !form.effective_date) {
      Alert.alert('Requerido', 'Nombre del registro y fecha efectiva son obligatorios.')
      return
    }
    setSaving(true)
    try { await onSave(form) } catch { Alert.alert('Error', 'No se pudo guardar.'); setSaving(false) }
  }

  const typeLabel = RECORD_TYPES.find(x => x.value === form.record_type)?.label || ''

  return (
    <FormModal title={initial ? 'Editar registro clínico' : 'Nuevo registro clínico'} onClose={onClose} onSave={save} saving={saving}>
      <MField label="Nombre del registro *">
        <TextInput style={m.input} value={form.display_name} onChangeText={v => set('display_name', v)} placeholder="Presión arterial, Glucosa en ayunas..." />
      </MField>
      <MField label="Tipo">
        <TouchableOpacity style={m.select} onPress={() => setPicker(true)}>
          <Text style={m.selectText}>{typeLabel}</Text>
        </TouchableOpacity>
      </MField>
      <MField label="Código LOINC">
        <TextInput style={m.input} value={form.loinc_code} onChangeText={v => set('loinc_code', v)} placeholder="85354-9..." />
      </MField>
      <MField label="Fecha efectiva * (AAAA-MM-DD)">
        <TextInput style={m.input} value={form.effective_date} onChangeText={v => set('effective_date', v)} placeholder="2026-07-15" />
      </MField>
      <MField label="Valor numérico">
        <TextInput style={m.input} value={form.value_quantity} onChangeText={v => set('value_quantity', v)} placeholder="120" keyboardType="numeric" />
      </MField>
      <MField label="Unidad">
        <TextInput style={m.input} value={form.value_unit} onChangeText={v => set('value_unit', v)} placeholder="mmHg, °C, mg/dL..." />
      </MField>
      <MField label="Valor narrativo">
        <TextInput style={m.input} value={form.value_string} onChangeText={v => set('value_string', v)} placeholder="Descripción del resultado..." />
      </MField>
      <MField label="Notas">
        <TextInput style={[m.input, { height: 72, textAlignVertical: 'top' }]}
          value={form.notes} onChangeText={v => set('notes', v)} multiline />
      </MField>
      <SelectModal visible={picker} title="Tipo de registro" options={RECORD_TYPES}
        value={form.record_type} onSelect={v => set('record_type', v)} onClose={() => setPicker(false)} />
    </FormModal>
  )
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  memberSelector: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  memberSelectorLabel: { fontSize: 13, color: '#6b7280' },
  memberSelectorValue: { fontSize: 13, fontWeight: '600', color: '#16a34a' },
  tabBar: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', flexGrow: 0 },
  tabBarContent: { paddingHorizontal: 4 },
  tab: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: '#16a34a' },
  tabText: { fontSize: 13, color: '#6b7280' },
  tabTextActive: { color: '#16a34a', fontWeight: '600' },
  tabHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10 },
  tabHeaderCount: { fontSize: 13, color: '#6b7280' },
  addBtn: { backgroundColor: '#16a34a', paddingHorizontal: 14, paddingVertical: 6, borderRadius: 6 },
  addBtnText: { color: 'white', fontSize: 13, fontWeight: '600' },
  error: { color: '#dc2626', padding: 16 },
  loader: { marginTop: 40 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40, gap: 16 },
  empty: { textAlign: 'center', color: '#6b7280', fontSize: 15 },
  addBtnLarge: { borderWidth: 1, borderColor: '#16a34a', borderRadius: 8, paddingHorizontal: 18, paddingVertical: 10 },
  addBtnLargeText: { color: '#16a34a', fontSize: 14, fontWeight: '500' },
  list: { padding: 16, gap: 10 },
  recordCard: { backgroundColor: 'white', borderRadius: 8, padding: 14, borderWidth: 1, borderColor: '#e5e7eb', flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  recordTitle: { fontSize: 15, fontWeight: '600', color: '#111827' },
  recordSub: { fontSize: 13, color: '#6b7280', marginTop: 4 },
  deleteBtn: { padding: 4 },
  deleteBtnText: { color: '#9ca3af', fontSize: 14 },
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
