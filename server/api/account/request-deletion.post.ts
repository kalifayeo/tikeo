import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

/**
 * POST /api/account/request-deletion
 *
 * Remplace l'ancien insert direct dans contact_messages fait depuis le
 * client (pages/mon-espace/parametres/index.vue), qui avait deux problèmes :
 *   1. Aucune protection serveur (pas de CSRF, pas de limite de débit) —
 *      contrairement à /api/contact qui, lui, passe déjà par ici.
 *   2. Rien ne rattachait la demande à un compte réel : l'admin ne voyait
 *      qu'un nom/email déclaratifs, sans moyen fiable de supprimer LE bon
 *      compte (cf. server/api/admin/users/[userId]/delete.post.ts).
 * Ici, le user_id vient du jeton de session vérifié par requireUser — jamais
 * du corps de la requête — donc impossible de faire une demande au nom de
 * quelqu'un d'autre.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'account-deletion', max: 3, windowMs: 30 * 60 * 1000 })

  const { userId, email } = await requireUser(event)

  const body = await readBody<{ reason?: string }>(event)
  const reason = body?.reason?.trim().slice(0, 2000) || ''

  const supabaseAdmin = useSupabaseAdmin()

  const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('full_name, status').eq('user_id', userId).maybeSingle()
  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profil introuvable.' })
  }
  if (profile.status === 'deleted') {
    throw createError({ statusCode: 409, statusMessage: 'Ce compte est déjà en cours de suppression.' })
  }

  // Évite le spam de demandes multiples pour le même compte : une demande
  // non traitée suffit, l'admin la voit déjà dans /admin/messages.
  const { data: existing } = await supabaseAdmin
    .from('contact_messages')
    .select('id')
    .eq('user_id', userId)
    .eq('request_type', 'account_deletion')
    .neq('status', 'archived')
    .limit(1)
    .maybeSingle()

  if (existing) {
    return { success: true, alreadyRequested: true }
  }

  const { error } = await supabaseAdmin.from('contact_messages').insert({
    full_name: profile.full_name || email || 'Utilisateur Tikeo',
    email: email || '',
    subject: 'Demande de suppression de compte',
    message: reason || 'Je souhaite supprimer définitivement mon compte Tikeo.',
    request_type: 'account_deletion',
    user_id: userId,
  })

  if (error) {
    throw createError({ statusCode: 500, statusMessage: "Impossible d'envoyer la demande pour le moment." })
  }

  return { success: true }
})
