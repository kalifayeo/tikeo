import type { EventDetailData, TicketTypeOption } from '~/types/database'

function mapDetail(e: any): EventDetailData {
  const ticketTypes: TicketTypeOption[] = (e.ticket_types ?? [])
    // Même règle que create_order() en base : seuls les types « active » sont vendables.
    .filter((tt: any) => (tt.status ?? 'active') === 'active')
    .map((tt: any) => {
      const remaining = tt.quantity != null ? Math.max(0, Number(tt.quantity) - Number(tt.sold_quantity ?? 0)) : null
      return {
        id: tt.id,
        name: tt.name,
        description: tt.description,
        price: Number(tt.price) || 0,
        remaining,
        soldOut: remaining !== null && remaining <= 0,
      }
    })
    .sort((a: TicketTypeOption, b: TicketTypeOption) => a.price - b.price)

  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    city: e.city ?? '',
    country: e.country ?? '',
    locationName: e.location_name,
    address: e.address,
    startDate: e.start_date,
    endDate: e.end_date,
    coverImage: e.cover_image || '/sample-event.jpg',
    category: e.category?.name,
    seatingPlanUrl: e.seating_plan_url || null,
    organizerId: e.organizer_id,
    organizerName: e.organizer?.name,
    organizerLogo: e.organizer?.logo_url,
    organizerDescription: e.organizer?.description,
    verified: e.organizer?.status === 'approved',
    ticketTypes,
  }
}

/**
 * Événement publié, détail complet pour la page /e/[slug] — billetterie,
 * description, organisateur.
 *
 * Chargé via GET /api/events/:slug (server/api/events/[slug].get.ts) avec
 * useAsyncData : la page est donc RENDUE CÔTÉ SERVEUR avec ses vraies données
 * (titre, image Open Graph, JSON-LD…). C'est indispensable pour que Google,
 * WhatsApp et Facebook affichent le bon aperçu quand on partage
 * himra.tikeo.com — le client Supabase, lui, n'existe que dans le navigateur.
 */
export function useEventDetail(slug: string) {
  // Côté serveur, on garde l'objet requête pour répondre un vrai code HTTP 404
  // quand l'événement n'existe pas (sinon Google indexerait une « soft 404 »).
  const requestEvent = import.meta.server ? useRequestEvent() : undefined

  const { data, pending, error: asyncError, refresh } = useAsyncData<{ row: any | null }>(
    `event-detail:${slug}`,
    async () => {
      try {
        const row = await $fetch<any>(`/api/events/${encodeURIComponent(slug)}`)
        return { row }
      } catch (e: any) {
        const status = e?.statusCode ?? e?.status ?? e?.response?.status
        if (status === 404) {
          if (requestEvent) setResponseStatus(requestEvent, 404)
          return { row: null }
        }
        throw e
      }
    }
  )

  const event = computed<EventDetailData | null>(() => (data.value?.row ? mapDetail(data.value.row) : null))
  const loading = computed(() => pending.value && !data.value)
  const notFound = computed(() => !!data.value && data.value.row === null)
  const error = computed<string | null>(() =>
    asyncError.value ? asyncError.value.message || "Erreur de chargement de l'événement" : null
  )

  return { event, loading, notFound, error, refresh: () => refresh() }
}

export interface CartLine {
  ticketTypeId: string
  name: string
  unitPrice: number
  quantity: number
}

/**
 * Création de commande (statut `pending`) depuis la page événement.
 *
 * La commande n'est PLUS écrite directement depuis le navigateur : on appelle
 * POST /api/orders, qui vérifie la session, relit les prix et le stock en base
 * et réserve les billets de façon atomique (cahier des charges §49 et §64).
 * On n'envoie donc que { eventId, items: [{ ticketTypeId, quantity }] } :
 * ni prix, ni total, ni statut, ni identifiant utilisateur.
 *
 * Le paiement en ligne n'est pas encore branché (§24-26) : la commande reste
 * `pending` et retient son stock 15 minutes (voir migration 0017).
 */
export interface CreatedOrder {
  id: string
  order_number: string
  subtotal: number
  fees: number
  total: number
  currency: string
  status: string
  expires_at: string
}

export function useEventOrder() {
  const submitting = ref(false)
  /** Code d'erreur (ex. « SOLD_OUT ») → traduit via `event.orderErrors.<code>` par la page. */
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function createOrder(eventId: string, lines: CartLine[]): Promise<CreatedOrder | null> {
    submitting.value = true
    errorCode.value = null
    try {
      const supabase = useSupabase()
      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session?.access_token) {
        errorCode.value = 'SESSION_EXPIRED'
        return null
      }

      const res = await $fetch<{ order: CreatedOrder }>('/api/orders', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          ...(await csrfHeader()),
        },
        body: {
          eventId,
          items: lines.map((l) => ({ ticketTypeId: l.ticketTypeId, quantity: l.quantity })),
        },
      })
      return res.order
    } catch (e: any) {
      const status = e?.statusCode ?? e?.status ?? e?.response?.status
      errorCode.value = e?.data?.data?.code ?? (status === 429 ? 'RATE_LIMITED' : status === 401 ? 'SESSION_EXPIRED' : 'ORDER_FAILED')
      return null
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, createOrder }
}
