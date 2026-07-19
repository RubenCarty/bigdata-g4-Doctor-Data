// Gráfico de columnas — venta de boletas por día, últimos 30 días. Pensado para "de un
// vistazo, ¿este mes viene bien o mal?": la forma/tendencia de las barras importa más que
// leer un número exacto por día (para eso está el total en la tarjeta de arriba).
const WIDTH = 900
const HEIGHT = 320
const PADDING_LEFT = 54
const PADDING_BOTTOM = 26
const PADDING_TOP = 14

export default function DailyRevenueChart({ data, color = 'var(--green)' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.revenue_cents), 1)
  const chartWidth = WIDTH - PADDING_LEFT
  const chartHeight = HEIGHT - PADDING_BOTTOM - PADDING_TOP
  const barGap = 2
  const barWidth = chartWidth / data.length - barGap

  const firstLabel = formatShortDate(data[0].date)
  const lastLabel = formatShortDate(data[data.length - 1].date)

  // 3 líneas guía: arriba (max), a la mitad, y cero — con su valor en soles al costado,
  // igual que un gráfico de verdad en vez de barras flotando sin referencia.
  const gridLines = [1, 0.5, 0]

  return (
    <div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ width: '100%', height: 320, display: 'block' }} preserveAspectRatio="none">
        {gridLines.map((frac) => {
          const y = PADDING_TOP + chartHeight * (1 - frac)
          const value = (max * frac) / 100
          return (
            <g key={frac}>
              <line x1={PADDING_LEFT} y1={y} x2={WIDTH} y2={y} stroke="var(--border)" strokeWidth="1" strokeDasharray={frac === 0 ? '0' : '4,4'} />
              <text x={PADDING_LEFT - 10} y={y + 4} fontSize="13" fill="var(--text-muted)" textAnchor="end">
                {value >= 1 ? `S/${value.toFixed(0)}` : 'S/0'}
              </text>
            </g>
          )
        })}

        {data.map((d, i) => {
          const h = d.revenue_cents > 0 ? Math.max(3, (d.revenue_cents / max) * chartHeight) : 1
          const x = PADDING_LEFT + i * (chartWidth / data.length)
          const y = PADDING_TOP + chartHeight - h
          const isToday = i === data.length - 1
          return (
            <rect
              key={d.date}
              x={x}
              y={y}
              width={Math.max(barWidth, 1)}
              height={h}
              fill={isToday ? 'var(--indigo)' : color}
              rx="1.5"
              opacity={d.revenue_cents > 0 ? 1 : 0.2}
            >
              <title>{formatShortDate(d.date)}: S/ {(d.revenue_cents / 100).toFixed(2)}</title>
            </rect>
          )
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: PADDING_LEFT, marginTop: '0.35rem' }}>
        <span>{firstLabel}</span>
        <span>{lastLabel} (hoy)</span>
      </div>
    </div>
  )
}

function formatShortDate(iso) {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}
