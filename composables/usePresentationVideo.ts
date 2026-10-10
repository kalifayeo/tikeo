/**
 * Vidéo de présentation du site (illustre Tikeo et montre comment l'utiliser).
 * Source, par ordre de priorité :
 *   1. le lien saisi par l'admin dans /admin/accueil (home_hero_content.presentation_video_url)
 *   2. NUXT_PUBLIC_PRESENTATION_VIDEO_URL
 * Formats acceptés :
 *   - fichier du site (par défaut /videos/presentation.mp4, à déposer dans public/videos/)
 *   - lien YouTube, lien Vimeo, ou URL directe d'un .mp4 / .webm
 * L'état d'ouverture est partagé : n'importe quel bouton appelle open().
 */
export type PresentationSource =
  | { kind: 'embed'; src: string }
  | { kind: 'file'; src: string }

export function parsePresentationSource(raw: string): PresentationSource | null {
  const url = (raw || '').trim()
  if (!url) return null
  // Seuls http(s) et les chemins du site sont acceptés (jamais javascript:, data:, //hôte…).
  if (!/^https?:\/\//i.test(url) && !(url.startsWith('/') && !url.startsWith('//'))) return null

  // YouTube : watch?v=, youtu.be/, shorts/, embed/
  const yt = url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{11})/i)
  if (yt) return { kind: 'embed', src: `https://www.youtube-nocookie.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1&playsinline=1` }

  // Vimeo : vimeo.com/123456789
  const vm = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i)
  if (vm) return { kind: 'embed', src: `https://player.vimeo.com/video/${vm[1]}?autoplay=1` }

  return { kind: 'file', src: url }
}

export function usePresentationVideo() {
  const config = useRuntimeConfig()
  const isOpen = useState('tikeo-presentation-open', () => false)
  // Lien géré par l'admin (chargé une seule fois, partagé avec le hero).
  const { content } = useHomeHeroContent()
  const source = computed(() =>
    parsePresentationSource(String(content.value?.presentation_video_url || '')) ??
    parsePresentationSource(String(config.public.presentationVideoUrl || ''))
  )
  const poster = computed(() => String(config.public.presentationVideoPoster || ''))

  function open() {
    isOpen.value = true
  }
  function close() {
    isOpen.value = false
  }

  return { isOpen, source, poster, open, close }
}
