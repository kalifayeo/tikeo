export interface OrderDetail {
  id: string
  order_number: string
  subtotal: number
  fees: number
  total: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  expires_at: string | null
  event: { id: string; title: string; slug: string; cover_image: string | null; start_date: string; location_name: string | null; city: string | null; country: string | null } | null
  order_items: Array<{ id: string; quantity: number; unit_price: number; total: number; ticket_type: { name: string } | null }>
}

export type PaymentMethodId = 'wave' | 'mobile_money' | 'djamo' | 'card'

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Charge le détail d'une commande (page récapitulatif/paiement et écran de retour). */
export function useOrderDetail(orderId: string) {
  const { data, pending, error, refresh } = useAsyncData<{ order: OrderDetail }>(`order-detail:${orderId}`, async () => {
    return await $fetch<{ order: OrderDetail }>(`/api/orders/${orderId}`, { headers: await authHeaders() })
  })

  const order = computed(() => data.value?.order ?? null)
  const errorCode = computed<string | null>(() => (error.value as any)?.data?.data?.code ?? null)

  return { order, loading: pending, errorCode, refresh: () => refresh() }
}

/** Lance une tentative de paiement CinetPay et redirige vers la page de paiement. */
export function useOrderPayment() {
  const submitting = ref(false)
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function payWith(orderId: string, method: PaymentMethodId) {
    submitting.value = true
    errorCode.value = null
    try {
      const res = await $fetch<{ paymentUrl: string }>(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
        body: { method },
      })
      if (import.meta.client) window.location.href = res.paymentUrl
      return res.paymentUrl
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      errorCode.value = e?.data?.data?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 401 ? 'SESSION_EXPIRED' : 'PAYMENT_INIT_FAILED')
      return null
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, payWith }
}
