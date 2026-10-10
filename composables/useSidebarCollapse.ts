/**
 * Masquer / afficher le menu latéral des espaces Admin et Organisateur
 * (écrans ≥ md). Le choix est mémorisé dans un cookie (valable 1 an, lisible
 * côté serveur : pas de « saut » de mise en page au rechargement).
 * Raccourci clavier : Ctrl + B (⌘ + B sur Mac), sauf pendant une saisie.
 *
 * Sur mobile le menu reste un tiroir ouvert par le bouton hamburger : cet
 * état n'a aucun effet sous le breakpoint md.
 */
export function useSidebarCollapse(name: 'admin' | 'organizer') {
  const stored = useCookie<string | null>(`tikeo_sidebar_${name}`, {
    default: () => null,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    secure: !import.meta.dev,
  })
  const collapsed = computed(() => stored.value === 'collapsed')

  function toggle() {
    stored.value = collapsed.value ? null : 'collapsed'
  }

  function onKey(e: KeyboardEvent) {
    if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'b') return
    const el = e.target as HTMLElement | null
    if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return
    // Uniquement sur grand écran : sur mobile le raccourci n'a pas de sens.
    if (!window.matchMedia('(min-width: 768px)').matches) return
    e.preventDefault()
    toggle()
  }

  onMounted(() => window.addEventListener('keydown', onKey))
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

  return { collapsed, toggle }
}
