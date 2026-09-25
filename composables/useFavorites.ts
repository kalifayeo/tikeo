/**
 * La table `favorites` existe depuis la migration initiale (avec ses
 * policies RLS), mais aucun composant ne l'utilisait : le cœur sur les
 * cartes événement ne faisait que basculer un `ref` local, perdu au
 * rechargement. Ce composable branche enfin le bouton sur Supabase.
 *
 * Attention : ce composable est appelé par CHAQUE <EventCard> affichée.
 * L'état est donc partagé via useState, et le chargement initial est
 * dédupliqué (`fetchPromise`) pour éviter qu'une page affichant 20 cartes
 * ne déclenche 20 requêtes Supabase identiques au montage.
 */
// Requête de chargement en cours, partagée entre toutes les instances du
// composable. Volontairement hors de useState : une Promise n'est pas
// sérialisable dans le payload SSR de Nuxt.
let fetchPromise: Promise<void> | null = null

export function useFavorites() {
  const { user, isAuthenticated } = useAuth()
  const favoriteIds = useState<string[]>('tikeo-favorite-ids', () => [])
  /** false tant que la liste n'a pas été lue depuis Supabase : permet aux
   *  pages de distinguer « pas encore chargé » de « aucun favori ». */
  const loaded = useState('tikeo-favorites-loaded', () => false)

  async function fetchFavorites(force = false) {
    if (!user.value) return
    if (!force && fetchPromise) return fetchPromise

    const run = (async () => {
      const supabase = useSupabase()
      const { data, error } = await supabase.from('favorites').select('event_id').eq('user_id', user.value!.id)
      if (!error) {
        favoriteIds.value = (data ?? []).map((f: any) => f.event_id)
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

    // Mise à jour optimiste pour que le cœur réagisse immédiatement.
    favoriteIds.value = wasFavorite
      ? favoriteIds.value.filter((id) => id !== eventId)
      : [...favoriteIds.value, eventId]

    const { error } = wasFavorite
      ? await supabase.from('favorites').delete().eq('user_id', user.value.id).eq('event_id', eventId)
      : await supabase.from('favorites').insert({ user_id: user.value.id, event_id: eventId })

    // En cas d'échec réseau/RLS on revient à l'état précédent, sinon
    // l'interface afficherait un favori qui n'existe pas en base.
    if (error) favoriteIds.value = previous

    return true
  }

  if (import.meta.client) {
    watch(
      user,
      (u) => {
        if (u) {
          if (!loaded.value) fetchFavorites()
        } else {
          favoriteIds.value = []
          loaded.value = false
          fetchPromise = null
        }
      },
      { immediate: true }
    )
  }

  return { favoriteIds, loaded, isFavorite, toggleFavorite, fetchFavorites }
}
