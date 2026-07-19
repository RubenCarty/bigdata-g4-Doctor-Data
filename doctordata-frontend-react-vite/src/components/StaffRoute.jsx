import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// Deja pasar a cualquiera de los roles a los que la empresa les paga por su trabajo — Ventas,
// Contabilidad o admin (is_super_admin siempre implica is_admin=true). Usado solo para
// /account/bank, donde cada quien carga la cuenta a la que se le debe pagar.
export default function StaffRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="loading">Cargando...</div>
  if (!user) return <Navigate to="/login" replace />
  if (!user.is_admin && !user.is_accounting && !user.is_sales) return <Navigate to="/dashboard" replace />
  return children
}
