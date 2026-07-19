import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
  TextInput, ActivityIndicator, Linking, Alert,
} from 'react-native'
import { billingApi } from '../services/api'
import Screen from '../components/Screen'

function soles(cents) {
  return `S/ ${(cents / 100).toFixed(2)}`
}

// URL pública que sirve la web (mismo dominio de QA) — el widget de pago de Izipay (Krypton)
// corre en el DOM de un navegador, no se puede ejecutar nativo sin agregar una dependencia
// nueva (WebView); en vez de eso se abre en el navegador del sistema, reusando el mismo
// checkout que ya funciona en la web (ver IzipayCheckout.jsx, que ahora también lee estos
// parámetros desde la URL, no solo desde location.state).
const CHECKOUT_BASE_URL = 'https://qa.mydoctordata.net/checkout/izipay'

export default function PricingScreen({ navigation }) {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [quantities, setQuantities] = useState({})
  const [discountCode, setDiscountCode] = useState('')
  const [discountPreview, setDiscountPreview] = useState(null)
  const [checkingCode, setCheckingCode] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const baselineCapacityRef = useRef(0)
  const pollRef = useRef(null)

  useEffect(() => {
    billingApi.listPlans()
      .then((r) => setPlans(r.data ?? []))
      .catch(() => setError('No se pudieron cargar los planes.'))
      .finally(() => setLoading(false))
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
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
    setQuantities((q) => ({ ...q, [planId]: Math.max(0, qty) }))
  }

  async function startConfirmPolling() {
    const before = await billingApi.getMyCapacity().then((r) => r.data.total_capacity).catch(() => 0)
    baselineCapacityRef.current = before
    setConfirming(true)
    pollRef.current = setInterval(checkPaymentConfirmed, 3000)
  }

  async function checkPaymentConfirmed() {
    try {
      const r = await billingApi.getMyCapacity()
      if (r.data.total_capacity > baselineCapacityRef.current) {
        clearInterval(pollRef.current)
        setConfirming(false)
        Alert.alert('¡Listo!', 'Tu suscripción ya está activa.', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ])
      }
    } catch { /* reintenta en el próximo tick */ }
  }

  async function handleContinue() {
    setError('')
    if (items.length === 0) {
      setError('Elige al menos un plan para continuar.')
      return
    }
    setSubmitting(true)
    try {
      const code = discountPreview?.valid ? discountCode.trim() : undefined
      const res = await billingApi.createCheckout(items, code)
      if (res.data.already_paid) {
        Alert.alert('¡Listo!', 'Tu suscripción ya está activa (descuento del 100%).', [
          { text: 'OK', onPress: () => navigation.navigate('Home') },
        ])
      } else if (res.data.form_token) {
        const url = `${CHECKOUT_BASE_URL}?formToken=${encodeURIComponent(res.data.form_token)}&publicKey=${encodeURIComponent(res.data.public_key)}`
        await Linking.openURL(url)
        startConfirmPolling()
      } else if (res.data.checkout_url) {
        await Linking.openURL(res.data.checkout_url)
        startConfirmPolling()
      }
    } catch (err) {
      const code = err.response?.data?.error
      setError(
        code === 'code_not_applicable_to_selected_plans'
          ? 'El código de descuento ya no aplica a los planes elegidos.'
          : code === 'discount_code_already_used'
          ? 'Ya usaste este código de descuento en una compra anterior.'
          : code || 'No se pudo iniciar el pago.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#16a34a" /></View>
  }

  if (confirming) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color="#16a34a" />
        <Text style={s.confirmingText}>Confirmando tu pago...{'\n'}Esto puede tardar unos segundos.</Text>
        <Text style={s.confirmingHint}>Completa el pago en el navegador y vuelve acá — se confirma solo.</Text>
        <TouchableOpacity style={s.linkBtn} onPress={() => { clearInterval(pollRef.current); setConfirming(false) }}>
          <Text style={s.linkBtnText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    )
  }

  const finalCents = discountPreview?.valid ? discountPreview.final_amount_cents : subtotalCents

  return (
    <Screen>
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {error ? <Text style={s.error}>{error}</Text> : null}

      {plans.map((plan) => (
        <View key={plan.id} style={s.planCard}>
          <View style={{ flex: 1 }}>
            <Text style={s.planName}>{plan.name}</Text>
            {plan.promo_label ? <Text style={s.planPromo}>{plan.promo_label}</Text> : null}
            <Text style={s.planPrice}>{soles(plan.price_cents)} / {plan.billing_period === 'annual' ? 'año' : 'mes'}</Text>
            <Text style={s.planCapacity}>Cubre {plan.covered_capacity} persona{plan.covered_capacity !== 1 ? 's' : ''}</Text>
          </View>
          <View style={s.stepper}>
            <TouchableOpacity style={s.stepperBtn} onPress={() => setQuantity(plan.id, (quantities[plan.id] ?? 0) - 1)}
              disabled={!(quantities[plan.id] > 0)}>
              <Text style={s.stepperBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={s.stepperCount}>{quantities[plan.id] ?? 0}</Text>
            <TouchableOpacity style={s.stepperBtn} onPress={() => setQuantity(plan.id, (quantities[plan.id] ?? 0) + 1)}>
              <Text style={s.stepperBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      ))}

      <Text style={s.label}>Código de descuento (opcional)</Text>
      <TextInput
        style={s.input}
        value={discountCode}
        onChangeText={(v) => setDiscountCode(v.toUpperCase())}
        placeholder="Ej: AUTONOMA26"
        autoCapitalize="characters"
      />
      {checkingCode && <Text style={s.hint}>Verificando...</Text>}
      {!checkingCode && discountPreview && discountCode ? (
        discountPreview.valid
          ? <Text style={s.hintOk}>Código válido — ahorras {soles(discountPreview.discount_amount_cents)}</Text>
          : <Text style={s.hintError}>Código inválido, expirado o ya usado</Text>
      ) : null}

      {items.length > 0 && (
        <View style={s.summary}>
          <Text style={s.summaryLabel}>Total a pagar</Text>
          <Text style={s.summaryNumber}>{soles(finalCents)}</Text>
        </View>
      )}

      <TouchableOpacity style={[s.btn, submitting && s.btnDisabled]} onPress={handleContinue} disabled={submitting}>
        {submitting ? <ActivityIndicator color="white" /> : <Text style={s.btnText}>Continuar al pago</Text>}
      </TouchableOpacity>
    </ScrollView>
    </Screen>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
  confirmingText: { textAlign: 'center', fontSize: 15, color: '#374151', marginTop: 16, lineHeight: 22 },
  confirmingHint: { textAlign: 'center', fontSize: 12, color: '#9ca3af', marginTop: 8 },
  linkBtn: { marginTop: 20 },
  linkBtnText: { color: '#2563eb', fontSize: 14 },
  error: { backgroundColor: '#fef2f2', color: '#dc2626', padding: 12, borderRadius: 8, marginBottom: 12, fontSize: 14 },
  planCard: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: 'white',
    borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, marginBottom: 10, gap: 10,
  },
  planName: { fontSize: 15, fontWeight: '700', color: '#111827' },
  planPromo: { fontSize: 11, fontWeight: '700', color: '#d97706', marginTop: 2 },
  planPrice: { fontSize: 14, color: '#16a34a', fontWeight: '600', marginTop: 4 },
  planCapacity: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepperBtn: { width: 32, height: 32, borderRadius: 6, borderWidth: 1, borderColor: '#16a34a', justifyContent: 'center', alignItems: 'center' },
  stepperBtnText: { fontSize: 18, color: '#16a34a', fontWeight: '600' },
  stepperCount: { fontSize: 16, fontWeight: '700', color: '#111827', minWidth: 20, textAlign: 'center' },
  label: { fontSize: 13, fontWeight: '500', color: '#374151', marginTop: 16, marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111827', backgroundColor: 'white' },
  hint: { fontSize: 12, color: '#6b7280', marginTop: 6 },
  hintOk: { fontSize: 12, color: '#15803d', marginTop: 6 },
  hintError: { fontSize: 12, color: '#dc2626', marginTop: 6 },
  summary: { backgroundColor: 'white', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', padding: 16, marginTop: 20, alignItems: 'flex-start' },
  summaryLabel: { fontSize: 12, color: '#6b7280' },
  summaryNumber: { fontSize: 22, fontWeight: '700', color: '#16a34a', marginTop: 4 },
  btn: { backgroundColor: '#16a34a', borderRadius: 10, padding: 15, alignItems: 'center', marginTop: 20 },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: 'white', fontSize: 16, fontWeight: '600' },
})
