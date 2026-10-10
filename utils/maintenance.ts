/**
 * Mode maintenance — types et helpers partagés entre le serveur (garde HTTP,
 * API) et l'interface (page /maintenance, aperçu admin).
 */
export type MaintenanceKind = 'planned' | 'emergency'

export interface MaintenanceState {
  enabled: boolean
  kind: MaintenanceKind
  title: string | null
  message: string | null
  /** Retour estimé (ISO) — informatif, ne rouvre pas le site automatiquement. */
  endsAt: string | null
  updatedAt: string | null
}

export const MAINTENANCE_OFF: MaintenanceState = {
  enabled: false,
  kind: 'planned',
  title: null,
  message: null,
  endsAt: null,
  updatedAt: null,
}

/**
 * Valeur de l'en-tête HTTP `Retry-After` (secondes) envoyée avec le 503 :
 * temps restant avant le retour estimé, borné entre 1 min et 6 h ; 30 min
 * par défaut quand aucun retour n'est estimé.
 */
export function retryAfterSeconds(state: Pick<MaintenanceState, 'endsAt'>): number {
  if (state.endsAt) {
    const secs = Math.round((new Date(state.endsAt).getTime() - Date.now()) / 1000)
    if (Number.isFinite(secs) && secs > 0) return Math.min(Math.max(secs, 60), 6 * 3600)
  }
  return 1800
}
