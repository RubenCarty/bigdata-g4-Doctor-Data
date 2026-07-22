import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import PublicRoute from './components/PublicRoute'
import AdminRoute from './components/AdminRoute'
import SuperAdminRoute from './components/SuperAdminRoute'
import AccountingRoute from './components/AccountingRoute'
import SellersRoute from './components/SellersRoute'
import StaffRoute from './components/StaffRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import MedicalProfile from './pages/MedicalProfile'
import ClinicalInfo from './pages/ClinicalInfo'
import PatientProfile from './pages/PatientProfile'
import AdminDoctors from './pages/AdminDoctors'
import AdminUsers from './pages/AdminUsers'
import AdminPlans from './pages/AdminPlans'
import AdminDiscounts from './pages/AdminDiscounts'
import AdminPartnerships from './pages/AdminPartnerships'
import AdminSales from './pages/AdminSales'
import AdminSellers from './pages/AdminSellers'
import AdminAuditLog from './pages/AdminAuditLog'
import Pricing from './pages/Pricing'
import CheckoutStub from './pages/CheckoutStub'
import IzipayCheckout from './pages/IzipayCheckout'
import BankAccount from './pages/BankAccount'
import OnboardingProfile from './pages/OnboardingProfile'
import Placeholder from './pages/Placeholder'
import './App.css'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Landing y auth — redirigen al dashboard si ya hay sesión */}
          <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          {/* Register maneja su propio guard de redirección (ver comentario en Register.jsx) */}
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />

          {/* Ruta pública de perfil de paciente via QR — sin auth requerido */}
          <Route path="/patient/:userId" element={<PatientProfile />} />
          {/* Personas cubiertas no tienen user_id/login propio — su QR apunta acá en vez de
              /patient/:userId (ver GetMyQR/PatientPublicProfileByID en el backend). */}
          <Route path="/patient/profile/:profileId" element={<PatientProfile />} />

          {/* Precios — pública para visitantes, también usable con sesión activa */}
          <Route path="/pricing" element={<Pricing />} />

          {/* Rutas privadas */}
          <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/checkout/stub" element={<PrivateRoute><CheckoutStub /></PrivateRoute>} />
          {/* Sin PrivateRoute a propósito: se puede abrir en un navegador sin sesión web (ej.
              desde el navegador del sistema al comprar desde la app nativa) — el formToken en
              sí ya es la autorización de ESE pago puntual, ya validado al crear el checkout
              (POST /me/subscriptions/checkout, que sí requiere sesión); la confirmación real
              llega después por la IPN de Izipay server-a-server, no depende de esta sesión. */}
          <Route path="/checkout/izipay" element={<IzipayCheckout />} />
          <Route path="/account/bank" element={<StaffRoute><BankAccount /></StaffRoute>} />
          <Route path="/onboarding/profile" element={<PrivateRoute><OnboardingProfile /></PrivateRoute>} />
          <Route path="/clinical" element={<PrivateRoute><ClinicalInfo /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/medical-profile" element={<PrivateRoute><MedicalProfile /></PrivateRoute>} />
          <Route path="/admin/users" element={<PrivateRoute><AdminUsers /></PrivateRoute>} />
          <Route path="/admin/doctors" element={<PrivateRoute><AdminDoctors /></PrivateRoute>} />
          <Route path="/admin/plans" element={<AdminRoute><AdminPlans /></AdminRoute>} />
          <Route path="/admin/discounts" element={<AdminRoute><AdminDiscounts /></AdminRoute>} />
          <Route path="/admin/partnerships" element={<AdminRoute><AdminPartnerships /></AdminRoute>} />
          <Route path="/admin/sales" element={<AccountingRoute><AdminSales /></AccountingRoute>} />
          <Route path="/admin/sellers" element={<SellersRoute><AdminSellers /></SellersRoute>} />
          <Route path="/admin/audit-log" element={<SuperAdminRoute><AdminAuditLog /></SuperAdminRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
