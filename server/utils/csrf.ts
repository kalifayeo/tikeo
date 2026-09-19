import type { H3Event } from 'h3'
import { randomBytes } from 'node:crypto'

/**
 * Protection CSRF — pattern "double-submit cookie".
 *
 * Pourquoi ce pattern précisément : l'authentification Tikeo se fait par
 * jeton Bearer (JWT Supabase en en-tête `Authorization`, jamais envoyé
 * automatiquement par le navigateur), donc le CSRF "classique" — qui
 * exploite l'envoi automatique des cookies vers le même domaine, même
 * depuis un site tiers — ne s'applique pas directement ici. On ajoute
 * quand même cette protection en profondeur : un cookie + un en-tête
 * doivent correspondre, ce qu'une page tierce ne peut pas falsifier
 * (elle ne peut ni lire le cookie httpOnly, ni le deviner).
 *
 * Utilisation dans une route serveur qui modifie des données :
 *   import { requireCsrf } from '~/server/utils/csrf'
 *   export default defineEventHandler(async (event) => {
 *     requireCsrf(event)
 *     ...
 *   })
 */
const COOKIE_NAME = 'tikeo_csrf'
export const CSRF_HEADER_NAME = 'x-csrf-token'

export function ensureCsrfCookie(event: H3Event): string {
  const existing = getCookie(event, COOKIE_NAME)
  if (existing) return existing

  const token = randomBytes(32).toString('hex')
  setCookie(event, COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 4, // 4h — suffisant pour une session d'administration active
  })
  return token
}

export function requireCsrf(event: H3Event) {
  const cookieToken = getCookie(event, COOKIE_NAME)
  const headerToken = getHeader(event, CSRF_HEADER_NAME)

  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    throw createError({ statusCode: 403, statusMessage: 'Jeton de sécurité invalide ou manquant (CSRF). Rechargez la page et réessayez.' })
  }
}
