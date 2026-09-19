import type { Notification, OrderWithDetails, TicketWithDetails } from '~/types/database'

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
      orders.value = (data as unknown as OrderWithDetails[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger vos commandes.'
    } finally {
      loading.value = false
    }
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

  return { orders, loading, errorMessage, fetchOrders }
}

/**
 * Billets numériques de l'acheteur connecté (mon-espace/mes-billets).
 * Reste vide tant que le paiement en ligne n'est pas branché : les billets
 * ne sont générés qu'après confirmation réelle du paiement (§25 du cahier
 * des charges — "Le ticket ne doit être généré comme valide qu'après
 * confirmation réelle du paiement"). Ce n'est pas un bug, la page l'explique.
 */
export function useMyTickets() {
  const { user } = useAuth()
  const tickets = ref<TicketWithDetails[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  async function fetchTickets() {
    if (!user.value) {
      tickets.value = []
      loading.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('tickets')
        .select(
          '*, event:events(id, title, slug, cover_image, start_date, city, location_name), ticket_type:ticket_types(id, name, price)'
        )
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      tickets.value = (data as unknown as TicketWithDetails[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger vos billets.'
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) fetchTickets()
        else {
          tickets.value = []
          loading.value = false
        }
      },
      { immediate: true }
    )
  }

  return { tickets, loading, errorMessage, fetchTickets }
}

/**
 * Notifications de l'acheteur connecté. La policy "Notifications
 * personnelles" (0001_init.sql) est en `for all`, donc l'utilisateur peut
 * aussi marquer ses propres notifications comme lues (update read_at).
 */
export function useMyNotifications() {
  const { user } = useAuth()
  const notifications = ref<Notification[]>([])
  const loading = ref(true)
  const errorMessage = ref('')

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read_at).length)

  async function fetchNotifications() {
    if (!user.value) {
      notifications.value = []
      loading.value = false
      return
    }
    loading.value = true
    errorMessage.value = ''
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.value.id)
        .order('created_at', { ascending: false })
      if (error) throw error
      notifications.value = (data as unknown as Notification[]) ?? []
    } catch (e: any) {
      errorMessage.value = e?.message || 'Impossible de charger vos notifications.'
    } finally {
      loading.value = false
    }
  }

  async function markAsRead(id: string) {
    const target = notifications.value.find((n) => n.id === id)
    if (!target || target.read_at) return
    const previous = target.read_at
    target.read_at = new Date().toISOString()
    const supabase = useSupabase()
    const { error } = await supabase.from('notifications').update({ read_at: target.read_at }).eq('id', id)
    if (error) target.read_at = previous
  }

  async function markAllAsRead() {
    const unread = notifications.value.filter((n) => !n.read_at)
    if (unread.length === 0) return
    const now = new Date().toISOString()
    const previousValues = unread.map((n) => n.read_at)
    unread.forEach((n) => (n.read_at = now))
    const supabase = useSupabase()
    const { error } = await supabase
      .from('notifications')
      .update({ read_at: now })
      .in(
        'id',
        unread.map((n) => n.id)
      )
    if (error) unread.forEach((n, i) => (n.read_at = previousValues[i]))
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) fetchNotifications()
        else {
          notifications.value = []
          loading.value = false
        }
      },
      { immediate: true }
    )
  }

  return { notifications, loading, errorMessage, unreadCount, fetchNotifications, markAsRead, markAllAsRead }
}
