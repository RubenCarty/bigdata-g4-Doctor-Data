import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { clinicalApi, adminApi, billingApi, memberApi, patientApi } from '../services/api'
import CapacityMeter from '../components/CapacityMeter'
import AppFooter from '../components/AppFooter'
import DailyRevenueChart from '../components/DailyRevenueChart'
import FacturasByCompanyChart from '../components/FacturasByCompanyChart'
import Sparkline from '../components/Sparkline'
import logo from '../assets/images/Doctor_Data_logo.png'

function StatCard({ n, label, color, spark }) {
  return (
    <div className="summary-card">
      <span className="summary-number" style={color ? { color } : {}}>{n ?? '…'}</span>
      <span className="summary-label">{label}</span>
      {spark && <Sparkline data={spark} color={color || 'var(--green)'} />}
    </div>
  )
}

// URL del perfil público (la misma que codifica el QR) mostrada como texto copiable — para
// poder revisar los propios datos registrados sin tener que escanear el QR con el celular,
// igual que la URL de perfil de LinkedIn/GitHub.
function CopyableURL({ url }) {
  const [copied, setCopied] = useState(false)

  function copy() {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="qr-url-row">
      <input className="qr-url-input" type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
      <button type="button" className="btn btn-outline" style={{ fontSize: '0.72rem', padding: '0.35rem 0.6rem', flexShrink: 0 }} onClick={copy}>
        {copied ? 'Copiado' : 'Copiar'}
      </button>
    </div>
  )
}

// Cada persona cubierta tiene su propio QR (apunta a su propio perfil público, distinto del
// del titular) — se pide bajo demanda en vez de cargar todos de una vez para no generar N
// imágenes que probablemente nadie va a ver.
function MemberQRCard({ member }) {
  const [qrSrc, setQrSrc] = useState(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  function toggle() {
    if (open) { setOpen(false); return }
    setOpen(true)
    if (qrSrc) return
    setLoading(true)
    patientApi.getQR(member.id)
      .then((r) => setQrSrc(URL.createObjectURL(r.data)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  function download() {
    if (!qrSrc) return
    const link = document.createElement('a')
    link.download = `doctordata-qr-${member.first_name}-${member.last_name}.png`
    link.href = qrSrc
    link.click()
  }

  return (
    <div className="record-card" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
        <strong>{member.first_name} {member.last_name}</strong>
        <button type="button" className="btn btn-outline" style={{ fontSize: '0.78rem', padding: '0.25rem 0.7rem' }} onClick={toggle}>
          {open ? 'Ocultar QR' : 'Ver QR'}
        </button>
      </div>
      {open && (
        <div style={{ marginTop: '0.75rem' }}>
          {loading && <span>Generando QR...</span>}
          {qrSrc && (
            <>
              <img src={qrSrc} alt={`Código QR de ${member.first_name}`} style={{ width: 160, height: 160, display: 'block' }} />
              <button type="button" onClick={download} className="btn btn-primary" style={{ marginTop: '0.5rem', fontSize: '0.82rem' }}>
                Descargar QR (PNG)
              </button>
              <CopyableURL url={`${window.location.origin}/patient/profile/${member.id}`} />
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const { user, logout, refreshUser } = useAuth()
  const navigate = useNavigate()
  const [allergies, setAllergies] = useState([])
  const [appointments, setAppointments] = useState([])
  const [conditions, setConditions] = useState([])
  const [qrSrc, setQrSrc] = useState(null)
  const [qrLoading, setQrLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [salesStats, setSalesStats] = useState(null)
  const [capacity, setCapacity] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [members, setMembers] = useState([])

  // `user.has_active_subscription` solo se carga al iniciar sesión — si el usuario compró
  // una suscripción más tarde en la misma sesión (ej. durante el checkout), queda
  // desactualizado. Se refresca cada vez que se entra al dashboard para que el aviso de
  // arriba no contradiga lo que ya muestra "Mi suscripción".
  useEffect(() => {
    refreshUser().catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // "Mi resumen" cuenta alergias/condiciones/citas de TODAS las personas de la cuenta (el
  // titular + cada persona cubierta), no solo del titular — de lo contrario el número no
  // cuadra con lo que la familia realmente registró (ver memberApi.list() más abajo).
  useEffect(() => {
    if (!user?.has_active_subscription || members.length === 0) return
    Promise.all(members.map((m) => clinicalApi.listAllergies(m.id).catch(() => ({ data: [] }))))
      .then((results) => setAllergies(results.flatMap((r) => r.data ?? [])))
    Promise.all(members.map((m) => clinicalApi.listAppointments(m.id).catch(() => ({ data: [] }))))
      .then((results) => setAppointments(results.flatMap((r) => r.data ?? [])))
    Promise.all(members.map((m) => clinicalApi.listConditions(m.id).catch(() => ({ data: [] }))))
      .then((results) => setConditions(results.flatMap((r) => r.data ?? [])))
  }, [user?.has_active_subscription, members])

  useEffect(() => {
    billingApi.getMyCapacity().then((r) => setCapacity(r.data)).catch(() => {})
    billingApi.listMySubscriptions().then((r) => setSubscriptions(r.data ?? [])).catch(() => {})
    memberApi.list().then((r) => setMembers(r.data ?? [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (user?.is_admin) {
      adminApi.getStats().then((r) => setStats(r.data)).catch(() => {})
      adminApi.getSalesStats().then((r) => setSalesStats(r.data)).catch(() => {})
    }
  }, [user?.is_admin])

  // QR generado en el backend — no depende de npm ni CDN. Este es el QR del propio titular;
  // cada persona cubierta tiene el suyo propio (ver MemberQR más abajo), porque apuntan a
  // perfiles distintos.
  useEffect(() => {
    if (!user?.id) return
    patientApi.getQR()
      .then((r) => {
        const url = URL.createObjectURL(r.data)
        setQrSrc(url)
      })
      .catch(() => {})
      .finally(() => setQrLoading(false))

    return () => {
      if (qrSrc) URL.revokeObjectURL(qrSrc)
    }
  }, [user?.id])

  function downloadQR() {
    if (!qrSrc) return
    const link = document.createElement('a')
    link.download = `doctordata-qr-${user?.email}.png`
    link.href = qrSrc
    link.click()
  }

  function handleLogout() {
    logout()
    navigate('/login')
  }

  const coveredMembers = members.filter((m) => m.user_id !== user?.id)

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <Link to="/">
          <img src={logo} alt="Logotipo Doctor Data — inicio" title="Ir al inicio"
            className="dashboard-header-logo" />
        </Link>
        <div className="header-actions">
          <span>{user?.email}</span>
          {user?.is_doctor && <span className="badge badge-doctor">Médico</span>}
          {user?.is_admin && <span className="badge badge-admin">Admin</span>}
          {user?.is_super_admin && <span className="badge badge-admin">Super admin</span>}
          <button onClick={handleLogout} className="btn btn-outline">Salir</button>
        </div>
      </header>

      <main className="dashboard-content">
        {!user?.has_active_subscription && (
          <div className="alert alert-error" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
            <span>Todavía no tienes una suscripción activa — necesitas una para registrar tus datos.</span>
            <Link to="/pricing" className="btn btn-primary" style={{ fontSize: '0.85rem' }}>Ver planes</Link>
          </div>
        )}

        {/* Mi suscripción */}
        <section className="dashboard-section">
          <h2>Mi suscripción</h2>
          {capacity && (
            <div style={{ maxWidth: 400, marginBottom: '1rem' }}>
              <CapacityMeter used={capacity.used_capacity} total={capacity.total_capacity} />
            </div>
          )}
          {subscriptions.filter((s) => s.status === 'active' && new Date(s.period_end) > new Date()).length > 0 && (
            <div className="record-list" style={{ marginBottom: '1rem' }}>
              {subscriptions.filter((s) => s.status === 'active' && new Date(s.period_end) > new Date()).map((s) => (
                <div key={s.id} className="record-card">
                  <strong>{s.plan?.name}</strong>
                  <p>Vence: {s.period_end ? new Date(s.period_end).toLocaleDateString('es-PE') : '—'}</p>
                  <p>Pagaste: S/ {(s.final_price_cents / 100).toFixed(2)}</p>
                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>Te avisaremos antes de que venza para que renueves a mano.</p>
                </div>
              ))}
            </div>
          )}
          <Link to="/pricing" className="btn btn-outline">Comprar más capacidad</Link>
        </section>

        {/* Personas cubiertas — excluye el propio perfil del titular (mismo user_id), que ya
            se representa en el resto del dashboard. Ojo: no alcanza con "!m.user_id" — una
            persona cubierta nombrada médico también tiene user_id propio (el suyo, no el del
            titular) y debe seguir apareciendo acá. */}
        <section className="dashboard-section">
          <h2>Personas cubiertas</h2>
          {coveredMembers.length === 0 && (
            <p className="empty-state-inline">Aún no agregaste a nadie más.</p>
          )}
          {coveredMembers.length > 0 && (
            <div className="record-list" style={{ marginBottom: '1rem' }}>
              {coveredMembers.map((m) => (
                <MemberQRCard key={m.id} member={m} />
              ))}
            </div>
          )}
          <Link to="/onboarding/profile" className="btn btn-outline">Agregar / gestionar personas cubiertas</Link>
        </section>

        {/* Fila superior: panel admin (si aplica) + QR */}
        <div className="dashboard-top-row">
          {user?.is_admin && (
            <section className="dashboard-section" style={{ flex: 1 }}>
              <div className="admin-banner">
                <div className="admin-banner-text">
                  <h2>Panel de administración</h2>
                  <p>Acceso completo al sistema. Las funciones administrativas están en morado.</p>
                </div>
              </div>
              <div className="card-grid" style={{ marginTop: '1rem' }}>
                <Link to="/admin/users" className="card card-admin">
                  <h3>Usuarios</h3>
                  <p>Gestionar cuentas de pacientes y médicos</p>
                </Link>
                <Link to="/admin/doctors" className="card card-admin">
                  <h3>Médicos pendientes</h3>
                  <p>Revisar y aprobar activaciones de perfil médico</p>
                </Link>
                <Link to="/admin/plans" className="card card-admin">
                  <h3>Planes</h3>
                  <p>Gestionar planes de suscripción</p>
                </Link>
                <Link to="/admin/discounts" className="card card-admin">
                  <h3>Códigos de descuento</h3>
                  <p>Crear y administrar descuentos y referidos</p>
                </Link>
                <Link to="/admin/partnerships" className="card card-admin">
                  <h3>Alianzas y convenios</h3>
                  <p>Solicitudes de empresas desde el formulario público</p>
                </Link>
                <Link to="/admin/sales" className="card card-admin">
                  <h3>Boletas y facturas</h3>
                  <p>Seguimiento de boletas de suscripción y facturas de convenios</p>
                </Link>
                <Link to="/admin/sellers" className="card card-admin">
                  <h3>Ventas</h3>
                  <p>Leaderboard de comisiones y códigos de descuento del equipo comercial</p>
                </Link>
                <Link to="/account/bank" className="card card-admin">
                  <h3>Cuenta bancaria</h3>
                  <p>La cuenta a la que te corresponde que se te pague</p>
                </Link>
                {user?.is_super_admin && (
                  <Link to="/admin/audit-log" className="card card-admin">
                    <h3>Audit Log</h3>
                    <p>Ver la actividad del sistema</p>
                  </Link>
                )}

              </div>
            </section>
          )}

          {/* Panel angosto para Contabilidad (sin is_admin) — a propósito NO muestra el resto
              del panel admin (usuarios, médicos, planes, descuentos, convenios), es justo lo
              que pidió: solo lo suyo. Si ya es admin, ve el panel completo de arriba y este
              bloque no se duplica. */}
          {user?.is_accounting && !user?.is_admin && (
            <section className="dashboard-section" style={{ flex: 1 }}>
              <div className="admin-banner">
                <div className="admin-banner-text">
                  <h2>Contabilidad</h2>
                  <p>Acceso a boletas y facturas.</p>
                </div>
              </div>
              <div className="card-grid" style={{ marginTop: '1rem' }}>
                <Link to="/admin/sales" className="card card-admin">
                  <h3>Boletas y facturas</h3>
                  <p>Seguimiento de boletas de suscripción y facturas de convenios</p>
                </Link>
                <Link to="/account/bank" className="card card-admin">
                  <h3>Cuenta bancaria</h3>
                  <p>La cuenta a la que te corresponde que se te pague</p>
                </Link>
              </div>
            </section>
          )}

          {/* Panel angosto para Ventas (sin is_admin) — mismo criterio que Contabilidad: solo
              lo suyo (leaderboard + sus códigos + calculadora B2B), nada del resto del panel
              admin. Si ya es admin, ve el panel completo de arriba y este no se duplica. */}
          {user?.is_sales && !user?.is_admin && (
            <section className="dashboard-section" style={{ flex: 1 }}>
              <div className="admin-banner">
                <div className="admin-banner-text">
                  <h2>Ventas</h2>
                  <p>Leaderboard de comisiones, tus códigos y la calculadora B2B.</p>
                </div>
              </div>
              <div className="card-grid" style={{ marginTop: '1rem' }}>
                <Link to="/admin/sellers" className="card card-admin">
                  <h3>Ventas</h3>
                  <p>Leaderboard, códigos de descuento y calculadora de convenios B2B</p>
                </Link>
                <Link to="/account/bank" className="card card-admin">
                  <h3>Cuenta bancaria</h3>
                  <p>La cuenta a la que te corresponde que se te pague</p>
                </Link>
              </div>
            </section>
          )}

          {/* Bloque QR */}
          <div className="qr-block">
            <h2 className="qr-title">Mi código QR</h2>
            <p className="qr-subtitle">
              Es tu código, el del titular de la cuenta.<br />
              Cada persona cubierta tiene el suyo propio<br />
              — ver "Personas cubiertas" abajo.
            </p>

            {qrLoading && (
              <div className="qr-pending">
                <span>Generando QR...</span>
              </div>
            )}

            {!qrLoading && !qrSrc && (
              <div className="qr-pending">
                <span style={{ fontSize: '2rem', display: 'block', marginBottom: '0.5rem' }}>⚠</span>
                <p>No se pudo generar tu código QR.</p>
                <p style={{ fontSize: '0.78rem', marginTop: '0.35rem' }}>
                  Intenta recargar la página. Si el problema sigue, contáctanos.
                </p>
              </div>
            )}

            {qrSrc && (
              <>
                <img
                  src={qrSrc}
                  alt="Código QR del perfil de paciente"
                  title="Escanea para ver el historial médico"
                  style={{ width: 200, height: 200, display: 'block' }}
                />
                <button onClick={downloadQR} className="btn btn-primary"
                  style={{ marginTop: '0.75rem', width: '100%' }}>
                  Descargar QR (PNG)
                </button>
                <CopyableURL url={`${window.location.origin}/patient/${user?.id}`} />
              </>
            )}
          </div>
        </div>

        {/* Mi perfil — deja explícito que estas tarjetas son sobre el titular de la cuenta,
            no sobre las personas cubiertas (esas se gestionan desde "Personas cubiertas"
            arriba, incluyendo su propia información clínica vía el selector en /clinical). */}
        <section className="dashboard-section">
          <h2>Mi perfil</h2>
          <p className="page-subtitle" style={{ marginTop: '-0.5rem', marginBottom: '1rem' }}>
            Tus datos como titular de la cuenta ({user?.email}). Para las personas que cubres,
            usa "Personas cubiertas" arriba — su información clínica también se gestiona desde
            Información clínica, eligiendo a quién corresponde.
          </p>
          <div className="card-grid">
            <Link to="/profile" className="card card-highlight">
              <h3>Datos personales</h3>
              <p>Ver y editar tu perfil de paciente</p>
            </Link>
            <Link to="/clinical" className="card">
              <h3>Información clínica</h3>
              <p>Alergias, condiciones (incluyendo salud mental), citas y más</p>
            </Link>
            {!user?.is_doctor && (
              <Link to="/medical-profile" className="card">
                <h3>Soy médico</h3>
                <p>Activar perfil profesional</p>
              </Link>
            )}
            {user?.is_doctor && (
              <Link to="/medical-profile" className="card">
                <h3>Perfil médico</h3>
                <p>Ver datos de colegiatura y especialidad</p>
              </Link>
            )}
          </div>
        </section>

        {/* Ventas (últimos 30 días) — solo admin. Solo boletas (venta de suscripciones);
            las facturas de convenios se llevan aparte en /admin/sales para no distorsionar
            este resumen con montos grandes y poco frecuentes. */}
        {user?.is_admin && salesStats && (
          <section className="dashboard-section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>Ventas — últimos 30 días</h2>
              <Link to="/admin/sales" className="btn btn-outline" style={{ fontSize: '0.82rem' }}>Ver boletas y facturas</Link>
            </div>
            <p className="page-subtitle" style={{ marginTop: 0, marginBottom: '1rem' }}>
              Solo suscripciones — los convenios (facturas) se llevan aparte.
            </p>
            {/* Arriba, las dos tarjetas con gráfico (para que se lean bien); abajo, las que
                son solo números derivados (IGV/comisión/neto) — ver feedback del dueño del
                producto sobre por qué esta separación hace que los gráficos se vean mejor. */}
            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
              <StatCard n={`S/ ${(salesStats.total_revenue_cents / 100).toFixed(2)}`} label="Vendido (bruto)" color="var(--indigo)"
                spark={salesStats.daily?.map((d) => d.revenue_cents)} />
              <StatCard n={salesStats.boletas_count} label="Boletas emitidas"
                spark={salesStats.daily?.map((d) => d.count)} />
            </div>
            <div className="summary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', marginBottom: '1.25rem' }}>
              <StatCard n={`S/ ${(salesStats.total_igv_cents / 100).toFixed(2)}`} label="IGV (18%)" color="#b45309" />
              <StatCard n={`S/ ${(salesStats.total_izipay_fee_cents / 100).toFixed(2)}`} label="Comisión Izipay" color="#b45309" />
              <StatCard n={`S/ ${(salesStats.net_cents / 100).toFixed(2)}`} label="Neto" color="var(--green-dark)" />
            </div>

            {/* Fila propia para la tendencia diaria (es la más ancha/importante), y una
                segunda fila con las otras dos tablas lado a lado. */}
            <div className="chart-card" style={{ marginBottom: '1.25rem' }}>
              <h3>Boletas — tendencia diaria</h3>
              <DailyRevenueChart data={salesStats.daily} />
            </div>

            <div className="chart-grid">
              {salesStats.by_plan?.length > 0 && (
                <div className="chart-card">
                  <h3>Boletas — por plan</h3>
                  {salesStats.by_plan.map((p) => {
                    const max = Math.max(...salesStats.by_plan.map((x) => x.revenue_cents), 1)
                    const pct = Math.round((p.revenue_cents / max) * 100)
                    return (
                      <div key={p.plan_name} style={{ marginBottom: '1.1rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.95rem', marginBottom: '0.35rem' }}>
                          <span>{p.plan_name} ({p.count})</span>
                          <strong>S/ {(p.revenue_cents / 100).toFixed(2)}</strong>
                        </div>
                        <div className="capacity-meter-bar" style={{ height: 20, borderRadius: 8 }}>
                          <div className="capacity-meter-fill" style={{ width: `${pct}%`, borderRadius: 8 }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {salesStats.facturas?.by_company?.length > 0 && (
                <div className="chart-card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Facturas (convenios) — por empresa</h3>
                    <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--indigo)' }}>
                      Total: S/ {(salesStats.facturas.total_cents / 100).toFixed(2)}
                    </span>
                  </div>
                  <FacturasByCompanyChart data={salesStats.facturas.by_company} />
                </div>
              )}
            </div>
          </section>
        )}

        {/* Métricas del sistema — solo admin */}
        {user?.is_admin && stats && (
          <section className="dashboard-section">
            <h2>Métricas del sistema</h2>
            <div className="summary-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
              <StatCard n={stats.total_users}      label="Usuarios totales"        color="var(--indigo)" />
              <StatCard n={stats.total_doctors}    label="Médicos activos"         color="var(--green-dark)" />
              <StatCard n={stats.approved_doctors} label="CMP aprobados"           color="#166534" />
              <StatCard n={stats.pending_doctors}  label="CMP en revisión"         color="#b45309" />
              <StatCard n={stats.patient_profiles} label="Perfiles de paciente"    color="var(--blue)" />
              <StatCard n={stats.allergies}        label="Alergias registradas"    />
              <StatCard n={stats.conditions}       label="Condiciones de salud"    />
              <StatCard n={stats.appointments}     label="Citas médicas"           />
              <StatCard n={stats.medical_leaves}   label="Descansos médicos"       />
              <StatCard n={stats.clinical_records} label="Registros clínicos"      />
            </div>
          </section>
        )}

        {/* Resumen rápido — datos propios del usuario */}
        <section className="dashboard-section">
          <h2>Mi resumen</h2>
          <div className="summary-grid">
            <div className="summary-card">
              <span className="summary-number">{allergies.length}</span>
              <span className="summary-label">Alergias registradas</span>
            </div>
            <div className="summary-card">
              <span className="summary-number">{conditions.length}</span>
              <span className="summary-label">Condiciones de salud</span>
            </div>
            <div className="summary-card">
              <span className="summary-number">{appointments.length}</span>
              <span className="summary-label">Citas médicas</span>
            </div>
          </div>
        </section>
      </main>

      <AppFooter />
    </div>
  )
}
