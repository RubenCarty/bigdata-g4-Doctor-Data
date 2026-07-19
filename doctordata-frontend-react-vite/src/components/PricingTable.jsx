import { useState } from 'react'
import soloPack from '../assets/images/packs/solo-pack.png'
import triPack from '../assets/images/packs/tri-pack.png'
import pentaPack from '../assets/images/packs/penta-pack.png'

const CAPACITY_IMAGES = { 1: soloPack, 3: triPack, 5: pentaPack }

function formatSoles(cents) {
  return `S/ ${(cents / 100).toFixed(2)}`
}

function tierTitle(plan) {
  if (!plan) return 'Plan'
  return plan.name.replace(/\s+(mensual|anual)\s*$/i, '')
}

function formatDeadline(iso) {
  return new Date(iso).toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' })
}

// PricingTable agrupa los SubscriptionPlan primero por promo_label (vacío = fila "normal",
// que siempre se muestra al final) y luego, dentro de cada grupo, por covered_capacity — una
// columna por nivel de capacidad. Los grupos con promo_label (ej. "Fundador", futuro "Cyber
// Days") se muestran primero, ordenados por fecha límite más próxima, para empujar la compra
// mientras dura la oferta. promo_label es solo una clave de agrupación interna/administrativa
// — el título que ve el cliente siempre es el genérico "Ofertas" (fila plana: "Precios
// regulares"), para no tener que mantener el texto visible en sync con el nombre de cada
// campaña. Es puramente presentacional: quien la usa decide qué acción mostrar por columna
// vía renderPriceRow(plan, isFeatured) — así PlanPicker.jsx inyecta su selector de cantidad
// y Landing.jsx un simple botón "Crear cuenta", compartiendo el mismo layout visual.
export default function PricingTable({ plans, renderPriceRow }) {
  const promoGroups = {}
  for (const plan of plans) {
    const key = plan.promo_label || ''
    if (!promoGroups[key]) promoGroups[key] = []
    promoGroups[key].push(plan)
  }

  const promoKeys = Object.keys(promoGroups).filter((k) => k !== '')
  promoKeys.sort((a, b) => {
    const da = promoGroups[a].find((p) => p.available_until)?.available_until
    const db = promoGroups[b].find((p) => p.available_until)?.available_until
    if (!da) return 1
    if (!db) return -1
    return new Date(da) - new Date(db)
  })
  const orderedKeys = [...promoKeys, ...(promoGroups[''] ? [''] : [])]
  const normalPlans = promoGroups[''] || []

  if (orderedKeys.length === 0) {
    return <div className="empty-state">No hay planes disponibles por el momento.</div>
  }

  return (
    <div>
      <p className="pricing-stack-note">
        ¿Familias de distinto tamaño? Puedes comprar más de un plan a la vez y se combinan en
        una sola cuenta — por ejemplo, dos planes Familiar x3 y uno Familiar x5 cubren 11
        personas.
      </p>
      {orderedKeys.map((key) => (
        <PricingRow
          key={key || 'normal'}
          label={key}
          groupPlans={promoGroups[key]}
          normalPlans={normalPlans}
          renderPriceRow={renderPriceRow}
        />
      ))}
      <p className="pricing-igv-note">Precios incluyen IGV (18%).</p>
    </div>
  )
}

function PricingRow({ label, groupPlans, normalPlans, renderPriceRow }) {
  const isPromo = !!label
  const byCapacity = {}
  for (const plan of groupPlans) {
    if (!byCapacity[plan.covered_capacity]) byCapacity[plan.covered_capacity] = []
    byCapacity[plan.covered_capacity].push(plan)
  }
  const capacities = Object.keys(byCapacity).map(Number).sort((a, b) => a - b)

  return (
    <div className="pricing-row-section">
      <div className="pricing-row-heading">
        <h3 className={isPromo ? 'pricing-row-title-promo' : 'pricing-row-title-plain'}>
          {isPromo ? 'Ofertas' : 'Precios regulares'}
        </h3>
      </div>
      <div className="pricing-table">
        {capacities.map((capacity) => (
          <PricingColumn
            key={capacity}
            capacity={capacity}
            columnPlans={byCapacity[capacity]}
            isPromo={isPromo}
            normalMatch={normalPlans.find((p) => p.covered_capacity === capacity && p.billing_period === 'monthly')}
            renderPriceRow={renderPriceRow}
          />
        ))}
      </div>
    </div>
  )
}

function PricingColumn({ capacity, columnPlans, isPromo, normalMatch, renderPriceRow }) {
  const isFeatured = columnPlans.some((p) => p.is_featured)
  const title = tierTitle(columnPlans[0])
  const description = columnPlans.find((p) => p.description)?.description

  const defaultPlan = columnPlans.find((p) => p.billing_period === 'annual') ?? columnPlans[0]
  const [selectedId, setSelectedId] = useState(defaultPlan.id)
  const selectedPlan = columnPlans.find((p) => p.id === selectedId) ?? defaultPlan

  const columnClass = [
    'pricing-column',
    isPromo && 'pricing-column-promo',
    isFeatured && 'pricing-column-featured',
  ].filter(Boolean).join(' ')

  return (
    <div className={columnClass}>
      {isFeatured && <span className="pricing-ribbon">Recomendado</span>}

      <img
        src={CAPACITY_IMAGES[capacity] ?? triPack}
        alt={`Ilustración de plan para ${capacity} persona${capacity > 1 ? 's' : ''}`}
        title={`Plan para hasta ${capacity} persona${capacity > 1 ? 's' : ''}`}
        className="pricing-image"
        width="88" height="88" loading="lazy"
      />

      <h3>{title}</h3>
      <span className="badge plan-card-badge-capacity">
        Hasta {capacity} persona{capacity > 1 ? 's' : ''}
      </span>
      {description && <p className="pricing-description">{description}</p>}

      {columnPlans.length > 1 && (
        <div className="pricing-period-toggle">
          {columnPlans.map((p) => (
            <button
              key={p.id}
              type="button"
              className={`pricing-period-btn ${p.id === selectedId ? 'pricing-period-btn-active' : ''}`}
              onClick={() => setSelectedId(p.id)}
            >
              {p.billing_period === 'annual' ? 'Anual' : 'Mensual'}
            </button>
          ))}
        </div>
      )}

      <PriceBlock plan={selectedPlan} normalMatch={normalMatch} renderPriceRow={renderPriceRow} isFeatured={isFeatured} />
    </div>
  )
}

// PriceBlock — cualquier plan anual (no solo los de promo_label) recibe el tratamiento
// "estilo GoDaddy": precio grande = equivalente mensual del pago único, insignia de ahorro
// (comparado contra el plan Normal mensual de la misma capacidad, si existe) y letra chica
// con el cargo real y la renovación — que es el mismo monto, sin sorpresas. Los planes
// mensuales muestran el precio tal cual. El botón de acción siempre va al final, debajo de
// todo el bloque de precio — nunca al costado.
function PriceBlock({ plan, normalMatch, renderPriceRow, isFeatured }) {
  const isAnnual = plan.billing_period === 'annual'

  if (!isAnnual) {
    return (
      <div className="pricing-price-rows">
        <div className="pricing-price-row">
          <span className="pricing-price">{formatSoles(plan.price_cents)}</span>
          <span className="plan-card-price-period">/mes</span>
        </div>
        {plan.available_until && (
          <p className="pricing-deadline-note">Disponible hasta el {formatDeadline(plan.available_until)}</p>
        )}
        {!plan.allows_discounts && (
          <p className="pricing-no-discount-note">No admite códigos de descuento.</p>
        )}
        <div className="pricing-cta">{renderPriceRow(plan, isFeatured)}</div>
      </div>
    )
  }

  const monthlyEquivalent = Math.round(plan.price_cents / 12)
  const renewalCents = plan.renewal_price_cents ?? plan.price_cents

  // La insignia de ahorro compara contra bases distintas según el tipo de plan: una oferta
  // por tiempo limitado (ej. "Fundador") ya es un precio rebajado del plan Normal anual —
  // ahorras la diferencia contra lo que pagarías al renovar (renewalCents), no contra pagar
  // mes a mes. Un plan Normal anual, en cambio, sí compite contra pagar mes a mes todo el
  // año (normalMatch × 12) — esa es la razón real para elegir anual sobre mensual.
  let savingsBadge = null
  if (plan.promo_label) {
    const savedCents = renewalCents - plan.price_cents
    if (savedCents > 0) {
      const pct = Math.round((savedCents / renewalCents) * 100)
      savingsBadge = `Ahorra ${formatSoles(savedCents)} al año · ${pct}%`
    }
  } else if (normalMatch) {
    const savedCents = normalMatch.price_cents * 12 - plan.price_cents
    if (savedCents > 0) {
      const pct = Math.round((savedCents / (normalMatch.price_cents * 12)) * 100)
      savingsBadge = `Ahorra ${formatSoles(savedCents)} al año · ${pct}%`
    }
  }

  return (
    <div className="pricing-price-rows">
      {savingsBadge && <span className="pricing-savings-badge">{savingsBadge}</span>}
      <div className="pricing-price-row">
        <span className="pricing-price">{formatSoles(monthlyEquivalent)}</span>
        <span className="plan-card-price-period">/mes</span>
      </div>
      {plan.available_until && (
        <p className="pricing-deadline-note">Disponible hasta el {formatDeadline(plan.available_until)}</p>
      )}
      <p className="pricing-fine-print">
        Pagas {formatSoles(plan.price_cents)} hoy — pago único por 1 año.<br />
        Se renueva por {formatSoles(renewalCents)}/año.
      </p>
      {!plan.allows_discounts && (
        <p className="pricing-no-discount-note">No admite códigos de descuento.</p>
      )}
      <div className="pricing-cta">{renderPriceRow(plan, isFeatured)}</div>
    </div>
  )
}
