// Traducciones de los valores enum que vienen del backend (en inglés, por convención FHIR)
// a texto que se muestra en pantalla — compartido entre ClinicalInfo.jsx (formularios propios)
// y PatientProfile.jsx (vista pública/médica vía QR) para no duplicar ni desincronizar.
export const ALLERGY_TYPE_ES = { allergy: 'Alergia', intolerance: 'Intolerancia' }
export const ALLERGY_CATEGORY_ES = { food: 'Alimento', medication: 'Medicamento', environment: 'Ambiente', biologic: 'Biológico' }
export const ALLERGY_CRITICALITY_ES = { low: 'Baja', high: 'Alta', 'unable-to-assess': 'No evaluable' }
export const CONDITION_STATUS_ES = { active: 'Activo', recurrence: 'Recurrencia', remission: 'En remisión', inactive: 'Inactivo', resolved: 'Resuelto' }
export const APPOINTMENT_STATUS_ES = { proposed: 'Propuesta', pending: 'Pendiente', booked: 'Confirmada', arrived: 'En curso', fulfilled: 'Completada', cancelled: 'Cancelada', noshow: 'No asistió' }
export const RECORD_TYPE_ES = { 'vital-signs': 'Signos vitales', laboratory: 'Laboratorio', imaging: 'Imagen', procedure: 'Procedimiento', medication: 'Medicación', note: 'Nota clínica', 'social-history': 'Historia social' }
export const RECORD_STATUS_ES = { final: 'Final', preliminary: 'Preliminar', registered: 'Registrado', amended: 'Enmendado', corrected: 'Corregido', cancelled: 'Cancelado' }

export function label(map, value) {
  return map[value] ?? value
}
