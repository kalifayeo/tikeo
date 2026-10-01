import type { Organizer } from '~/types/database'

/**
 * Espace organisateur de l'utilisateur connecté (cahier des charges §8.3).
 * Si l'utilisateur n'a pas encore d'espace organisateur, on le crée
 * automatiquement — c'est le parcours décrit au §65 ("Créer un compte →
 * Créer événement").
 *
 * La création + la promotion de rôle passent par
 * /api/account/become-organizer (clé service_role côté serveur) plutôt que
 * par un insert/update direct depuis le client : le changement de rôle
 * (buyer -> organizer) est bloqué par le verrou de sécurité sur profiles.role
 * (migration 0021_admin_rbac_and_suspension_fix.sql) quand il vient d'une
 * session normale, ce verrou existant précisément pour empêcher qu'un
 * compte se donne lui-même un rôle admin/agent. Le serveur, lui, agit avec
 * la clé service_role qui contourne ce verrou légitimement.
 */
export function useOrganizer() {
  const supabase = useSupabase()
  const { user } = useAuth()
  const authStore = useAuthStore()

  const organizer = ref<Organizer | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchOrganizer() {
    if (!user.value) return null
    const { data } = await supabase.from('organizers').select('*').eq('user_id', user.value.id).maybeSingle()
    organizer.value = (data as unknown as Organizer) ?? null
    return organizer.value
  }

  async function ensureOrganizer(plan?: string) {
    loading.value = true
    error.value = null
    try {
      if (!user.value) throw new Error('Vous devez être connecté.')

      // Si une demande existe déjà mais est encore en attente, on laisse
      // passer jusqu'à l'appel serveur : c'est lui qui gère le changement
      // de formule (voir become-organizer.post.ts). On ne court-circuite ici
      // que si une formule a été choisie et qu'on a déjà l'espace en cache.
      const existing = await fetchOrganizer()
      if (existing && (!plan || existing.status !== 'pending' || existing.plan === plan)) return existing

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée, reconnectez-vous.')

      const { csrfHeader } = useCsrf()
      const result = await $fetch<{ organizer: Organizer; promoted: boolean }>('/api/account/become-organizer', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
        body: { plan },
      })

      if (result.promoted) {
        // Le rôle a changé côté base : on rafraîchit le profil local pour
        // que le menu, le middleware "organizer", etc. le voient tout de
        // suite sans nécessiter un rechargement de page.
        await authStore.fetchProfile()
      }

      organizer.value = result.organizer
      return organizer.value
    } catch (e: any) {
      error.value = e?.data?.statusMessage || e?.message || "Impossible de créer l'espace organisateur."
      throw e
    } finally {
      loading.value = false
    }
  }

  return { organizer, loading, error, fetchOrganizer, ensureOrganizer }
}
