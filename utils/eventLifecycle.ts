/**
 * Cycle de vie d'un événement : « passé » ou « à venir ».
 *
 * Règle unique, partagée par le front (listes, recherche, accueil) et le
 * serveur (sitemap) :
 *  - si l'événement a une date de fin (`end_date`, enregistrée à 23:59:59 du
 *    dernier jour par les formulaires), il disparaît des listes publiques une
 *    fois cette date dépassée ;
 *  - sinon, il disparaît `EVENT_GRACE_HOURS` heures après son début, ce qui
 *    évite de masquer un événement encore en cours (ex. soirée qui démarre
 *    à 20 h et se termine après minuit) ;
 *  - cas particulier : un événement sans heure (début à 00:00) est traité
 *    comme une journée entière et reste visible jusqu'à la fin de ce jour.
 *
 * Ce fichier ne contient que des fonctions pures (aucune dépendance Vue/Nuxt)
 * pour pouvoir être importé aussi bien côté navigateur que côté Nitro.
 */
export const EVENT_GRACE_HOURS = 6
const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

/** Instant (ms) à partir duquel l'événement est considéré comme terminé. */
export function eventEndMs(startDate: string, endDate?: string | null): number {
  const startDateObj = new Date(startDate)
  const start = startDateObj.getTime()
  if (endDate) {
    const end = new Date(endDate).getTime()
    // Une date de fin incohérente (avant le début) est ignorée.
    if (!Number.isNaN(end) && end >= start) return end
  }
  const isAllDay = startDateObj.getUTCHours() === 0 && startDateObj.getUTCMinutes() === 0 && startDateObj.getUTCSeconds() === 0
  return start + (isAllDay ? DAY_MS : EVENT_GRACE_HOURS * HOUR_MS)
}

/** L'événement est-il terminé à l'instant `now` ? */
export function isEventPast(startDate: string, endDate?: string | null, now: number = Date.now()): boolean {
  const end = eventEndMs(startDate, endDate)
  if (Number.isNaN(end)) return false
  return end < now
}

/**
 * Filtre PostgREST à passer à `.or(...)` : écarte côté base les événements
 * clairement terminés, pour que la limite de résultats ne soit pas
 * « mangée » par d'anciens événements.
 *   end_date >= now  OU  (end_date est nul ET start_date >= now - 24 h)
 *
 * Le filtre est volontairement un peu plus large (24 h) que `isEventPast` :
 * la coupe précise (6 h, ou fin de journée pour un événement sans heure)
 * est appliquée ensuite avec `isEventPast` sur les lignes récupérées.
 */
export function upcomingEventsOrFilter(now: number = Date.now()): string {
  const nowIso = new Date(now).toISOString()
  const looseIso = new Date(now - DAY_MS).toISOString()
  return `end_date.gte.${nowIso},and(end_date.is.null,start_date.gte.${looseIso})`
}
