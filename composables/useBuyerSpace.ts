import type { OrderWithDetails, TicketWithDetails } from '~/types/database'

/**
 * « Supprimer » un billet ou une commande de l'historique de l'acheteur =
 * le masquer (route serveur /api/account/hide-items, colonne
 * hidden_by_user_at de la migration 0038). La ligne reste en base pour
 * l'organisateur, l'admin et le scan à l'entrée.
 */
async function hideOnServer(kind: 'ticket' | 'order', ids: string[]): Promise<boolean> {
  if (!ids.length) return true
  try {
    const supabase = useSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const { csrfHeader } = useCsrf()
    await $fetch('/api/account/hide-items', {
      method: 'POST',
      headers: {
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        ...(await csrfHeader()),
      },
      body: { kind, ids },
    })
    return true
  } catch {
    return false
  }
}

/**
 * Commandes de l'acheteur connecté (mon-espace/mes-commandes), avec
 * l'événement et les lignes de commande jointes pour l'affichage.
 * RLS : policy "Acheteur voit ses commandes" (0001_init.sql) — chacun ne
 * voit que ses propres lignes, la jointure côté Supabase respecte les
 * policies des tables liées.
 */
export function useMyOrders() {
  const { user } = useAuth()
  const orders = ref<OrderWithDetails[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  async function fetchOrders() {
    if (!user.value) {
      orders.value = []
      loading.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('orders')
        .select(
          '*, event:events(id, title, slug, cover_image, start_date, city), items:order_items(*, ticket_type:ticket_types(id, name))'
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Les commandes masquées par l'acheteur (migration 0038) n'apparaissent plus.
      orders.value = ((data as unknown as OrderWithDetails[]) ?? []).filter((o) => !o.hidden_by_user_at)
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger vos commandes.'
    } finally {
      loading.value = false
    }
  }

  /** Supprime des commandes de l'historique (masquage). Les commandes en attente de paiement sont refusées par le serveur. */
  async function hideOrders(ids: string[]) {
    const ok = await hideOnServer('order', ids)
    if (ok) orders.value = orders.value.filter((o) => !ids.includes(o.id))
    return ok
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) fetchOrders()
        else {
          orders.value = []
          loading.value = false
        }
      },
      { immediate: true }
    )
  }

  return { orders, loading, errorMessage, fetchOrders, hideOrders }
}

/**
 * Billets numériques de l'acheteur connecté (mon-espace/mes-billets).
 * Reste vide tant que le paiement en ligne n'est pas branché : les billets
 * ne sont générés qu'après confirmation réelle du paiement (§25 du cahier
 * des charges — "Le ticket ne doit être généré comme valide qu'après
 * confirmation réelle du paiement"). Ce n'est pas un bug, la page l'explique.
 */
/**
 * Billets numériques de l'acheteur connecté (mon-espace/mes-billets).
 * Reste vide tant que le paiement en ligne n'est pas branché : les billets
 * ne sont générés qu'après confirmation réelle du paiement (§25 du cahier
 * des charges — "Le ticket ne doit être généré comme valide qu'après
 * confirmation réelle du paiement"). Ce n'est pas un bug, la page l'explique.
 *
 * BILLETS HORS CONNEXION : la dernière liste chargée avec succès est mise en
 * cache dans le stockage local du navigateur (une copie par compte). En cas
 * d'échec réseau (mode avion, salle sans couverture à l'entrée d'un
 * événement...), cette copie est utilisée à la place et `isOffline` passe à
 * `true` pour que l'interface l'indique clairement. Le rendu du QR code lui-
 * même ne dépend d'aucun réseau (généré localement depuis `qr_token`, voir
 * useTicketQr.ts) : c'est la liste des billets qui a besoin de ce filet.
 */
const TICKETS_CACHE_PREFIX = 'tikeo:offline-tickets:'

function ticketsCacheKey(userId: string) {
  return `${TICKETS_CACHE_PREFIX}${userId}`
}

function readTicketsCache(userId: string): TicketWithDetails[] | null {
  if (!import.meta.client) return null
  try {
    const raw = window.localStorage.getItem(ticketsCacheKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed?.tickets) ? (parsed.tickets as TicketWithDetails[]).filter((tk) => !tk.hidden_by_user_at) : null
  } catch {
    return null
  }
}

function writeTicketsCache(userId: string, tickets: TicketWithDetails[]) {
  if (!import.meta.client) return
  try {
    window.localStorage.setItem(ticketsCacheKey(userId), JSON.stringify({ tickets, cachedAt: new Date().toISOString() }))
  } catch {
    // Quota dépassé ou stockage désactivé : tant pis pour le mode hors ligne, le reste continue de fonctionner.
  }
}

export function useMyTickets() {
  const { user } = useAuth()
  const tickets = ref<TicketWithDetails[]>([])
  const loading = ref(true)
  const errorMessage = ref('')
  const isOffline = ref(false)
  const cachedAt = ref<string | null>(null)

  async function fetchTickets() {
    if (!user.value) {
      tickets.value = []
      loading.value = false
      isOffline.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('tickets')
        .select(
          '*, event:events(id, title, slug, cover_image, start_date, city, location_name), ticket_type:ticket_types(id, name, price), order:orders(order_number)'
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      // Les billets masqués par l'acheteur (migration 0038) n'apparaissent plus (ni dans la copie hors ligne).
      tickets.value = ((data as unknown as TicketWithDetails[]) ?? []).filter((tk) => !tk.hidden_by_user_at)
      isOffline.value = false
      writeTicketsCache(user.value.id, tickets.value)
    } catch (e: any) {
      const cached = readTicketsCache(user.value.id)
      if (cached) {
        tickets.value = cached
        isOffline.value = true
        try {
          const raw = window.localStorage.getItem(ticketsCacheKey(user.value.id))
          cachedAt.value = raw ? JSON.parse(raw)?.cachedAt ?? null : null
        } catch {
          cachedAt.value = null
        }
      } else {
        errorMessage.value = e?.message || 'Impossible de charger vos billets.'
      }
    } finally {
      loading.value = false
    }
  }

  /** Supprime des billets de l'historique (masquage) : ils restent valides côté organisateur. */
  async function hideTickets(ids: string[]) {
    const ok = await hideOnServer('ticket', ids)
    if (ok) {
      tickets.value = tickets.value.filter((tk) => !ids.includes(tk.id))
      // Garde la copie hors ligne synchronisée avec la liste affichée.
      if (user.value && !isOffline.value) writeTicketsCache(user.value.id, tickets.value)
    }
    return ok
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) fetchTickets()
        else {
          tickets.value = []
          loading.value = false
          isOffline.value = false
        }
      },
      { immediate: true }
    )
  }

  return { tickets, loading, errorMessage, isOffline, cachedAt, fetchTickets, hideTickets }
}
