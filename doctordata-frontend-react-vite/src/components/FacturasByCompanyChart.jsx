// Gráfico de filas (barras horizontales) — monto de facturas por empresa. Se eligió sobre
// un circular porque con pocos convenios (lo normal acá) un pie queda casi vacío y no deja
// comparar montos tan distintos entre sí (S/500 vs S/69,000) tan bien como una barra.
export default function FacturasByCompanyChart({ data, color = 'var(--indigo)' }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map((d) => d.amount_cents), 1)

  return (
    <div>
      {data.map((d) => (
        <div key={d.company_name} style={{ marginBottom: '1.1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
            <span>{d.company_name} {d.count > 1 && <span style={{ color: 'var(--text-muted)' }}>({d.count})</span>}</span>
            <strong>S/ {(d.amount_cents / 100).toFixed(2)}</strong>
          </div>
          <div style={{ background: '#eef0f5', borderRadius: 8, height: 20, overflow: 'hidden' }}>
            <div
              style={{
                width: `${Math.max(3, (d.amount_cents / max) * 100)}%`,
                background: color,
                height: '100%',
                borderRadius: 8,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
