// Marcar a alguien como fallecido/a o desaparecido/a cambia por completo su página pública
// (QR) — ver PatientProfile.jsx. Es una acción puntual y sensible, separada del resto del
// formulario de datos, con su propia confirmación antes de aplicarse.
export default function LifeStatusControls({ status, onChange, personLabel }) {
  async function apply(newStatus, confirmMsg) {
    if (confirmMsg && !confirm(confirmMsg)) return
    await onChange(newStatus)
  }

  if (status === 'deceased') {
    return (
      <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span>Marcado/a como fallecido/a — su código QR ahora muestra "En memoria" en vez del perfil médico.</span>
        <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', flexShrink: 0 }}
          onClick={() => apply('', `¿Quitar la marca de fallecido/a de ${personLabel}?`)}>
          Quitar marca
        </button>
      </div>
    )
  }

  if (status === 'missing') {
    return (
      <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
        <span>Marcado/a como desaparecido/a — su código QR ahora resalta una alerta para quien lo escanee.</span>
        <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', flexShrink: 0 }}
          onClick={() => apply('', `¿${personLabel} ya fue encontrado/a? Esto quita la alerta de su código QR.`)}>
          Ya fue encontrado/a
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem', borderColor: '#fca5a5', color: '#dc2626' }}
        onClick={() => apply('missing', `¿Marcar a ${personLabel} como persona desaparecida/extraviada? Su código QR va a resaltar esta alerta para quien lo escanee.`)}>
        Persona desaparecida / extraviada
      </button>
      <button type="button" className="btn btn-outline" style={{ fontSize: '0.8rem' }}
        onClick={() => apply('deceased', `¿Marcar a ${personLabel} como fallecido/a? Su página pública va a mostrar "En memoria" en vez del perfil médico normal.`)}>
        Marcar como fallecido/a
      </button>
    </div>
  )
}
