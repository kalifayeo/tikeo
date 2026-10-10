import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Favoris de l'utilisateur connecté, synchronisés EN DIRECT.
 *
 * Ce composable est appelé par CHAQUE <EventCard> et par le header : l'état
 * est donc partagé via useState (un clic sur un cœur met à jour tout de
 * suite le compteur du header et les autres cartes), et le chargement initial
 * est dédupliqué (`fetchPromise`).
 *
 * Temps réel : un ajout / retrait fait depuis un autre onglet ou un autre
 * appareil apparaît sans recharger (migration 0044_realtime_live_updates.sql).
 * Filet de sécurité : relecture silencieuse au retour sur l'onglet, au retour
 * du réseau et toutes les 60 s.
 */
let fetchPromise: Promise<void> | null = null
let channel: RealtimeChannel | null = null
let channelUserId: string | null = null
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

export function useFavorites() {
  const { user, isAuthenticated } = useAuth()
  const favoriteIds = useState<string[]>('tikeo-favorite-ids', () => [])
  /** id de la ligne `favorites` → event_id (pour interpréter les suppressions temps réel, qui n'envoient que l'id). */
  const favoriteRows = useState<Record<string, string>>('tikeo-favorite-rows', () => ({}))
  /** false tant que la liste n'a pas été lue depuis Supabase : permet aux
   *  pages de distinguer « pas encore chargé » de « aucun favori ». */
  const loaded = useState('tikeo-favorites-loaded', () => false)
  /** Nombre de favoris : alimente la pastille du cœur dans le header. */
  const favoritesCount = computed(() => favoriteIds.value.length)

  async function fetchFavorites(force = false) {
    if (!user.value) return
    if (fetchPromise) return fetchPromise
    if (!force && loaded.value) return

    const run = (async () => {
      const supabase = useSupabase()
      const { data, error } = await supabase.from('favorites').select('id, event_id').eq('user_id', user.value!.id)
      if (!error) {
        const rows: Record<string, string> = {}
        for (const f of (data ?? []) as any[]) rows[f.id] = f.event_id
        favoriteRows.value = rows
        const next = (data ?? []).map((f: any) => f.event_id as string)
        // On évite de réassigner si rien n'a changé (pas de rendu inutile).
        const prev = favoriteIds.value
        if (next.length !== prev.length || next.some((id) => !prev.includes(id))) favoriteIds.value = next
      }
      // Même en cas d'erreur on marque le chargement comme terminé, sinon
      // les pages resteraient bloquées sur un squelette indéfiniment.
      loaded.value = true
      fetchPromise = null
    })()

    fetchPromise = run
    return run
  }

  function isFavorite(eventId: string) {
    return favoriteIds.value.includes(eventId)
  }

  /** Retourne false si l'utilisateur n'est pas connecté (l'appelant doit alors rediriger vers /connexion). */
  async function toggleFavorite(eventId: string): Promise<boolean> {
    if (!isAuthenticated.value || !user.value) return false

    const supabase = useSupabase()
    const wasFavorite = isFavorite(eventId)
    const previous = [...favoriteIds.value]
    const previousRows = { ...favoriteRows.value }

    // Mise à jour optimiste : le cœur ET le compteur du header réagissent immédiatement.
    favoriteIds.value = wasFavorite ? favoriteIds.value.filter((id) => id !== eventId) : [...favoriteIds.value, eventId]

    let failed = false
    if (wasFavorite) {
      const { error } = await supabase.from('favorites').delete().eq('user_id', user.value.id).eq('event_id', eventId)
      failed = !!error
      if (!error) {
        const rows = { ...favoriteRows.value }
        for (const [rid, eid] of Object.entries(rows)) if (eid === eventId) delete rows[rid]
        favoriteRows.value = rows
      }
    } else {
      const { data, error } = await supabase.from('favorites').insert({ user_id: user.value.id, event_id: eventId }).select('id').single()
      failed = !!error
      if (!error && (data as any)?.id) favoriteRows.value = { ...favoriteRows.value, [(data as any).id]: eventId }
    }

    // En cas d'échec réseau/RLS on revient à l'état précédent, sinon
    // l'interface afficherait un favori qui n'existe pas en base.
    if (failed) {
      favoriteIds.value = previous
      favoriteRows.value = previousRows
    }

    return true
  }

  function startLive(userId: string) {
    if (!import.meta.client) return
    if (channel && channelUserId === userId) return
    stopLive()
    channelUserId = userId
    refetchSilent = () => {
      if (user.value) fetchFavorites(true)
    }
    const supabase = useSupabase()
    channel = supabase
      .channel(`live-favorites-${userId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'favorites', filter: `user_id=eq.${userId}` }, (p: any) => {
        const row = p.new
        if (!row?.event_id) return
        favoriteRows.value = { ...favoriteRows.value, [row.id]: row.event_id }
        if (!favoriteIds.value.includes(row.event_id)) favoriteIds.value = [...favoriteIds.value, row.event_id]
      })
      // Supabase ne filtre pas les DELETE : on ne reçoit que l'id de la ligne ; on ne réagit que si c'est un des nôtres.
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'favorites' }, (p: any) => {
        const rowId = p.old?.id
        const eventId = rowId ? favoriteRows.value[rowId] : undefined
        if (!eventId) return
        const rows = { ...favoriteRows.value }
        delete rows[rowId]
        favoriteRows.value = rows
        favoriteIds.value = favoriteIds.value.filter((id) => id !== eventId)
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') refetchSilent?.()
      })

    pollTimer = setInterval(() => {
      if (document.visibilityState === 'visible') refetchSilent?.()
    }, 60_000)
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', onOnline)
    window.addEventListener('focus', onOnline)
    listenersBound = true
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) {
          if (!loaded.value) fetchFavorites()
          startLive(u.id)
        } else {
          favoriteIds.value = []
          favoriteRows.value = {}
          loaded.value = false
          fetchPromise = null
          stopLive()
        }
      },
      { immediate: true }
    )
  }

  return { favoriteIds, favoritesCount, loaded, isFavorite, toggleFavorite, fetchFavorites }
}
