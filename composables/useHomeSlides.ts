import type { HomeHeroContent, HomeSlide } from '~/types/database'

type Zone = HomeSlide['zone']

/**
 * Détecte le type de média à partir de l'URL (utile pour pré-remplir le
 * champ `media_type` dans le formulaire admin sans que l'utilisateur ait à
 * y penser : un lien .gif est presque toujours un gif animé).
 */
export function guessMediaType(url: string): 'image' | 'gif' {
  return /\.gif(\?|#|$)/i.test(url.trim()) ? 'gif' : 'image'
}

/**
 * Lecture publique des slides actifs de la bannière d'accueil, groupés par
 * zone (center / left / right) et triés par position. Utilisé par
 * HeroSection.vue.
 */
export function useHomeSlides() {
  const slides = useState<HomeSlide[]>('tikeo-home-slides', () => [])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchSlides() {
    if (slides.value.length > 0) return slides.value
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('home_slides')
        .select('*')
        .eq('status', 'active')
        .order('zone', { ascending: true })
        .order('position', { ascending: true })
      if (sbError) throw sbError
      slides.value = (data as unknown as HomeSlide[]) ?? []
      return slides.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement de la bannière'
      return []
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    onMounted(fetchSlides)
  }

  function byZone(zone: Zone) {
    return computed(() => slides.value.filter((s) => s.zone === zone).sort((a, b) => a.position - b.position))
  }

  return { slides, loading, error, fetchSlides, byZone }
}

/**
 * Lecture publique du texte affiché sur la grande bannière centrale
 * (titre / sous-titre / bouton). Ligne unique (id = 1), voir
 * 0013_home_slides.sql.
 */
export function useHomeHeroContent() {
  const content = useState<HomeHeroContent | null>('tikeo-home-hero-content', () => null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchContent() {
    if (content.value) return content.value
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase.from('home_hero_content').select('*').eq('id', 1).maybeSingle()
      if (sbError) throw sbError
      content.value = (data as unknown as HomeHeroContent) ?? null
      return content.value
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement du texte de la bannière'
      return null
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    onMounted(fetchContent)
  }

  return { content, loading, error, fetchContent }
}

/**
 * Gestion admin des slides (/admin/accueil) : toutes les slides (actives et
 * désactivées), création, édition, suppression, réordonnancement. Protégé
 * côté base par la policy "Admin gère les slides de l'accueil".
 */
export function useAdminHomeSlides() {
  const slides = ref<HomeSlide[]>([])
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase
        .from('home_slides')
        .select('*')
        .order('zone', { ascending: true })
        .order('position', { ascending: true })
      if (sbError) throw sbError
      slides.value = (data as unknown as HomeSlide[]) ?? []
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement des slides'
    } finally {
      loading.value = false
    }
  }

  function byZone(zone: Zone) {
    return computed(() => slides.value.filter((s) => s.zone === zone).sort((a, b) => a.position - b.position))
  }

  // Le hero de l'accueil fusionne les trois zones dans un seul diaporama, dans
  // cet ordre : centre, gauche, droite (chacune triée par position). L'admin
  // travaille donc sur cette liste unique, exactement celle que voit le public.
  const ZONE_ORDER: Zone[] = ['center', 'left', 'right']
  const slideshow = computed(() =>
    [...slides.value].sort((a, b) => {
      const z = ZONE_ORDER.indexOf(a.zone) - ZONE_ORDER.indexOf(b.zone)
      return z !== 0 ? z : a.position - b.position
    })
  )

  // Déplacement dans la liste unique : on range tout dans la zone « center »
  // avec des positions 1..n, ce qui garde exactement l'ordre affiché (les
  // anciennes zones gauche/droite n'ont plus de sens côté public).
  async function moveInSlideshow(slide: HomeSlide, direction: -1 | 1) {
    const list = [...slideshow.value]
    const index = list.findIndex((s) => s.id === slide.id)
    const target = index + direction
    if (index < 0 || target < 0 || target >= list.length) return
    ;[list[index], list[target]] = [list[target], list[index]]
    await Promise.all(
      list.map((s, i) => (s.zone !== 'center' || s.position !== i + 1 ? updateSlide(s.id, { zone: 'center', position: i + 1 }) : null))
    )
  }

  async function createSlide(input: { zone: Zone; media_url: string; media_type: 'image' | 'gif'; status: 'active' | 'inactive' }) {
    const supabase = useSupabase()
    // Nouvelle image = fin du diaporama (après toutes les zones confondues).
    const nextPosition = slides.value.length > 0 ? Math.max(...slides.value.map((s) => s.position)) + 1 : 1
    const { data, error: sbError } = await supabase
      .from('home_slides')
      .insert({ ...input, media_url: input.media_url.trim(), position: nextPosition })
      .select()
      .single()
    if (sbError) throw sbError
    slides.value = [...slides.value, data as unknown as HomeSlide]
    return data as unknown as HomeSlide
  }

  async function updateSlide(id: string, patch: Partial<Pick<HomeSlide, 'media_url' | 'media_type' | 'status' | 'position' | 'zone'>>) {
    const supabase = useSupabase()
    const { data, error: sbError } = await supabase.from('home_slides').update(patch).eq('id', id).select().single()
    if (sbError) throw sbError
    slides.value = slides.value.map((s) => (s.id === id ? (data as unknown as HomeSlide) : s))
    return data as unknown as HomeSlide
  }

  async function deleteSlide(id: string) {
    const supabase = useSupabase()
    const { error: sbError } = await supabase.from('home_slides').delete().eq('id', id)
    if (sbError) throw sbError
    slides.value = slides.value.filter((s) => s.id !== id)
  }

  // Réordonnancement (flèches haut/bas) au sein d'une même zone uniquement.
  async function move(slide: HomeSlide, direction: -1 | 1) {
    const sorted = slides.value.filter((s) => s.zone === slide.zone).sort((a, b) => a.position - b.position)
    const index = sorted.findIndex((s) => s.id === slide.id)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sorted.length) return
    const other = sorted[targetIndex]
    await Promise.all([updateSlide(slide.id, { position: other.position }), updateSlide(other.id, { position: slide.position })])
  }

  onMounted(fetchAll)

  return { slides, slideshow, loading, error, fetchAll, byZone, createSlide, updateSlide, deleteSlide, move, moveInSlideshow }
}

/**
 * Gestion admin du texte de la bannière centrale (ligne unique, id = 1).
 */
export function useAdminHeroContent() {
  const content = ref<HomeHeroContent | null>(null)
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchContent() {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: sbError } = await supabase.from('home_hero_content').select('*').eq('id', 1).maybeSingle()
      if (sbError) throw sbError
      content.value = (data as unknown as HomeHeroContent) ?? null
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Erreur de chargement du texte de la bannière'
    } finally {
      loading.value = false
    }
  }

  async function saveContent(patch: Partial<Pick<HomeHeroContent, 'title' | 'subtitle' | 'cta_label' | 'cta_url' | 'presentation_video_url'>>) {
    const supabase = useSupabase()
    const { data, error: sbError } = await supabase
      .from('home_hero_content')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .select()
      .single()
    if (sbError) throw sbError
    content.value = data as unknown as HomeHeroContent
    return content.value
  }

  onMounted(fetchContent)

  return { content, loading, error, fetchContent, saveContent }
}
