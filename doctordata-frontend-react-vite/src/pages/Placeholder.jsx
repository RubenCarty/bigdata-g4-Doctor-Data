import { Link } from 'react-router-dom'

export default function Placeholder({ title = 'En desarrollo' }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', background: '#f5f8f2' }}>
      <span style={{ fontSize: '2.5rem' }}>🚧</span>
      <h2 style={{ margin: 0 }}>{title}</h2>
      <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Esta sección estará disponible próximamente.</p>
      <Link to="/dashboard" style={{ color: '#72ab4d', fontWeight: 600 }}>← Volver al inicio</Link>
    </div>
  )
}
