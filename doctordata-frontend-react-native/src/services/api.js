import axios from 'axios'
import AsyncStorage from '@react-native-async-storage/async-storage'

// Para emulador Android usa http://10.0.2.2:8080
// Para dispositivo físico usa la IP LAN del servidor, ej: http://192.168.1.XX:8080
export const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080'

// timeout explícito a propósito: sin esto, un servidor caído/inalcanzable (ej. QA con
// problemas de red) deja un request colgado indefinidamente — nada distingue eso de "sigue
// cargando" para quien usa la app. Con el timeout, el error sale rápido y AuthContext puede
// mostrar login en vez de un spinner infinito.
const api = axios.create({ baseURL: API_BASE, timeout: 15000 })

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// onUnauthorized lo registra AuthContext al montar (setOnUnauthorized) — este módulo no puede
// usar hooks, así que no puede limpiar el `user` del contexto directo; en cambio, notifica y
// AuthContext hace `setUser(null)`, con lo que AppNavigator cambia solo al stack sin sesión
// (mismo mecanismo que ya usa el logout manual). Solo se dispara cuando el request que falló
// llevaba token (sesión que dejó de ser válida) — un 401 de /auth/login con credenciales
// incorrectas NO lleva Authorization header, así que no se lo trata como "sesión expirada"
// (mismo bug que ya se corrigió en la web — ver api.js allá).
let onUnauthorized = null
export function setOnUnauthorized(fn) { onUnauthorized = fn }

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && err.config?.headers?.Authorization) {
      await AsyncStorage.removeItem('token')
      onUnauthorized?.()
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }),
  resendCode: (email) => api.post('/auth/resend-code', { email }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

export const medicalApi = {
  getMyMedicalProfile: () => api.get('/me/medical-profile'),
  updateMyMedicalProfile: (data) => api.put('/me/medical-profile', data),
  uploadProfilePhoto: (uri) => {
    const fd = new FormData()
    fd.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' })
    return api.post('/me/medical-profile/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadCMPCard: (uri) => {
    const fd = new FormData()
    fd.append('card', { uri, type: 'image/jpeg', name: 'card.jpg' })
    return api.post('/me/medical-profile/upload/card', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const patientApi = {
  getMyProfile: () => api.get('/me/patient'),
  updateMyProfile: (data) => api.put('/me/patient', data),
  uploadProfilePhoto: (uri) => {
    const fd = new FormData()
    fd.append('photo', { uri, type: 'image/jpeg', name: 'photo.jpg' })
    return api.post('/me/patient/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

// Todos los métodos aceptan un patientProfileId opcional al final — sin él, operan sobre el
// perfil del propio titular (comportamiento de siempre); con él, sobre una persona cubierta
// que administre la cuenta (ver getMyPatientProfileID/findMyPatientProfileID en el backend,
// mismo patrón que ya usa la web en api.js).
function pidParams(patientProfileId) {
  return patientProfileId ? { params: { patient_profile_id: patientProfileId } } : {}
}

export const clinicalApi = {
  listAllergies: (pid) => api.get('/me/allergies', pidParams(pid)),
  createAllergy: (data, pid) => api.post('/me/allergies', data, pidParams(pid)),
  updateAllergy: (id, data, pid) => api.put(`/me/allergies/${id}`, data, pidParams(pid)),
  deleteAllergy: (id, pid) => api.delete(`/me/allergies/${id}`, pidParams(pid)),

  listConditions: (pid) => api.get('/me/conditions', pidParams(pid)),
  createCondition: (data, pid) => api.post('/me/conditions', data, pidParams(pid)),
  updateCondition: (id, data, pid) => api.put(`/me/conditions/${id}`, data, pidParams(pid)),
  deleteCondition: (id, pid) => api.delete(`/me/conditions/${id}`, pidParams(pid)),

  listFamilyHistory: (pid) => api.get('/me/family-history', pidParams(pid)),
  createFamilyHistory: (data, pid) => api.post('/me/family-history', data, pidParams(pid)),
  updateFamilyHistory: (id, data, pid) => api.put(`/me/family-history/${id}`, data, pidParams(pid)),
  deleteFamilyHistory: (id, pid) => api.delete(`/me/family-history/${id}`, pidParams(pid)),

  listAppointments: (pid) => api.get('/me/appointments', pidParams(pid)),
  createAppointment: (data, pid) => api.post('/me/appointments', data, pidParams(pid)),
  updateAppointment: (id, data, pid) => api.put(`/me/appointments/${id}`, data, pidParams(pid)),

  listMedicalLeaves: (pid) => api.get('/me/medical-leaves', pidParams(pid)),
  createMedicalLeave: (data, pid) => api.post('/me/medical-leaves', data, pidParams(pid)),
  updateMedicalLeave: (id, data, pid) => api.put(`/me/medical-leaves/${id}`, data, pidParams(pid)),

  listClinicalRecords: (pid) => api.get('/me/clinical-records', pidParams(pid)),
  createClinicalRecord: (data, pid) => api.post('/me/clinical-records', data, pidParams(pid)),
  updateClinicalRecord: (id, data, pid) => api.put(`/me/clinical-records/${id}`, data, pidParams(pid)),
}

export const memberApi = {
  list: () => api.get('/me/members'),
  create: (data) => api.post('/me/members', data),
  update: (id, data) => api.put(`/me/members/${id}`, data),
  remove: (id) => api.delete(`/me/members/${id}`),
  nominateDoctor: (id) => api.post(`/me/members/${id}/nominate-doctor`),
}

export const billingApi = {
  listPlans: () => api.get('/public/plans'),
  previewDiscount: (code, items) => api.post('/public/discount-codes/preview', { code, items }),
  listMySubscriptions: () => api.get('/me/subscriptions'),
  getMyCapacity: () => api.get('/me/subscriptions/capacity'),
  createCheckout: (items, discountCode) =>
    api.post('/me/subscriptions/checkout', { items, discount_code: discountCode }),
}

export default api
