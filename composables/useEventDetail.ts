import type { EventDetailData, TicketTypeOption } from '~/types/database'

const EVENT_DETAIL_SELECT = `id, slug, title, description, city, country, location_name, address,
  start_date, end_date, cover_image, organizer_id, seating_plan_url,
  category:categories(name),
  organizer:organizers(name, logo_url, description, status),
  ticket_types(id, name, description, price, quantity, sold_quantity, status)`

function mapDetail(e: any): EventDetailData {
  const ticketTypes: TicketTypeOption[] = (e.ticket_types ?? [])
    .filter((tt: any) => tt.status !== 'archived')
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
 * description, organisateur. Utilisé côté client uniquement (le client
 * Supabase ne vit que dans le navigateur, voir plugins/supabase.client.ts).
 */
export function useEventDetail(slug: string) {
  const event = ref<EventDetailData | null>(null)
  const loading = ref(true)
  const notFound = ref(false)
  const error = ref<string | null>(null)

  async function fetchEvent() {
    loading.value = true
    notFound.value = false
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('events')
        .select(EVENT_DETAIL_SELECT)
        .eq('slug', slug)
        .eq('status', 'published')
        .maybeSingle()

      if (sbError) throw sbError
      if (!data) {
        notFound.value = true
        event.value = null
        return
      }
      event.value = mapDetail(data)
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Erreur de chargement de l'événement"
      event.value = null
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    onMounted(fetchEvent)
  }

  return { event, loading, notFound, error, refresh: fetchEvent }
}

export interface CartLine {
  ticketTypeId: string
  name: string
  unitPrice: number
  quantity: number
}

function generateOrderNumber() {
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `TIK-${Date.now().toString(36).toUpperCase()}-${rand}`
}

/**
 * Création de commande (statut `pending`) depuis la page événement. Le
 * paiement en ligne n'est pas encore branché (cf. cahier des charges,
 * étape ultérieure) : on enregistre la commande + ses lignes, ce qui
 * suffit pour que l'organisateur et l'acheteur la retrouvent ensuite.
 */
export function useEventOrder() {
  const submitting = ref(false)
  const error = ref<string | null>(null)

  async function createOrder(eventId: string, userId: string, lines: CartLine[]) {
    submitting.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0)

      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          user_id: userId,
          event_id: eventId,
          order_number: generateOrderNumber(),
          subtotal,
          fees: 0,
          total: subtotal,
          currency: 'XOF',
          status: 'pending',
        })
        .select('*')
        .single()

      if (orderError) throw orderError

      const items = lines.map((l) => ({
        order_id: order.id,
        ticket_type_id: l.ticketTypeId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        total: l.unitPrice * l.quantity,
      }))

      const { error: itemsError } = await supabase.from('order_items').insert(items)
      if (itemsError) throw itemsError

      return order
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur lors de la création de la commande'
      return null
    } finally {
      submitting.value = false
    }
  }

  return { submitting, error, createOrder }
}
