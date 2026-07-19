import { useState, useCallback } from 'react'
import { useFocusEffect } from '@react-navigation/native'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  Image, ActivityIndicator,
} from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useAuth } from '../context/AuthContext'
import { patientApi, clinicalApi, billingApi, API_BASE } from '../services/api'
import Screen from '../components/Screen'

export default function HomeScreen({ navigation }) {
  const { user, logout } = useAuth()
  const [patientName, setPatientName]   = useState('')
  const [patientPhoto, setPatientPhoto] = useState(null)
  const [allergyCount, setAllergyCount] = useState(0)
  const [condCount, setCondCount]       = useState(0)
  const [apptCount, setApptCount]       = useState(0)
  const [qrToken, setQrToken]           = useState(null)
  const [capacity, setCapacity]         = useState(null)

  useFocusEffect(useCallback(() => {
    // Token para el QR (Image con header de autenticación)
    AsyncStorage.getItem('token').then((t) => setQrToken(t))

    // Resumen del perfil de paciente
    patientApi.getMyProfile()
      .then((r) => {
        const p = r.data
        setPatientName([p.first_name, p.last_name].filter(Boolean).join(' '))
        if (p.profile_photo_url) setPatientPhoto(API_BASE + p.profile_photo_url)
      })
      .catch(() => {})

    // Contadores
    clinicalApi.listAllergies().then((r) => setAllergyCount((r.data || []).length)).catch(() => {})
    clinicalApi.listConditions().then((r) => setCondCount((r.data || []).length)).catch(() => {})
    clinicalApi.listAppointments().then((r) => setApptCount((r.data || []).length)).catch(() => {})

    billingApi.getMyCapacity().then((r) => setCapacity(r.data)).catch(() => {})
  }, []))

  return (
    <Screen>
    <ScrollView style={s.container}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.headerTitle}>DoctorData</Text>
          <Text style={s.headerEmail}>{user?.email}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>Salir</Text>
        </TouchableOpacity>
      </View>

      {/* Badges de rol */}
      <View style={s.badges}>
        {user?.is_doctor && <Text style={s.badgeDoctor}>Médico</Text>}
        {user?.is_admin  && <Text style={s.badgeAdmin}>Admin</Text>}
      </View>

      {!user?.has_active_subscription && (
        <TouchableOpacity style={s.subBanner} onPress={() => navigation.navigate('Pricing')} activeOpacity={0.8}>
          <Text style={s.subBannerText}>Todavía no tienes una suscripción activa — necesitas una para registrar tus datos.</Text>
          <Text style={s.subBannerLink}>Ver planes →</Text>
        </TouchableOpacity>
      )}

      {capacity && capacity.total_capacity > 0 && (
        <View style={s.capacityBox}>
          <Text style={s.capacityLabel}>Capacidad de tu suscripción</Text>
          <Text style={s.capacityNumber}>{capacity.used_capacity} / {capacity.total_capacity} personas cubiertas</Text>
        </View>
      )}

      {/* Perfil + QR */}
      <View style={s.profileCard}>
        <View style={s.profileLeft}>
          {patientPhoto
            ? <Image source={{ uri: patientPhoto }} style={s.profilePhoto} />
            : <View style={[s.profilePhoto, s.profilePhotoEmpty]}>
                <Text style={s.profilePhotoInitials}>
                  {patientName ? patientName.split(' ').map((w) => w[0]).slice(0, 2).join('') : '?'}
                </Text>
              </View>}
          <Text style={s.profileName} numberOfLines={2}>
            {patientName || 'Completa tu perfil'}
          </Text>
          <TouchableOpacity style={s.profileEditBtn}
            onPress={() => navigation.navigate('PatientProfile')}>
            <Text style={s.profileEditBtnText}>Editar perfil</Text>
          </TouchableOpacity>
        </View>

        <View style={s.qrBox}>
          <Text style={s.qrLabel}>Mi código QR</Text>
          {qrToken
            ? <Image
                source={{ uri: `${API_BASE}/me/qr`, headers: { Authorization: `Bearer ${qrToken}` } }}
                style={s.qrImage}
                resizeMode="contain"
              />
            : <ActivityIndicator style={s.qrImage} color="#16a34a" />}
          <Text style={s.qrHint}>Muéstralo al médico</Text>
        </View>
      </View>

      {/* Contadores */}
      <View style={s.statsRow}>
        <StatCard number={allergyCount} label="Alergias" />
        <StatCard number={condCount}    label="Condiciones" />
        <StatCard number={apptCount}    label="Citas" />
      </View>

      {/* Menú */}
      <Text style={s.sectionTitle}>Mi perfil</Text>

      <MenuItem
        label="Datos personales"
        description="Editar nombre, documento, dirección y foto"
        onPress={() => navigation.navigate('PatientProfile')}
        color="#16a34a"
      />

      <MenuItem
        label="Información clínica"
        description="Alergias, condiciones, citas y más"
        onPress={() => navigation.navigate('ClinicalInfo')}
        color="#2563eb"
      />

      <MenuItem
        label="Personas cubiertas"
        description="Familia y personas que cubre tu suscripción"
        onPress={() => navigation.navigate('Members')}
        color="#0891b2"
      />

      <MenuItem
        label={user?.is_doctor ? 'Mi perfil médico' : 'Registrarme como médico'}
        description={user?.is_doctor
          ? 'Ver datos de colegiatura, carné CMP y especialidad'
          : 'Activar perfil profesional con número CMP'}
        onPress={() => navigation.navigate('MedicalProfile')}
        color="#7c3aed"
        highlight={!user?.is_doctor}
      />
    </ScrollView>
    </Screen>
  )
}

function StatCard({ number, label }) {
  return (
    <View style={s.statCard}>
      <Text style={s.statNumber}>{number}</Text>
      <Text style={s.statLabel}>{label}</Text>
    </View>
  )
}

function MenuItem({ label, description, onPress, color, highlight }) {
  return (
    <TouchableOpacity
      style={[s.menuItem, highlight && { borderColor: color || '#2563eb' }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={[s.menuAccent, { backgroundColor: color || '#2563eb' }]} />
      <View style={{ flex: 1 }}>
        <Text style={s.menuLabel}>{label}</Text>
        <Text style={s.menuDescription}>{description}</Text>
      </View>
      <Text style={s.menuArrow}>›</Text>
    </TouchableOpacity>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  subBanner: {
    backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca',
    borderRadius: 10, marginHorizontal: 16, marginTop: 12, padding: 14,
  },
  subBannerText: { color: '#991b1b', fontSize: 13, lineHeight: 18 },
  subBannerLink: { color: '#dc2626', fontSize: 13, fontWeight: '700', marginTop: 6 },
  capacityBox: {
    backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb',
    borderRadius: 10, marginHorizontal: 16, marginTop: 12, padding: 14,
  },
  capacityLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4 },
  capacityNumber: { fontSize: 16, fontWeight: '700', color: '#16a34a' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 20, backgroundColor: 'white',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#16a34a' },
  headerEmail: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  logoutBtn: { paddingHorizontal: 14, paddingVertical: 6, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 6 },
  logoutText: { fontSize: 14, color: '#374151' },
  badges: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  badgeDoctor: { backgroundColor: '#dbeafe', color: '#1e40af', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: '500' },
  badgeAdmin:  { backgroundColor: '#f3e8ff', color: '#6b21a8', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, fontSize: 12, fontWeight: '500' },
  profileCard: { flexDirection: 'row', backgroundColor: 'white', margin: 16, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#e5e7eb', gap: 12 },
  profileLeft: { alignItems: 'center', width: 100 },
  profilePhoto: { width: 72, height: 96, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  profilePhotoEmpty: { backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  profilePhotoInitials: { fontSize: 22, fontWeight: '700', color: '#16a34a' },
  profileName: { fontSize: 12, color: '#374151', textAlign: 'center', marginTop: 8, fontWeight: '500' },
  profileEditBtn: { marginTop: 8, borderWidth: 1, borderColor: '#16a34a', borderRadius: 6, paddingHorizontal: 10, paddingVertical: 4 },
  profileEditBtnText: { color: '#16a34a', fontSize: 11, fontWeight: '500' },
  qrBox: { flex: 1, alignItems: 'center' },
  qrLabel: { fontSize: 12, fontWeight: '600', color: '#374151', marginBottom: 8 },
  qrImage: { width: 130, height: 130 },
  qrHint: { fontSize: 10, color: '#9ca3af', marginTop: 4 },
  statsRow: { flexDirection: 'row', gap: 10, marginHorizontal: 16, marginBottom: 4 },
  statCard: { flex: 1, backgroundColor: 'white', borderRadius: 8, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  statNumber: { fontSize: 24, fontWeight: '700', color: '#16a34a' },
  statLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '700', color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.6, paddingHorizontal: 16, marginTop: 16, marginBottom: 8 },
  menuItem: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 10,
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb',
    flexDirection: 'row', alignItems: 'center', overflow: 'hidden',
  },
  menuAccent: { width: 4, alignSelf: 'stretch' },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#111827', paddingHorizontal: 12, paddingTop: 14 },
  menuDescription: { fontSize: 13, color: '#6b7280', paddingHorizontal: 12, paddingBottom: 14, marginTop: 2 },
  menuArrow: { fontSize: 24, color: '#d1d5db', paddingRight: 14 },
})
