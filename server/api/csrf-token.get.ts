import { ensureCsrfCookie } from '~/server/utils/csrf'

/**
 * GET /api/csrf-token
 * Pose (si besoin) le cookie CSRF httpOnly et renvoie sa valeur au client,
 * qui doit ensuite la renvoyer dans l'en-tête `x-csrf-token` sur toute
 * requête qui modifie des données via nos routes serveur (~/server/api).
 * Voir ~/server/utils/csrf.ts pour le détail du fonctionnement.
 */
export default defineEventHandler((event) => {
  const token = ensureCsrfCookie(event)
  return { token }
})
