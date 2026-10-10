export type TextSize = 'sm' | 'md' | 'lg' | 'xl'

export interface UiPrefs {
  textSize: TextSize
  reduceMotion: boolean
  highContrast: boolean
  dataSaver: boolean
  haptics: boolean
}

export const DEFAULT_UI_PREFS: UiPrefs = {
  textSize: 'md',
  reduceMotion: false,
  highContrast: false,
  dataSaver: false,
  haptics: true,
}

/**
 * Préférences d'affichage de l'appareil (Paramètres > Affichage et
 * accessibilité). Stockées en cookie : elles sont donc lues dès le rendu
 * serveur et appliquées sur <html> sans aucun flash (voir app.vue). Les
 * styles correspondants sont dans assets/css/main.css (.ui-*).
 */
export function useUiPrefs() {
  const prefs = useCookie<UiPrefs>('tikeo_ui', {
    default: () => ({ ...DEFAULT_UI_PREFS }),
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  /** Classes à poser sur <html>. */
  const htmlClasses = computed(() => {
    const p = { ...DEFAULT_UI_PREFS, ...(prefs.value || {}) }
    const out: string[] = []
    if (p.textSize !== 'md') out.push(`ui-text-${p.textSize}`)
    if (p.reduceMotion) out.push('ui-reduce-motion')
    if (p.highContrast) out.push('ui-contrast')
    if (p.dataSaver) out.push('ui-data-saver')
    return out
  })

  function set<K extends keyof UiPrefs>(key: K, value: UiPrefs[K]) {
    prefs.value = { ...DEFAULT_UI_PREFS, ...(prefs.value || {}), [key]: value }
  }

  function reset() {
    prefs.value = { ...DEFAULT_UI_PREFS }
  }

  const dataSaver = computed(() => !!prefs.value?.dataSaver)
  const haptics = computed(() => prefs.value?.haptics !== false)

  /** Petite vibration (mobiles compatibles) si le retour haptique est activé. */
  function buzz(ms: number | number[] = 12) {
    if (!import.meta.client || !haptics.value) return
    try {
      navigator.vibrate?.(ms)
    } catch {
      /* non supporté */
    }
  }

  return { prefs, htmlClasses, set, reset, dataSaver, haptics, buzz }
}
