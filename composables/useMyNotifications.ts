import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Notification } from '~/types/database'

/**
 * Notifications de l'utilisateur connecté, mises à jour EN DIRECT.
 *
 * - L'état est partagé (useState) : le header, la page Notifications, le
 *   tableau de bord... lisent exactement la même liste et le même compteur.
 * - Supabase Realtime pousse chaque nouvelle notification / lecture /
 *   suppression sans rechargement (migration 0044_realtime_live_updates.sql).
 * - Filet de sécurité : si le temps réel est indisponible (coupure, migration
 *   pas encore appliquée), la liste est relue silencieusement toutes les 30 s,
 *   au retour sur l'onglet et au retour du réseau.
 */
let channel: RealtimeChannel | null = null
let channelUserId: string | null = null
let fetchPromise: Promise<void> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let listenersBound = false
let refetchSilent: (() => void) | null = null

function onVisible() {
  if (document.visibilityState === 'visible') refetchSilent?.()
}
function onOnline() {
  refetchSilent?.()
}

function stopLive() {
  if (channel) {
    try {
      useSupabase().removeChannel(channel)
    } catch {
      /* déjà fermé */
    }
  }
  channel = null
  channelUserId = null
  if (pollTimer) clearInterval(pollTimer)
  pollTimer = null
  if (listenersBound && import.meta.client) {
    document.removeEventListener('visibilitychange', onVisible)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('focus', onOnline)
  }
  listenersBound = false
}

export function useMyNotifications() {
  const { user } = useAuth()
  const toast = useToast()
  const notifications = useState<Notification[]>('tikeo-notifications', () => [])
  const loading = useState('tikeo-notifications-loading', () => true)
  const loaded = useState('tikeo-notifications-loaded', () => false)
  const errorMessage = useState('tikeo-notifications-error', () => '')

  const unreadCount = computed(() => notifications.value.filter((n) => !n.read_at).length)

  /** Annonce (toast) les notifications non lues qu'on ne connaissait pas encore. */
  function announce(fresh: Notification[]) {
    if (!fresh.length) return
    if (fresh.length === 1) toast.info(fresh[0].title)
    else toast.info(`${fresh.length} nouvelles notifications`)
  }

  async function fetchNotifications(silent = false) {
    if (!user.value) {
      notifications.value = []
      loading.value = false
      loaded.value = false
      return
    }
    if (fetchPromise) return fetchPromise

    const run = (async () => {
      if (!silent) loading.value = true
      errorMessage.value = ''
      try {
        const supabase = useSupabase()
        const { data, error } = await supabase
          .from('notifications')
          .select('*')
          .eq('user_id', user.value!.id)
          .order('created_at', { ascending: false })
        if (error) throw error
        const list = (data as unknown as Notification[]) ?? []
        // Pas d'annonce au tout premier chargement : seulement pour les nouveautés.
        if (loaded.value) {
          const known = new Set(notifications.value.map((n) => n.id))
          announce(list.filter((n) => !known.has(n.id) && !n.read_at))
        }
        notifications.value = list
        loaded.value = true
      } catch (e: any) {
        // Une relecture silencieuse qui échoue ne doit jamais afficher d'erreur.
        if (!silent) errorMessage.value = e?.message || 'Impossible de charger vos notifications.'
      } finally {
        loading.value = false
        fetchPromise = null
      }
    })()
    fetchPromise = run
    return run
  }

  function receive(n: Notification, isNew: boolean) {
    const idx = notifications.value.findIndex((x) => x.id === n.id)
    if (idx === -1) {
      notifications.value = [n, ...notifications.value]
      if (isNew && !n.read_at) announce([n])
    } else {
      const copy = [...notifications.value]
      copy[idx] = { ...copy[idx], ...n }
      notifications.value = copy
    }
  }

  function startLive(userId: string) {
    if (!import.meta.client) return
    if (channel && channelUserId === userId) return
    stopLive()
    channelUserId = userId
    refetchSilent = () => {
      if (user.value) fetchNotifications(true)
    }
    const supabase = useSupabase()
    channel = supabase
      .channel(`live-notifications-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p: any) => receive(p.new as Notification, true))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, (p: any) => receive(p.new as Notification, false))
      // Supabase ne filtre pas les DELETE : on ne reçoit que l'id supprimé, retiré s'il est dans notre liste.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications' }, (p: any) => {
        const id = p.old?.id
        if (id) notifications.value = notifications.value.filter((n) => n.id !== id)
      })
      .subscribe((status: string) => {
        // À chaque (re)connexion on rattrape ce qui a pu être manqué.
        if (status === 'SUBSCRIBED') refetchSilent?.()
      })

    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refetchSilent?.()
    }, 30_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onOnline)
    listenersBound = true
  }

  async function markAsRead(id: string) {
    const target = notifications.value.find((n) => n.id === id)
    if (!target || target.read_at) return
    const previous = target.read_at
    notifications.value = notifications.value.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    const readAt = notifications.value.find((n) => n.id === id)!.read_at
    const supabase = useSupabase()
    const { error } = await supabase.from('notifications').update({ read_at: readAt }).eq('id', id)
    if (error) notifications.value = notifications.value.map((n) => (n.id === id ? { ...n, read_at: previous } : n))
  }

  async function markAllAsRead() {
    const unread = notifications.value.filter((n) => !n.read_at)
    if (unread.length === 0) return
    const now = new Date().toISOString()
    const ids = unread.map((n) => n.id)
    const before = notifications.value
    notifications.value = before.map((n) => (ids.includes(n.id) ? { ...n, read_at: now } : n))
    const supabase = useSupabase()
    const { error } = await supabase.from('notifications').update({ read_at: now }).in('id', ids)
    if (error) notifications.value = before
  }

  /** Supprime une notification (vraie suppression : la policy « Notifications personnelles » couvre aussi delete). */
  async function deleteNotification(id: string) {
    const before = notifications.value
    if (!before.some((n) => n.id === id)) return true
    notifications.value = before.filter((n) => n.id !== id)
    const supabase = useSupabase()
    const { error } = await supabase.from('notifications').delete().eq('id', id)
    if (error) {
      notifications.value = before
      return false
    }
    return true
  }

  async function deleteAllNotifications() {
    if (!user.value || notifications.value.length === 0) return true
    const before = notifications.value
    notifications.value = []
    const supabase = useSupabase()
    const { error } = await supabase.from('notifications').delete().eq('user_id', user.value.id)
    if (error) {
      notifications.value = before
      return false
    }
    return true
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) {
          if (!loaded.value) fetchNotifications()
          startLive(u.id)
        } else {
          notifications.value = []
          loading.value = false
          loaded.value = false
          fetchPromise = null
          stopLive()
        }
      },
      { immediate: true }
    )
  }

  return { notifications, loading, errorMessage, unreadCount, fetchNotifications, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications }
}
