import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/account/hide-items — « supprime » des billets ou des commandes de
 * l'historique de l'acheteur. Corps : { kind: 'ticket' | 'order', ids: string[] }.
 *
 * Il s'agit d'un MASQUAGE (colonne hidden_by_user_at, migration 0038), jamais
 * d'une suppression de ligne : l'organisateur, l'admin, les revenus et le scan
 * à l'entrée ont besoin de ces données. L'identité vient du jeton de session
 * (requireUser) et la requête est filtrée sur user_id : impossible de masquer
 * les billets ou commandes de quelqu'un d'autre.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'hide-items', max: 60, windowMs: 10 * 60 * 1000 })

  const { userId } = await requireUser(event)
  const body = await readBody<{ kind?: string; ids?: unknown }>(event)

  const kind = body?.kind
  if (kind !== 'ticket' && kind !== 'order') {
    throw createError({ statusCode: 400, statusMessage: 'Type invalide.' })
  }
  const ids = Array.isArray(body?.ids) ? body!.ids.filter((x): x is string => typeof x === 'string' && UUID_RE.test(x)) : []
  if (ids.length === 0 || ids.length > 100) {
    throw createError({ statusCode: 400, statusMessage: 'Liste invalide.' })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const now = new Date().toISOString()

  let query = supabaseAdmin
    .from(kind === 'ticket' ? 'tickets' : 'orders')
    .update({ hidden_by_user_at: now })
    .eq('user_id', userId)
    .in('id', ids)

  // Une commande en attente de paiement garde sa réservation de stock et son
  // lien de paiement : on ne la masque pas, elle expirera d'elle-même.
  if (kind === 'order') query = query.neq('status', 'pending')

  const { error } = await query
  if (error) {
    throw createError({ statusCode: 500, statusMessage: 'Impossible de supprimer pour le moment.' })
  }

  return { success: true }
})
