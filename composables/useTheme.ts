export type ThemeMode = 'light' | 'dark'

/**
 * Thème clair/sombre persisté en cookie (donc disponible dès le rendu serveur,
 * pas de flash de mauvais thème au chargement).
 */
export function useTheme() {
  const theme = useCookie<ThemeMode>('tikeo_theme', {
    default: () => 'light',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  function setTheme(mode: ThemeMode) {
    theme.value = mode
  }

  function toggleTheme() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }

  return { theme, setTheme, toggleTheme }
}
