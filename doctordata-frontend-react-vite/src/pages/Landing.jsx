import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { billingApi } from '../services/api'
import PricingTable from '../components/PricingTable'
import AppFooter from '../components/AppFooter'
import TrustStats from '../components/TrustStats'
import FAQSection from '../components/FAQSection'
import PartnershipForm from '../components/PartnershipForm'
import logo from '../assets/images/Doctor_Data_logo.png'
import heroImg from '../assets/images/homeImage.png'

export default function Landing() {
  const [plans, setPlans] = useState([])

  useEffect(() => {
    billingApi.listPlans().then((r) => setPlans(r.data ?? [])).catch(() => {})
  }, [])

  return (
    <div>
      <nav className="landing-nav">
        <img src={logo} alt="Logotipo Doctor Data" title="Doctor Data — inicio" className="landing-nav-logo"
          width="180" height="42" loading="eager" />
        <div className="landing-nav-actions">
          <Link to="/login" className="btn btn-outline">Iniciar sesión</Link>
          <Link to="/register" className="btn btn-primary">Crear cuenta</Link>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-image">
          <img src={heroImg} alt="Médico usando Doctor Data en su dispositivo para gestionar historiales clínicos"
            title="Doctor Data — gestión de salud digital" width="500" height="500"
            loading="eager" fetchPriority="high" />
        </div>
        <div className="landing-hero-text">
          <h1>Tu historial médico, siempre contigo</h1>
          <p>
            DoctorData centraliza tu información de salud de forma segura.
            Comparte tu historial con cualquier médico al instante y accede a él
            aunque no tengas conexión a internet.
          </p>
          <div className="landing-hero-actions">
            <Link to="/register" className="btn btn-white">Crear cuenta</Link>
            <Link to="/login" className="btn btn-white-outline">Iniciar sesión</Link>
          </div>
        </div>
      </section>

      <TrustStats />

      <section className="landing-features" id="funcionalidades">
        <h2>Todo lo que necesitas</h2>
        <p className="landing-features-subtitle">Una plataforma integral para la gestión de tu salud personal</p>
        <div className="landing-features-grid">
          <div className="landing-feature-card">
            <div className="landing-feature-icon">📋</div>
            <h3>Historial clínico completo</h3>
            <p>Registra alergias, condiciones crónicas, signos vitales y resultados de laboratorio en un solo lugar.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">📱</div>
            <h3>Acceso sin conexión</h3>
            <p>La app móvil guarda tu información cifrada en tu dispositivo. Disponible aunque no tengas internet.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🔲</div>
            <h3>Comparte via código QR</h3>
            <p>Muestra tu historial a cualquier médico al instante escaneando un código QR generado desde la app.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">👨‍⚕️</div>
            <h3>Perfil médico profesional</h3>
            <p>Los profesionales de salud pueden activar su perfil médico y acceder a información clínica completa.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">👨‍👩‍👧</div>
            <h3>Grupos familiares</h3>
            <p>Gestiona el historial de toda tu familia desde una sola cuenta con perfiles separados para cada miembro.</p>
          </div>
          <div className="landing-feature-card">
            <div className="landing-feature-icon">🔒</div>
            <h3>Cifrado de extremo a extremo</h3>
            <p>Tu información está protegida con SQLCipher en el dispositivo y HTTPS en la comunicación con el servidor.</p>
          </div>
        </div>
      </section>

      {plans.length > 0 && (
        <section className="landing-pricing" id="planes">
          <h2>Planes y precios</h2>
          <p className="landing-features-subtitle">Elige mensual o anual según cuántas personas quieras cubrir</p>
          <PricingTable
            plans={plans}
            renderPriceRow={(plan, isFeatured) => (
              <Link to="/register" className={`btn ${isFeatured ? 'btn-primary' : 'btn-outline'}`}>
                Elegir plan
              </Link>
            )}
          />
        </section>
      )}

      <FAQSection />

      <PartnershipForm />

      <AppFooter className="landing-footer" />
    </div>
  )
}
