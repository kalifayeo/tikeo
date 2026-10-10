/**
 * Pictogrammes proposés pour les pages d'introduction (plus d'emoji :
 * uniquement des icônes SVG du dictionnaire de AppIcon.vue). Utilisé par
 * l'intro (OnboardingIntro) et par le sélecteur de l'admin.
 */
export const INTRO_ICONS = [
  'ticket', 'search', 'phone', 'sparkles', 'calendar', 'compass',
  'map', 'users', 'heart', 'bell', 'wallet', 'card',
  'qr', 'shield-check', 'star', 'globe', 'megaphone', 'bolt',
  'tag', 'trending', 'headset', 'receipt', 'home', 'package',
] as const

export const DEFAULT_INTRO_ICON = 'ticket'

export function resolveIntroIcon(icon?: string | null): string {
  return icon && (INTRO_ICONS as readonly string[]).includes(icon) ? icon : DEFAULT_INTRO_ICON
}
