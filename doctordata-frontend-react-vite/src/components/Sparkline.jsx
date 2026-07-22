// Mini-gráfico de línea sin ejes, para meter la tendencia dentro de una tarjeta de número
// (mismo patrón que un dashboard de analítica: el número grande dice "cuánto", la línea de
// abajo dice "para dónde va" sin ocupar espacio propio.
export default function Sparkline({ data, color = 'var(--green)' }) {
  if (!data || data.length < 2) return null
  const max = Math.max(...data, 0)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const w = 100
  const h = 28
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y.toFixed(1)}`
    })
    .join(' ')

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: 28, display: 'block', marginTop: '0.5rem' }} preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
