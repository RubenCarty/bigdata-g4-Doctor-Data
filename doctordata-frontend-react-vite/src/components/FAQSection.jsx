import { useState } from 'react'

const FAQS = [
  {
    q: '¿Qué es DoctorData?',
    a: 'DoctorData centraliza tu historial médico y el de tu familia en un solo lugar: alergias, condiciones, citas, descansos médicos y resultados clínicos. Accede a tu información aunque no tengas conexión y compártela con cualquier médico al instante mediante un código QR.',
  },
  {
    q: '¿Cómo funcionan los planes?',
    a: 'Eliges un plan según cuántas personas quieras cubrir bajo tu cuenta: Personal (1 persona), Familiar x3 o Familiar x5. Cada uno puede pagarse mensual o anual.',
  },
  {
    q: '¿Puedo comprar más de un plan a la vez?',
    a: 'Sí. Los planes se apilan en una sola cuenta — por ejemplo, puedes combinar dos planes Familiar x3 y uno Familiar x5 para cubrir 11 personas.',
  },
  {
    q: '¿Qué pasa si no renuevo mi suscripción?',
    a: 'Tu información básica (datos personales, tipo de sangre, alergias del perfil) nunca se pierde y sigue siendo legible. Solo se oculta la actividad médica (citas, descansos, registros clínicos) hasta que renueves.',
  },
  {
    q: '¿Mis datos están seguros?',
    a: 'Sí. Tu información personal y clínica se cifra en la base de datos (AES-256) y viaja cifrada entre tu dispositivo y el servidor. En la app móvil además se guarda localmente con SQLCipher.',
  },
  {
    q: '¿Cómo comparto mi historial con un médico?',
    a: 'Generas un código QR desde la app o la web. El médico lo escanea y accede al instante a tu perfil de emergencia: alergias, tipo de sangre y datos básicos.',
  },
  {
    q: '¿Los médicos están verificados?',
    a: 'Sí. Cada profesional de salud debe activar su perfil médico y subir su carné CMP, que un administrador valida antes de darle acceso a información clínica completa.',
  },
  {
    q: '¿Tienen convenios para empresas?',
    a: 'Sí — revisa la sección "Alianzas y convenios" más abajo para solicitar un código de descuento corporativo para tu empresa.',
  },
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0)

  return (
    <section className="landing-faq" aria-labelledby="faq-heading">
      <h2 id="faq-heading">Preguntas frecuentes</h2>
      <p className="landing-features-subtitle">Todo lo que necesitas saber antes de empezar</p>
      <div className="faq-list">
        {FAQS.map((item, i) => {
          const isOpen = openIndex === i
          return (
            <div key={item.q} className={`faq-item ${isOpen ? 'faq-item-open' : ''}`}>
              <button
                type="button"
                className="faq-question"
                aria-expanded={isOpen}
                onClick={() => setOpenIndex(isOpen ? -1 : i)}
              >
                <span>{item.q}</span>
                <span className="faq-toggle-icon" aria-hidden="true">{isOpen ? '−' : '+'}</span>
              </button>
              {isOpen && <p className="faq-answer">{item.a}</p>}
            </div>
          )
        })}
      </div>
    </section>
  )
}
