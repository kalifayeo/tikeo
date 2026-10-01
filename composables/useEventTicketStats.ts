/**
 * Statistiques de vente d'un événement : billets vendus / réservés /
 * restants par type de billet + évolution jour par jour.
 *
 * Utilisé côté organisateur (/organisateur/evenements/[id]/statistiques) ET
 * côté admin (/admin/evenements/[id]/statistiques). Les droits de lecture
 * sont gérés par la RLS (0005 pour l'organisateur, 0004 + 0026 pour l'admin).
 *
 * Définitions :
 *  - vendus     = billets des commandes PAYÉES (status 'paid', gratuits inclus)
 *  - réservés   = billets en cours de paiement (sold_quantity - vendus) : le
 *                 stock est déjà décompté à la réservation, il est rendu si
 *                 la commande expire (release_expired_orders)
 *  - restants   = quantity - sold_quantity (= disponibles à la vente)
 */
import type { EventRecord } from '~/types/database'

export interface TicketTypeStat {
  id: string
  name: string
  price: number
  quantity: number
  sold: number
  reserved: number
  remaining: number
  revenue: number
}

export interface SalesPoint {
  /** YYYY-MM-DD */
  date: string
  /** Billets vendus ce jour-là */
  sold: number
  /** Total cumulé de billets vendus à la fin de ce jour */
  cumulative: number
}

export interface EventTicketStats {
  event: Pick<EventRecord, 'id' | 'title' | 'slug' | 'status' | 'max_tickets_per_buyer' | 'start_date'>
  types: TicketTypeStat[]
  totals: { quantity: number; sold: number; reserved: number; remaining: number; revenue: number; percentSold: number }
  timeline: SalesPoint[]
}

interface OrderRow {
  id: string
  status: string
  created_at: string
  order_items: { ticket_type_id: string; quantity: number }[] | null
}

const PAGE = 1000

export function useEventTicketStats() {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const stats = ref<EventTicketStats | null>(null)

  async function load(eventId: string) {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()

      const { data: event, error: evErr } = await supabase
        .from('events')
        .select('id, title, slug, status, max_tickets_per_buyer, start_date')
        .eq('id', eventId)
        .maybeSingle()
      if (evErr) throw evErr
      if (!event) throw new Error('NOT_FOUND')

      const { data: tts, error: ttErr } = await supabase
        .from('ticket_types')
        .select('id, name, price, quantity, sold_quantity')
        .eq('event_id', eventId)
        .order('created_at', { ascending: true })
      if (ttErr) throw ttErr

      // Commandes de l'événement (paginées : PostgREST plafonne à 1000 lignes).
      const orders: OrderRow[] = []
      for (let from = 0; ; from += PAGE) {
        const { data, error: oErr } = await supabase
          .from('orders')
          .select('id, status, created_at, order_items(ticket_type_id, quantity)')
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .range(from, from + PAGE - 1)
        if (oErr) throw oErr
        const rows = (data ?? []) as unknown as OrderRow[]
        orders.push(...rows)
        if (rows.length < PAGE) break
      }

      const paidByType = new Map<string, number>()
      const perDay = new Map<string, number>()
      for (const o of orders) {
        if (o.status !== 'paid') continue
        const day = o.created_at.slice(0, 10)
        for (const it of o.order_items ?? []) {
          paidByType.set(it.ticket_type_id, (paidByType.get(it.ticket_type_id) ?? 0) + it.quantity)
          perDay.set(day, (perDay.get(day) ?? 0) + it.quantity)
        }
      }

      const types: TicketTypeStat[] = (tts ?? []).map((t: any) => {
        const sold = paidByType.get(t.id) ?? 0
        const reserved = Math.max((t.sold_quantity ?? 0) - sold, 0)
        return {
          id: t.id,
          name: t.name,
          price: Number(t.price),
          quantity: t.quantity,
          sold,
          reserved,
          remaining: Math.max(t.quantity - (t.sold_quantity ?? 0), 0),
          revenue: sold * Number(t.price),
        }
      })

      const quantity = types.reduce((s, t) => s + t.quantity, 0)
      const sold = types.reduce((s, t) => s + t.sold, 0)
      const reserved = types.reduce((s, t) => s + t.reserved, 0)
      const remaining = types.reduce((s, t) => s + t.remaining, 0)
      const revenue = types.reduce((s, t) => s + t.revenue, 0)

      let cumulative = 0
      const timeline: SalesPoint[] = [...perDay.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, n]) => {
          cumulative += n
          return { date, sold: n, cumulative }
        })

      stats.value = {
        event: event as EventTicketStats['event'],
        types,
        totals: { quantity, sold, reserved, remaining, revenue, percentSold: quantity ? Math.round((sold / quantity) * 100) : 0 },
        timeline,
      }
    } catch (e: any) {
      console.error('[useEventTicketStats]', e)
      error.value = e?.message === 'NOT_FOUND' ? 'NOT_FOUND' : 'LOAD_FAILED'
    } finally {
      loading.value = false
    }
  }

  return { loading, error, stats, load }
}

/**
 * Export CSV des billets émis pour un événement (numéro, type, statut,
 * commande, dates de vente et de scan). Compatible Excel : séparateur « ; »
 * et BOM UTF-8 pour que les accents s'affichent correctement.
 * Les coordonnées des acheteurs ne sont volontairement pas incluses.
 */
export async function exportEventTicketsCsv(eventId: string, eventTitle: string) {
  const supabase = useSupabase()
  const PAGE_SIZE = 1000
  const rows: any[] = []
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('tickets')
      .select('ticket_number, status, used_at, created_at, ticket_type:ticket_types(name, price), order:orders(order_number)')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    rows.push(...((data as any[]) ?? []))
    if ((data?.length ?? 0) < PAGE_SIZE) break
  }

  // Neutralise l'injection de formules (=, +, -, @) à l'ouverture dans Excel.
  const cell = (v: unknown) => {
    let str = v === null || v === undefined ? '' : String(v)
    if (/^[=+\-@]/.test(str)) str = `'${str}`
    return `"${str.replace(/"/g, '""')}"`
  }
  const fmt = (iso?: string | null) => (iso ? new Date(iso).toLocaleString('fr-FR') : '')

  const header = ['Numéro de billet', 'Type de billet', 'Prix (FCFA)', 'Statut', 'Commande', 'Date de vente', 'Scanné le']
  const lines = rows.map((r) =>
    [r.ticket_number, r.ticket_type?.name, r.ticket_type?.price, r.status, r.order?.order_number, fmt(r.created_at), fmt(r.used_at)].map(cell).join(';')
  )
  const csv = '\uFEFF' + [header.map(cell).join(';'), ...lines].join('\r\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `billets-${eventTitle.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'evenement'}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return rows.length
}
