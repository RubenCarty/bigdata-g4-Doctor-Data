import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Deja pasar a Ventas (is_sales) o a cualquier admin — un admin no queda excluido de nada,
// solo se abre el acceso a una cuenta más angosta que no necesita ver el resto del panel.
export default function SellersRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin && !user.is_sales) return <Navigate to="/dashboard" replace />
  return children
}
