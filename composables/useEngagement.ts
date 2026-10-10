import type { OnboardingSlide, Popup, TourStep } from '~/types/database'

/**
 * Introduction, visite guidée du header et pop-ups (migration 0027).
 *
 * Le CONTENU vient de la base (géré par l'admin). Ce qui est propre à
 * l'appareil du visiteur — « ai-je déjà vu l'intro ? », « ai-je fermé ce
 * pop-up ? » — reste dans son navigateur (localStorage / sessionStorage) :
 * aucune donnée personnelle n'est envoyée au serveur.
 */

const KEY_INTRO = 'tikeo:intro-done:v1'
const KEY_TOUR = 'tikeo:tour-done:v1'
const KEY_POPUPS = 'tikeo:popups-seen:v1'
const sessionPopupKey = (p: Pick<Popup, 'id' | 'revision'>) => `tikeo:popup-session:${p.id}:${p.revision}`

// Le stockage peut être indisponible (navigation privée stricte, quotas...) :
// on ne doit JAMAIS casser le site pour ça — dans le doute, on n'affiche rien
// de plus qu'une fois par chargement de page.
function read(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* ignoré */
  }
}

export type EngagementPhase = 'idle' | 'intro' | 'tour' | 'popup' | 'done'

/** Mémoire de l'appareil du visiteur. */
export function useDeviceEngagementState() {
  const introDone = () => read(KEY_INTRO) === '1'
  const tourDone = () => read(KEY_TOUR) === '1'
  const markIntroDone = () => write(KEY_INTRO, '1')
  const markTourDone = () => write(KEY_TOUR, '1')

  function seenPopups(): Record<string, number> {
    try {
      return JSON.parse(read(KEY_POPUPS) || '{}') || {}
    } catch {
      return {}
    }
  }

  /** Doit-on (re)présenter ce pop-up sur cet appareil, selon sa fréquence ? */
  function shouldShowPopup(p: Popup): boolean {
    if (p.frequency === 'always') return true
    if (p.frequency === 'once') return seenPopups()[p.id] !== p.revision
    try {
      return sessionStorage.getItem(sessionPopupKey(p)) !== '1'
    } catch {
      return true
    }
  }

  function markPopupSeen(p: Popup) {
    if (p.frequency === 'once') {
      write(KEY_POPUPS, JSON.stringify({ ...seenPopups(), [p.id]: p.revision }))
    } else if (p.frequency === 'session') {
      try {
        sessionStorage.setItem(sessionPopupKey(p), '1')
      } catch {
        /* ignoré */
      }
    }
  }

  /** Permet de rejouer l'introduction et la visite (ex. lien « Revoir la visite »). */
  function resetOnboarding() {
    try {
      localStorage.removeItem(KEY_INTRO)
      localStorage.removeItem(KEY_TOUR)
    } catch {
      /* ignoré */
    }
  }

  return { introDone, tourDone, markIntroDone, markTourDone, shouldShowPopup, markPopupSeen, resetOnboarding }
}

/** Lecture publique des contenus actifs (RLS : seul le contenu actif est renvoyé). */
export async function fetchEngagementContent() {
  const supabase = useSupabase()
  const [slides, steps, popups] = await Promise.all([
    supabase.from('onboarding_slides').select('*').eq('status', 'active').order('position', { ascending: true }),
    supabase.from('tour_steps').select('*').eq('status', 'active').order('position', { ascending: true }),
    supabase.from('popups').select('*').eq('status', 'active').order('created_at', { ascending: false }),
  ])
  return {
    slides: (slides.data as unknown as OnboardingSlide[]) ?? [],
    steps: (steps.data as unknown as TourStep[]) ?? [],
    popups: (popups.data as unknown as Popup[]) ?? [],
  }
}

/**
 * CRUD admin générique pour les trois tables. Les droits sont appliqués par
 * la RLS (permissions onboarding.manage / popups.manage) ; ce composable ne
 * décide jamais lui-même de ce qui est autorisé.
 */
export function useAdminEngagementTable<T extends { id: string; position?: number }>(
  table: 'onboarding_slides' | 'tour_steps' | 'popups',
  order: { column: string; ascending: boolean } = { column: 'position', ascending: true }
) {
  const items = ref<T[]>([]) as Ref<T[]>
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const supabase = useSupabase()
      const { data, error: err } = await supabase.from(table).select('*').order(order.column, { ascending: order.ascending })
      if (err) throw err
      items.value = (data as unknown as T[]) ?? []
    } catch (e: any) {
      error.value = e?.message || 'LOAD_FAILED'
    } finally {
      loading.value = false
    }
  }

  async function create(input: Record<string, unknown>) {
    const supabase = useSupabase()
    const withPos = items.value.some((i) => i.position !== undefined)
    const payload = withPos ? { ...input, position: Math.max(0, ...items.value.map((i) => i.position ?? 0)) + 1 } : input
    const { data, error: err } = await supabase.from(table).insert(payload).select().single()
    if (err) throw err
    items.value = [...items.value, data as unknown as T]
    return data as unknown as T
  }

  async function update(id: string, patch: Record<string, unknown>) {
    const supabase = useSupabase()
    const { data, error: err } = await supabase
      .from(table)
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single()
    if (err) throw err
    items.value = items.value.map((i) => (i.id === id ? (data as unknown as T) : i))
    return data as unknown as T
  }

  async function remove(id: string) {
    const supabase = useSupabase()
    const { error: err } = await supabase.from(table).delete().eq('id', id)
    if (err) throw err
    items.value = items.value.filter((i) => i.id !== id)
  }

  /** Déplace la ligne d'un cran (flèches haut/bas) en renumérotant 1..n proprement. */
  async function move(item: T, direction: -1 | 1) {
    const sorted = [...items.value].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    const idx = sorted.findIndex((i) => i.id === item.id)
    const target = idx + direction
    if (idx < 0 || target < 0 || target >= sorted.length) return
    ;[sorted[idx], sorted[target]] = [sorted[target], sorted[idx]]
    const supabase = useSupabase()
    const changes = sorted
      .map((row, i) => ({ row, position: i + 1 }))
      .filter(({ row, position }) => row.position !== position)
    const results = await Promise.all(changes.map(({ row, position }) => supabase.from(table).update({ position }).eq('id', row.id)))
    const failed = results.find((r) => r.error)
    if (failed?.error) throw failed.error
    await fetchAll()
  }

  onMounted(fetchAll)

  return { items, loading, error, fetchAll, create, update, remove, move }
}
