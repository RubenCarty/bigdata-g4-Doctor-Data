export default function CapacityMeter({ used, total }) {
  const pct = total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const full = total > 0 && used >= total

  return (
    <div className="capacity-meter">
      <div className="capacity-meter-bar">
        <div className="capacity-meter-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="capacity-meter-text">
        {total > 0
          ? <>{used} de {total} personas registradas{full && ' · capacidad completa'}</>
          : 'Sin capacidad disponible'}
      </p>
    </div>
  )
}
