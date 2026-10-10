import type { Category } from '~/types/database'

/**
 * Icônes (paths SVG, stroke 24x24) associées au champ `icon` de la table
 * `categories`. Avant, CategoriesRow.vue listait des catégories inventées
 * ("Favoris", "Paramètres"...) qui ne correspondaient à aucune ligne de la
 * base — les clics ne filtraient donc jamais rien. On affiche maintenant les
 * vraies catégories Supabase (voir supabase/seed/seed.sql).
 */
export const CATEGORY_ICONS: Record<string, string> = {
  music: 'M9 18V5l12-2v13M9 18a3 3 0 11-6 0 3 3 0 016 0zM21 16a3 3 0 11-6 0 3 3 0 016 0z',
  sparkles: 'M12 3l1.5 4.5H18l-3.6 2.7 1.4 4.5-3.8-2.8-3.8 2.8 1.4-4.5L6 7.5h4.5z',
  presentation: 'M3 5h18M3 12h18M3 19h18',
  'graduation-cap': 'M12 14l9-5-9-5-9 5 9 5zm0 0v7m-9-5v3.5c0 1.4 4 3.5 9 3.5s9-2.1 9-3.5V9',
  trophy: 'M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3a12 12 0 010 18',
  'theater-masks': 'M9 20H5a2 2 0 01-2-2v-2a4 4 0 014-4h.5M15 20h4a2 2 0 002-2v-2a4 4 0 00-4-4h-.5M9 8a3 3 0 106 0 3 3 0 00-6 0z',
  drama: 'M9 20H5a2 2 0 01-2-2v-2a4 4 0 014-4h.5M15 20h4a2 2 0 002-2v-2a4 4 0 00-4-4h-.5M9 8a3 3 0 106 0 3 3 0 00-6 0z',
  users: 'M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m5-3.13a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6M3 8a3 3 0 100-6',
  landmark: 'M3 21h18M4 21V9l8-5 8 5v12M9 21V13h6v8',
  church: 'M12 2v4m-2 2h4l3 3h-4v11H9V11H5l3-3z',
  grid: 'M4 4h7v7H4V4zm9 0h7v7h-7V4zM4 13h7v7H4v-7zm9 0h7v7h-7v-7z',
}

const DEFAULT_ICON = CATEGORY_ICONS.grid

export function categoryIconPath(icon?: string | null) {
  if (!icon) return DEFAULT_ICON
  return CATEGORY_ICONS[icon] || DEFAULT_ICON
}

export function useCategoriesList() {
  const categories = useState<Category[]>('tikeo-categories', () => [])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchCategories() {
    if (categories.value.length > 0) return categories.value
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('categories')
        .select('*')
        .eq('status', 'active')
        .order('position', { ascending: true })
        .order('name', { ascending: true })
      if (sbError) throw sbError
      categories.value = (data as unknown as Category[]) ?? []
      return categories.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement des catégories'
      return []
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    onMounted(fetchCategories)
  }

  return { categories, loading, error, fetchCategories }
}

/**
 * Gestion des catégories côté admin (/admin/categories) : contrairement à
 * useCategoriesList (lecture publique, catégories actives seulement), on a
 * ici besoin de TOUTES les catégories (actives et désactivées) et des
 * opérations d'écriture. Protégé côté base par la policy "Admin gère les
 * catégories" (0012_categories_admin_policies.sql) : un appel par un
 * compte non-admin échouera silencieusement en RLS, quoi qu'il arrive ici.
 */
export function useAdminCategories() {
  const categories = ref<Category[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('categories')
        .select('*')
        .order('position', { ascending: true })
        .order('name', { ascending: true })
      if (sbError) throw sbError
      categories.value = (data as unknown as Category[]) ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement des catégories'
    } finally {
      loading.value = false
    }
  }

  // Un slug propre (minuscules, tirets) est indispensable : c'est la clé
  // utilisée par events.category_id -> categories.slug pour le filtrage.
  function slugify(text: string) {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  async function createCategory(input: { name: string; slug?: string; icon: string; status: 'active' | 'inactive' }) {
    const supabase = useSupabase()
    const nextPosition = categories.value.length > 0 ? Math.max(...categories.value.map((c) => c.position ?? 0)) + 1 : 1
    const { data, error: sbError } = await supabase
      .from('categories')
      .insert({
        name: input.name.trim(),
        slug: input.slug?.trim() || slugify(input.name),
        icon: input.icon,
        status: input.status,
        position: nextPosition,
      })
      .select()
      .single()
    if (sbError) throw sbError
    categories.value = [...categories.value, data as unknown as Category].sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0)
    )
    return data as unknown as Category
  }

  async function updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'slug' | 'icon' | 'status' | 'position'>>) {
    const supabase = useSupabase()
    const { data, error: sbError } = await supabase.from('categories').update(patch).eq('id', id).select().single()
    if (sbError) throw sbError
    categories.value = categories.value.map((c) => (c.id === id ? (data as unknown as Category) : c))
    return data as unknown as Category
  }

  /**
   * Supprimer une catégorie ne supprime jamais les événements qui
   * l'utilisent : ils repassent simplement sans catégorie (regroupés dans
   * « Autres événements » sur l'accueil), exactement comme le prévoit déjà
   * `category_id uuid references categories(id)` sans ON DELETE CASCADE.
   * On prévient l'appelant du nombre d'événements concernés pour qu'il
   * puisse demander confirmation avant de supprimer.
   */
  async function countEventsUsingCategory(id: string): Promise<number> {
    const supabase = useSupabase()
    const { count } = await supabase.from('events').select('id', { count: 'exact', head: true }).eq('category_id', id)
    return count ?? 0
  }

  async function deleteCategory(id: string) {
    const supabase = useSupabase()
    const { error: sbError } = await supabase.from('categories').delete().eq('id', id)
    if (sbError) throw sbError
    categories.value = categories.value.filter((c) => c.id !== id)
  }

  onMounted(fetchAll)

  return {
    categories,
    loading,
    error,
    fetchAll,
    slugify,
    createCategory,
    updateCategory,
    deleteCategory,
    countEventsUsingCategory,
  }
}
