import { useState, useEffect } from 'react'
import { publicApi } from '../services/api'

const STAT_LABELS = {
  users: 'Usuarios registrados',
  active_subscriptions: 'Suscripciones activas',
  approved_doctors: 'Médicos aprobados',
  covered_profiles: 'Personas cubiertas',
  medical_records_shared: 'Datos médicos registrados',
}

// Solo se muestran métricas que el backend ya filtró a >10 (ver PublicHandler.GetStats) —
// un número real pero chico ("3 usuarios") resta confianza más de lo que suma, así que la
// sección entera desaparece si todavía no hay nada que mostrar.
export default function TrustStats() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    publicApi.getStats().then((r) => setStats(r.data ?? {})).catch(() => setStats({}))
  }, [])

  const entries = Object.entries(stats ?? {}).filter(([key]) => STAT_LABELS[key])
  if (!stats || entries.length === 0) return null

  return (
    <section className="landing-trust-stats" aria-label="Cifras de DoctorData">
      {entries.map(([key, value]) => (
        <div key={key} className="trust-stat">
          <span className="trust-stat-number">{value.toLocaleString('es-PE')}</span>
          <span className="trust-stat-label">{STAT_LABELS[key]}</span>
        </div>
      ))}
    </section>
  )
}
