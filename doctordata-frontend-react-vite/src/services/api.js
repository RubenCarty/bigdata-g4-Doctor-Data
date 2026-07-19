import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080',
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    // Solo forzar el redirect a /login cuando el request llevaba un token (sesión que dejó
    // de ser válida) — un 401 de /auth/login con credenciales incorrectas NO lleva
    // Authorization header, así que este código no debe tratarlo como "sesión expirada".
    // Antes de este fix, cualquier 401 (incluido un login fallido) recargaba la página hacia
    // /login, lo que borraba el mensaje de error casi de inmediato después de mostrarlo.
    if (err.response?.status === 401 && err.config?.headers?.Authorization) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  }
)

export const authApi = {
  register: (email, password) => api.post('/auth/register', { email, password }),
  login: (email, password) => api.post('/auth/login', { email, password }),
  // Registro y login pueden devolver { verification_required: true, email, dev_code? } en
  // vez de { token, user } — ver AuthContext.jsx, que distingue ambos casos.
  verifyCode: (email, code) => api.post('/auth/verify-code', { email, code }),
  resendCode: (email) => api.post('/auth/resend-code', { email }),
  me: () => api.get('/auth/me'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (token, password) => api.post('/auth/reset-password', { token, password }),
}

export const medicalApi = {
  getMyMedicalProfile: () => api.get('/me/medical-profile'),
  updateMyMedicalProfile: (data) => api.put('/me/medical-profile', data),
  uploadProfilePhoto: (file) => {
    const fd = new FormData(); fd.append('photo', file)
    return api.post('/me/medical-profile/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  uploadCMPCard: (file) => {
    const fd = new FormData(); fd.append('card', file)
    return api.post('/me/medical-profile/upload/card', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
}

export const adminApi = {
  getStats: () => api.get('/admin/stats'),

  listUsers: (params) => api.get('/admin/users', { params }),
  updateUser: (id, data) => api.put(`/admin/users/${id}`, data),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),

  listDoctors: (status) => api.get('/admin/doctors', { params: status ? { status } : {} }),
  validateDoctor: (id, action, notes) => api.put(`/admin/doctors/${id}/validate`, { action, notes }),

  listPlans: () => api.get('/admin/plans'),
  createPlan: (data) => api.post('/admin/plans', data),
  updatePlan: (id, data) => api.put(`/admin/plans/${id}`, data),
  deletePlan: (id) => api.delete(`/admin/plans/${id}`),

  listDiscountCodes: (params) => api.get('/admin/discount-codes', { params }),
  createDiscountCode: (data) => api.post('/admin/discount-codes', data),
  updateDiscountCode: (id, data) => api.put(`/admin/discount-codes/${id}`, data),
  deleteDiscountCode: (id) => api.delete(`/admin/discount-codes/${id}`),

  listPartnershipRequests: () => api.get('/admin/partnership-requests'),
  updatePartnershipRequestStatus: (id, status) => api.put(`/admin/partnership-requests/${id}`, { status }),

  // Boletas (venta de suscripciones, automáticas) y facturas (convenios, a mano)
  listBoletas: (status) => api.get('/admin/boletas', { params: status ? { status } : {} }),
  updateBoleta: (id, data) => api.put(`/admin/boletas/${id}`, data),
  listFacturas: (status) => api.get('/admin/facturas', { params: status ? { status } : {} }),
  createFactura: (data) => api.post('/admin/facturas', data),
  updateFactura: (id, data) => api.put(`/admin/facturas/${id}`, data),
  deleteFactura: (id) => api.delete(`/admin/facturas/${id}`),
  getSalesStats: () => api.get('/admin/sales-stats'),

  // Ventas — leaderboard de comisiones y códigos propios del vendedor
  getLeaderboard: () => api.get('/admin/sellers/leaderboard'),
  listMyDiscountCodes: () => api.get('/admin/sellers/discount-codes'),
  createMyDiscountCode: (data) => api.post('/admin/sellers/discount-codes', data),
  getCompanyBankInfo: () => api.get('/admin/sellers/company-bank-info'),
}

// Cuenta bancaria propia (Ventas/Contabilidad/admins) — a dónde se les paga
export const bankAccountApi = {
  getMine: () => api.get('/me/bank-account'),
  updateMine: (data) => api.put('/me/bank-account', data),
}

export const billingApi = {
  listPlans: () => api.get('/public/plans'),
  previewDiscount: (code, items) => api.post('/public/discount-codes/preview', { code, items }),

  listMySubscriptions: () => api.get('/me/subscriptions'),
  getMyCapacity: () => api.get('/me/subscriptions/capacity'),
  createCheckout: (items, discountCode) =>
    api.post('/me/subscriptions/checkout', { items, discount_code: discountCode }),
  getSubscriptionStatus: (id) => api.get(`/me/subscriptions/${id}`),

  confirmStubPayment: (gatewayRef, status) =>
    api.post('/billing/webhook/stub-confirm', { gateway_ref: gatewayRef, status }),
}

export const auditApi = {
  list: () => api.get('/admin/audit-log'),
}

export const memberApi = {
  list: () => api.get('/me/members'),
  create: (data) => api.post('/me/members', data),
  update: (id, data) => api.put(`/me/members/${id}`, data),
  remove: (id) => api.delete(`/me/members/${id}`),
  // status: "deceased" | "missing" | "" (para quitar la marca)
  updateLifeStatus: (id, status) => api.put(`/me/members/${id}/life-status`, { status }),
  uploadPhoto: (id, file) => {
    const fd = new FormData(); fd.append('photo', file)
    return api.post(`/me/members/${id}/upload/photo`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  nominateDoctor: (id) => api.post(`/me/members/${id}/nominate-doctor`),
}

export const patientApi = {
  getMyProfile: () => api.get('/me/patient'),
  updateMyProfile: (data) => api.put('/me/patient', data),
  // status: "deceased" | "missing" | "" (para quitar la marca)
  updateLifeStatus: (status) => api.put('/me/patient/life-status', { status }),
  uploadProfilePhoto: (file) => {
    const fd = new FormData(); fd.append('photo', file)
    return api.post('/me/patient/upload/photo', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
  },
  getById: (id) => api.get(`/patients/${id}`),
  // patientProfileId opcional: sin él, el QR del propio titular; con él, el de una persona
  // cubierta que administre (ver GetMyQR en el backend, que resuelve la URL correspondiente).
  getQR: (patientProfileId) => api.get('/me/qr', { responseType: 'blob', ...pidParams(patientProfileId) }),
}

// Endpoint público — sin autenticación — para la vista del QR
export const publicApi = {
  getPatientProfile: (userId) => api.get(`/public/patient/${userId}`),
  // Personas cubiertas no tienen user_id/login propio — su perfil público se busca por
  // patient_profile_id en su lugar (ver PatientPublicProfileByID en el backend).
  getPatientProfileByProfileId: (profileId) => api.get(`/public/patient-profile/${profileId}`),
  // Endpoints para médicos autenticados usando el patient_profile_id del registro público.
  // Descansos médicos: solo lectura — el médico nunca los escribe (ver /me/medical-leaves).
  getConditions: (profileId) => api.get(`/patients/${profileId}/conditions`),
  getFamilyHistory: (profileId) => api.get(`/patients/${profileId}/family-history`),
  getAppointments: (profileId) => api.get(`/patients/${profileId}/appointments`),
  getMedicalLeaves: (profileId) => api.get(`/patients/${profileId}/medical-leaves`),
  getClinicalRecords: (profileId) => api.get(`/patients/${profileId}/clinical-records`),

  getStats: () => api.get('/public/stats'),
  submitPartnershipRequest: (data) => api.post('/public/partnership-requests', data),
}

// Todos los métodos aceptan un patientProfileId opcional al final — sin él, operan sobre el
// perfil del propio titular (comportamiento de siempre); con él, sobre una persona cubierta
// que administre la cuenta (ver getMyPatientProfileID/findMyPatientProfileID en el backend).
function pidParams(patientProfileId) {
  return patientProfileId ? { params: { patient_profile_id: patientProfileId } } : {}
}

export const clinicalApi = {
  listAllergies: (patientProfileId) => api.get('/me/allergies', pidParams(patientProfileId)),
  createAllergy: (data, patientProfileId) => api.post('/me/allergies', data, pidParams(patientProfileId)),
  updateAllergy: (id, data, patientProfileId) => api.put(`/me/allergies/${id}`, data, pidParams(patientProfileId)),
  deleteAllergy: (id, patientProfileId) => api.delete(`/me/allergies/${id}`, pidParams(patientProfileId)),

  listConditions: (patientProfileId) => api.get('/me/conditions', pidParams(patientProfileId)),
  createCondition: (data, patientProfileId) => api.post('/me/conditions', data, pidParams(patientProfileId)),
  updateCondition: (id, data, patientProfileId) => api.put(`/me/conditions/${id}`, data, pidParams(patientProfileId)),

  listFamilyHistory: (patientProfileId) => api.get('/me/family-history', pidParams(patientProfileId)),
  createFamilyHistory: (data, patientProfileId) => api.post('/me/family-history', data, pidParams(patientProfileId)),
  updateFamilyHistory: (id, data, patientProfileId) => api.put(`/me/family-history/${id}`, data, pidParams(patientProfileId)),
  deleteFamilyHistory: (id, patientProfileId) => api.delete(`/me/family-history/${id}`, pidParams(patientProfileId)),

  listAppointments: (patientProfileId) => api.get('/me/appointments', pidParams(patientProfileId)),
  createAppointment: (data, patientProfileId) => api.post('/me/appointments', data, pidParams(patientProfileId)),
  updateAppointment: (id, data, patientProfileId) => api.put(`/me/appointments/${id}`, data, pidParams(patientProfileId)),

  listMedicalLeaves: (patientProfileId) => api.get('/me/medical-leaves', pidParams(patientProfileId)),
  createMedicalLeave: (data, patientProfileId) => api.post('/me/medical-leaves', data, pidParams(patientProfileId)),
  updateMedicalLeave: (id, data, patientProfileId) => api.put(`/me/medical-leaves/${id}`, data, pidParams(patientProfileId)),

  listClinicalRecords: (patientProfileId) => api.get('/me/clinical-records', pidParams(patientProfileId)),
  createClinicalRecord: (data, patientProfileId) => api.post('/me/clinical-records', data, pidParams(patientProfileId)),
  updateClinicalRecord: (id, data, patientProfileId) => api.put(`/me/clinical-records/${id}`, data, pidParams(patientProfileId)),

  deleteCondition: (id, patientProfileId) => api.delete(`/me/conditions/${id}`, pidParams(patientProfileId)),
  deleteAllergy: (id, patientProfileId) => api.delete(`/me/allergies/${id}`, pidParams(patientProfileId)),
}

export default api
