import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Redirige usuarios ya autenticados al dashboard para que no vean login/landing de nuevo.
export default function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  return user ? <Navigate to="/dashboard" replace /> : children
}
