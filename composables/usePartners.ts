import type { Partner, PartnerCategory } from '~/types/database'

/** Catégories de partenaires, dans l'ordre d'affichage des filtres. */
export const PARTNER_CATEGORIES: PartnerCategory[] = ['sponsor', 'payment', 'media', 'venue', 'tech', 'institution', 'other']

/** Icône (AppIcon) associée à chaque catégorie. */
export const PARTNER_CATEGORY_ICONS: Record<PartnerCategory, string> = {
  sponsor: 'star',
  payment: 'card',
  media: 'megaphone',
  venue: 'pin',
  tech: 'bolt',
  institution: 'shield-check',
  other: 'handshake',
}

/** Accepte uniquement http(s) : un lien « javascript: » ne doit jamais être cliquable. */
export function safeExternalUrl(url?: string | null) {
  const v = (url || '').trim()
  return /^https?:\/\//i.test(v) ? v : ''
}

/** Initiales affichées quand un partenaire n'a pas (encore) de logo. */
export function partnerInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || '?'
  )
}

/**
 * Lecture publique des partenaires actifs (section d'accueil + /partenaires).
 * Ordre : mis en avant d'abord, puis position définie dans l'admin.
 */
export function usePartners() {
  const partners = useState<Partner[]>('tikeo-partners', () => [])
  const loaded = useState<boolean>('tikeo-partners-loaded', () => false)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPartners() {
    if (loaded.value) return partners.value
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('partners')
        .select('*')
        .eq('status', 'active')
        .order('position', { ascending: true })
      if (sbError) throw sbError
      partners.value = (data as unknown as Partner[]) ?? []
      loaded.value = true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement des partenaires'
    } finally {
      loading.value = false
    }
    return partners.value
  }

  if (import.meta.client) onMounted(fetchPartners)

  const featured = computed(() => partners.value.filter((p) => p.is_featured))
  const regular = computed(() => partners.value.filter((p) => !p.is_featured))

  return { partners, featured, regular, loading, loaded, error, fetchPartners }
}

/**
 * Gestion admin (/admin/partenaires) : tous les partenaires (actifs et
 * désactivés), création, modification, suppression, activation, mise en avant
 * et réordonnancement. Protégé côté base par la policy « Gestion des
 * partenaires » (permission partners.manage).
 */
export function useAdminPartners() {
  const items = ref<Partner[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  const sorted = computed(() => [...items.value].sort((a, b) => a.position - b.position))

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: err } = await supabase.from('partners').select('*').order('position', { ascending: true })
      if (err) throw err
      items.value = (data as unknown as Partner[]) ?? []
    } catch (e: any) {
      error.value = e?.message || 'LOAD_FAILED'
    } finally {
      loading.value = false
    }
  }

  // Les pages publiques gardent le cache `useState` : on le vide après chaque
  // écriture pour que l'accueil reflète tout de suite le changement.
  function invalidatePublicCache() {
    const loaded = useState<boolean>('tikeo-partners-loaded')
    loaded.value = false
  }

  type Input = Pick<Partner, 'name' | 'description' | 'logo_url' | 'website_url' | 'category' | 'is_featured' | 'status'>

  async function create(input: Input) {
    const supabase = useSupabase()
    const position = Math.max(0, ...items.value.map((i) => i.position)) + 1
    const { data, error: err } = await supabase.from('partners').insert({ ...input, position }).select().single()
    if (err) throw err
    items.value = [...items.value, data as unknown as Partner]
    invalidatePublicCache()
    return data as unknown as Partner
  }

  async function update(id: string, patch: Partial<Input & { position: number }>) {
    const supabase = useSupabase()
    const { data, error: err } = await supabase
      .from('partners')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    items.value = items.value.map((i) => (i.id === id ? (data as unknown as Partner) : i))
    invalidatePublicCache()
    return data as unknown as Partner
  }

  async function remove(id: string) {
    const supabase = useSupabase()
    const { error: err } = await supabase.from('partners').delete().eq('id', id)
    if (err) throw err
    items.value = items.value.filter((i) => i.id !== id)
    invalidatePublicCache()
  }

  // Monter / descendre : on renumérote 1..n pour garder des positions propres.
  async function move(partner: Partner, direction: -1 | 1) {
    const list = [...sorted.value]
    const index = list.findIndex((p) => p.id === partner.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    await Promise.all(list.map((p, i) => (p.position !== i + 1 ? update(p.id, { position: i + 1 }) : null)))
  }

  onMounted(fetchAll)

  return { items, sorted, loading, error, fetchAll, create, update, remove, move }
}
