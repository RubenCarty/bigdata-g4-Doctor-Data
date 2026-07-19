import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { billingApi } from '../services/api'
import PricingTable from './PricingTable'

const PENDING_KEY = 'dd_pending_checkout'

function formatSoles(cents) {
  return `S/ ${(cents / 100).toFixed(2)}`
}

// PlanPicker es la lógica de selección de planes + código de descuento + inicio de
// checkout, compartida entre la página pública /pricing y el paso 2 del registro.
//
// Si el usuario no tiene sesión, "Continuar" guarda la selección en sessionStorage y
// redirige a /register; si ya tiene sesión, inicia el checkout directamente.
export default function PlanPicker({ onCheckout }) {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState({})
  const [discountCode, setDiscountCode] = useState('')
  const [discountPreview, setDiscountPreview] = useState(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    billingApi.listPlans()
      .then((r) => setPlans(r.data ?? []))
      .catch(() => setError('No se pudieron cargar los planes.'))
      .finally(() => setLoading(false))

    const pending = sessionStorage.getItem(PENDING_KEY)
    if (pending) {
      try {
        const { quantities: q, discountCode: c } = JSON.parse(pending)
        if (q) setQuantities(q)
        if (c) setDiscountCode(c)
      } catch { /* ignore malformed stash */ }
      sessionStorage.removeItem(PENDING_KEY)
    }
  }, [])

  const items = useMemo(
    () => Object.entries(quantities)
      .filter(([, qty]) => qty > 0)
      .map(([plan_id, quantity]) => ({ plan_id, quantity })),
    [quantities]
  )

  const subtotalCents = useMemo(() => {
    return items.reduce((sum, item) => {
      const plan = plans.find((p) => p.id === item.plan_id)
      return sum + (plan ? plan.price_cents * item.quantity : 0)
    }, 0)
  }, [items, plans])

  const checkDiscount = useCallback(() => {
    if (!discountCode.trim() || items.length === 0) {
      setDiscountPreview(null)
      return
    }
    setCheckingCode(true)
    billingApi.previewDiscount(discountCode.trim(), items)
      .then((r) => setDiscountPreview(r.data))
      .catch(() => setDiscountPreview({ valid: false }))
      .finally(() => setCheckingCode(false))
  }, [discountCode, items])

  useEffect(() => {
    const t = setTimeout(checkDiscount, 400)
    return () => clearTimeout(t)
  }, [checkDiscount])

  function setQuantity(planId, qty) {
    setQuantities((q) => ({ ...q, [planId]: qty }))
  }

  async function handleContinue() {
    setError('')
    if (items.length === 0) {
      setError('Elige al menos un plan para continuar.')
      return
    }

    if (!user) {
      sessionStorage.setItem(PENDING_KEY, JSON.stringify({ quantities, discountCode }))
      navigate('/register')
      return
    }

    setSubmitting(true)
    try {
      const code = discountPreview?.valid ? discountCode.trim() : undefined
      const res = await billingApi.createCheckout(items, code)
      onCheckout?.(res.data)
    } catch (err) {
      const code = err.response?.data?.error
      setError(
        code === 'code_not_applicable_to_selected_plans'
          ? 'El código de descuento ya no aplica a los planes elegidos.'
          : code === 'discount_code_already_used'
          ? 'Ya usaste este código de descuento en una compra anterior — no se puede volver a aplicar.'
          : code || 'No se pudo iniciar el pago.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="loading">Cargando planes...</div>

  const finalCents = discountPreview?.valid
    ? discountPreview.final_amount_cents
    : subtotalCents

  return (
    <div>
      {error && <div className="alert alert-error">{error}</div>}

      <PricingTable
        plans={plans}
        renderPriceRow={(plan) => (
          <div className="plan-card-stepper">
            <button
              type="button"
              className="btn btn-outline plan-card-stepper-btn"
              onClick={() => setQuantity(plan.id, Math.max(0, (quantities[plan.id] ?? 0) - 1))}
              disabled={!(quantities[plan.id] > 0)}
            >
              −
            </button>
            <span className="plan-card-stepper-count">{quantities[plan.id] ?? 0}</span>
            <button
              type="button"
              className="btn btn-outline plan-card-stepper-btn"
              onClick={() => setQuantity(plan.id, (quantities[plan.id] ?? 0) + 1)}
            >
              +
            </button>
          </div>
        )}
      />

      <div className="form-group" style={{ marginTop: '1.5rem', maxWidth: 320 }}>
        <label htmlFor="discount_code">Código de descuento (opcional)</label>
        <input
          id="discount_code"
          type="text"
          value={discountCode}
          onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
          placeholder="Ej: AUTONOMA26"
        />
        {checkingCode && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Verificando...</span>}
        {!checkingCode && discountPreview && discountCode && (
          discountPreview.valid
            ? <span style={{ fontSize: '0.78rem', color: 'var(--green-dark)' }}>Código válido — ahorras {formatSoles(discountPreview.discount_amount_cents)}</span>
            : <span style={{ fontSize: '0.78rem', color: '#dc2626' }}>
                {discountPreview.error === 'code_not_applicable_to_selected_plans'
                  ? 'Este código no aplica a los planes elegidos (las ofertas por tiempo limitado no admiten descuentos)'
                  : discountPreview.error === 'discount_code_already_used'
                  ? 'Ya usaste este código de descuento en una compra anterior — no se puede volver a aplicar.'
                  : 'Código inválido o expirado'}
              </span>
        )}
      </div>

      {items.length > 0 && (
        <div className="summary-card" style={{ alignItems: 'flex-start', marginTop: '1.25rem', width: 'fit-content' }}>
          <span className="summary-label">Total a pagar</span>
          <span className="summary-number">{formatSoles(finalCents)}</span>
        </div>
      )}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: '1.5rem' }}
        onClick={handleContinue}
        disabled={submitting}
      >
        {submitting ? 'Procesando...' : 'Continuar al pago'}
      </button>
    </div>
  )
}
