import { useState } from 'react'
import { publicApi } from '../services/api'
import formImg from '../assets/images/imgForm.png'

const EMPTY = { company_name: '', contact_name: '', email: '', phone: '', estimated_employees: '', message: '' }

export default function PartnershipForm() {
  const [form, setForm] = useState(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState(null) // 'ok' | 'error' | null

  function set(field, value) { setForm((f) => ({ ...f, [field]: value })) }

  async function handleSubmit(e) {
    e.preventDefault()
    setSubmitting(true)
    setResult(null)
    try {
      await publicApi.submitPartnershipRequest({
        ...form,
        estimated_employees: form.estimated_employees === '' ? 0 : Number(form.estimated_employees),
      })
      setResult('ok')
      setForm(EMPTY)
    } catch {
      setResult('error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="landing-partnership-section" id="convenios" aria-labelledby="partnership-heading">
      <h2 id="partnership-heading">Alianzas y convenios</h2>
      <p className="landing-features-subtitle" style={{ marginBottom: '0.5rem' }}>
        ¿Tu empresa quiere ofrecer DoctorData como beneficio para sus colaboradores?
      </p>
      <p className="landing-features-subtitle">
        También puedes escribirnos directamente a{' '}
        <a href="mailto:contacto@mydoctordata.net">contacto@mydoctordata.net</a>.
      </p>

      <div className="landing-partnership-card">
        <aside className="landing-partnership-panel">
          <img src={formImg} alt="Ilustración de formulario de alianzas empresariales"
            title="Alianzas y convenios DoctorData" className="landing-partnership-panel-img"
            width="375" height="600" loading="lazy" />
          <p className="landing-partnership-tagline">Lleva DoctorData como beneficio a tu equipo</p>
        </aside>

        <form className="landing-partnership-form" onSubmit={handleSubmit}>
          {result === 'ok' && (
            <div className="alert alert-info">¡Gracias! Recibimos tu solicitud y te contactaremos pronto.</div>
          )}
          {result === 'error' && (
            <div className="alert alert-error">No se pudo enviar la solicitud. Inténtalo de nuevo.</div>
          )}

          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="pf-company">Nombre de la empresa</label>
              <input id="pf-company" type="text" required value={form.company_name}
                onChange={(e) => set('company_name', e.target.value)} />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="pf-contact">Persona de contacto</label>
              <input id="pf-contact" type="text" required value={form.contact_name}
                onChange={(e) => set('contact_name', e.target.value)} />
            </div>
          </div>

          <div className="profile-row">
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="pf-email">Correo electrónico</label>
              <input id="pf-email" type="email" required value={form.email}
                onChange={(e) => set('email', e.target.value)} placeholder="contacto@empresa.com" />
            </div>
            <div className="form-group" style={{ flex: 1 }}>
              <label htmlFor="pf-phone">Teléfono (opcional)</label>
              <input id="pf-phone" type="tel" value={form.phone}
                onChange={(e) => set('phone', e.target.value)} />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="pf-employees">Número aproximado de colaboradores (opcional)</label>
            <input id="pf-employees" type="number" min={1} value={form.estimated_employees}
              onChange={(e) => set('estimated_employees', e.target.value)} />
          </div>

          <div className="form-group">
            <label htmlFor="pf-message">Mensaje (opcional)</label>
            <textarea id="pf-message" rows={3} value={form.message}
              onChange={(e) => set('message', e.target.value)} />
          </div>

          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Solicitar convenio'}
          </button>
        </form>
      </div>
    </section>
  )
}
