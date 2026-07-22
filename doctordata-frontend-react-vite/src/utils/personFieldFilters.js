// Filtros compartidos por los formularios de datos de paciente (perfil propio y personas
// cubiertas) — OnboardingProfile.jsx y Profile.jsx. Se filtra en cada tecleo (no solo al
// enviar) para que el usuario vea de inmediato qué caracteres no se aceptan.

// Nombres/apellidos: letras (con acentos/ñ), espacios, apóstrofes y guiones — sin números.
export function filterNameInput(value) {
  return value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ' -]/g, '')
}

// Solo dígitos, recortado a maxLength.
export function filterDigits(value, maxLength) {
  const digits = value.replace(/\D/g, '')
  return maxLength ? digits.slice(0, maxLength) : digits
}
