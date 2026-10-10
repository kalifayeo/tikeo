export interface OrderDetail {
  id: string
  order_number: string
  subtotal: number
  fees: number
  discount: number
  promo_code: string | null
  total: number
  currency: string
  status: 'pending' | 'paid' | 'cancelled' | 'refunded'
  expires_at: string | null
  event: { id: string; title: string; slug: string; cover_image: string | null; start_date: string; location_name: string | null; city: string | null; country: string | null } | null
  order_items: Array<{ id: string; quantity: number; unit_price: number; total: number; ticket_type: { name: string } | null }>
}

export type PaymentMethodId = 'wave' | 'orange' | 'mtn' | 'moov' | 'djamo'

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

export interface PaymentStart {
  /** redirect : Wave / Orange / Djamo (l'acheteur est envoyé chez son opérateur) ; ussd : MTN / Moov (demande de code sur le téléphone). */
  mode: 'redirect' | 'ussd'
  paymentUrl: string | null
  phoneMasked?: string
}

/**
 * Lance une tentative de paiement Jèko en « API direct » : la page de paiement
 * hébergée par Jèko n'est jamais affichée.
 *  - redirect (Wave / Orange / Djamo) : on envoie l'acheteur chez son opérateur ; il revient sur
 *    /commande/:id/retour (pages Tikeo) une fois le paiement fait ;
 *  - ussd (MTN / Moov) : rien à ouvrir, la page appelante affiche l'attente de confirmation.
 * Jèko confirme ensuite en arrière-plan, par webhook.
 */
export function useOrderPayment() {
  const submitting = ref(false)
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function payWith(orderId: string, method: PaymentMethodId, phone?: string): Promise<PaymentStart | null> {
    submitting.value = true
    errorCode.value = null
    try {
      const res = await $fetch<PaymentStart>(`/api/orders/${orderId}/pay`, {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
        body: { method, ...(phone ? { phone } : {}) },
      })
      if (res.mode === 'redirect' && res.paymentUrl && import.meta.client) window.location.href = res.paymentUrl
      return res
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      errorCode.value = e?.data?.data?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 401 ? 'SESSION_EXPIRED' : 'PAYMENT_INIT_FAILED')
      return null
    } finally {
      submitting.value = false
    }
  }

  /**
   * Récupère les billets d'une commande gratuite (total = 0) sans paiement :
   * appelle /api/orders/:id/claim-free (voir pages/commande/[id]/index.vue,
   * qui n'affiche pas de méthode de paiement pour ces commandes).
   * Retourne `true` en cas de succès (billets générés + email envoyé).
   */
  async function claimFree(orderId: string) {
    submitting.value = true
    errorCode.value = null
    try {
      await $fetch<{ order: { id: string }; ticketCount: number }>(`/api/orders/${orderId}/claim-free`, {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
      })
      return true
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      errorCode.value = e?.data?.data?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 401 ? 'SESSION_EXPIRED' : 'CONFIRM_FAILED')
      return false
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, payWith, claimFree }
}
