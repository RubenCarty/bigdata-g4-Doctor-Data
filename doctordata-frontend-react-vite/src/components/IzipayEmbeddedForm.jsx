import { useEffect, useState } from 'react'

const KR_SCRIPT_URL = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/stable/kr-payment-form.min.js'
const KR_CSS_URL = 'https://static.micuentaweb.pe/static/js/krypton-client/V4.0/ext/classic.css'

// Formulario de pago embebido de Izipay ("Krypton") — inyecta su script oficial con la clave
// pública, y Krypton escanea el DOM al cargar buscando el div .kr-embedded con el atributo
// kr-form-token (ya presente porque React lo renderiza ANTES de que corra este efecto). Solo
// confirma éxito client-side vía KR.onSubmit — es solo UX inmediata, la fuente de verdad real
// es la notificación IPN server-to-server (ver internal/payments/izipay.go en el backend).
export default function IzipayEmbeddedForm({ formToken, publicKey, onSuccess, onError }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    function hookSubmit() {
      if (cancelled || !window.KR) return
      window.KR.onSubmit((event) => {
        if (event.clientAnswer?.orderStatus === 'PAID') {
          onSuccess?.(event)
        } else {
          onError?.('El pago no se completó. Intenta de nuevo.')
        }
        return false // no dejar que Krypton haga su propio submit/redirect del navegador
      })
      setReady(true)
    }

    if (window.KR) {
      hookSubmit()
      return () => { cancelled = true }
    }

    if (!document.querySelector('link[data-kr-css]')) {
      const link = document.createElement('link')
      link.rel = 'stylesheet'
      link.href = KR_CSS_URL
      link.setAttribute('data-kr-css', 'true')
      document.head.appendChild(link)
    }

    const script = document.createElement('script')
    script.src = KR_SCRIPT_URL
    script.setAttribute('kr-public-key', publicKey)
    script.setAttribute('kr-language', 'es-ES')
    script.onload = hookSubmit
    script.onerror = () => onError?.('No se pudo cargar el formulario de pago de Izipay.')
    document.head.appendChild(script)

    return () => { cancelled = true }
  }, [publicKey])

  return (
    <div>
      {!ready && <div className="loading">Cargando formulario de pago...</div>}
      <div className="kr-embedded" kr-form-token={formToken}></div>
    </div>
  )
}
