import type { Organizer } from '~/types/database'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Espace organisateur de l'utilisateur connecté (cahier des charges §8.3).
 * Si l'utilisateur n'a pas encore d'espace organisateur, on le crée
 * automatiquement à la première visite de "Créer un événement" — c'est le
 * parcours décrit au §65 ("Créer un compte → Créer événement").
 */
export function useOrganizer() {
  const supabase = useSupabase()
  const { user, profile } = useAuth()
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

  async function ensureOrganizer() {
    loading.value = true
    error.value = null
    try {
      if (!user.value) throw new Error('Vous devez être connecté.')

      const existing = await fetchOrganizer()
      if (existing) return existing

      const baseName = profile.value?.full_name || user.value.email?.split('@')[0] || 'Organisateur'
      const baseSlug = slugify(baseName) || 'organisateur'
      const uniqueSlug = `${baseSlug}-${user.value.id.slice(0, 6)}`

      const { data, error: insertError } = await supabase
        .from('organizers')
        .insert({
          user_id: user.value.id,
          name: baseName,
          slug: uniqueSlug,
          email: user.value.email,
          status: 'pending',
        })
        .select('*')
        .single()

      if (insertError) throw insertError

      // Le profil passe au rôle "organizer" dès qu'un espace est créé.
      if (profile.value && profile.value.role === 'buyer') {
        await supabase.from('profiles').update({ role: 'organizer' }).eq('user_id', user.value.id)
        await authStore.fetchProfile()
      }

      organizer.value = data as unknown as Organizer
      return organizer.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Impossible de créer l'espace organisateur."
      throw e
    } finally {
      loading.value = false
    }
  }

  return { organizer, loading, error, fetchOrganizer, ensureOrganizer }
}
