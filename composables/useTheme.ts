export type ThemeMode = 'light' | 'dark'

/**
 * Thème clair/sombre persisté en cookie (donc disponible dès le rendu serveur,
 * pas de flash de mauvais thème au chargement).
 *
 * Mode « Auto » (Paramètres > Affichage) : le thème suit celui de l'appareil
 * (prefers-color-scheme) et change en direct. Choisir manuellement clair ou
 * sombre désactive l'automatique.
 */
export function useTheme() {
  const theme = useCookie<ThemeMode>('tikeo_theme', {
    default: () => 'light',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  const auto = useCookie<boolean>('tikeo_theme_auto', {
    default: () => false,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  function systemTheme(): ThemeMode {
    if (!import.meta.client) return 'light'
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  function setTheme(mode: ThemeMode) {
    auto.value = false
    theme.value = mode
  }

  function toggleTheme() {
    auto.value = false
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  function setAuto(on: boolean) {
    auto.value = on
    if (on) theme.value = systemTheme()
  }

  /** À appeler une fois côté client (app.vue) : suit l'appareil quand « Auto » est actif. */
  function watchSystemTheme() {
    if (!import.meta.client) return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    if (auto.value) theme.value = mq.matches ? 'dark' : 'light'
    mq.addEventListener('change', (e) => {
      if (auto.value) theme.value = e.matches ? 'dark' : 'light'
    })
  }

  return { theme, auto, setTheme, toggleTheme, setAuto, watchSystemTheme }
}
