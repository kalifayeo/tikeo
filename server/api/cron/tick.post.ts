import { timingSafeEqual } from 'node:crypto'
import { sendTransactionalEmail } from '~/server/utils/brevo'
import { sendPushToSubscription } from '~/server/utils/webPush'
import { escapeHtml, safeInternalPath } from '~/server/utils/escapeHtml'

/**
 * POST /api/cron/tick — à appeler périodiquement (ex. Vercel Cron toutes les
 * 5 à 15 minutes) avec l'en-tête `Authorization: Bearer <CRON_SECRET>`.
 *
 * Fait, dans l'ordre :
 *   1. Libère les réservations de commande expirées (filet de sécurité : déjà
 *      fait paresseusement à chaque nouvelle commande, migration 0017/0031).
 *   2. Expire les places de liste d'attente non converties à temps, et les
 *      invitations de transfert de billet dépassées.
 *   3. Génère les rappels d'événement (24 h / 3 h avant, migration 0029).
 *   4. Réclame un lot de notifications à livrer (email et/ou push) et les
 *      envoie ; les abonnements push expirés (410/404) sont supprimés.
 *
 * Chaque étape est indépendante : l'échec de l'une n'empêche pas les autres.
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!config.cronSecret) {
    throw createError({ statusCode: 503, statusMessage: 'CRON_NOT_CONFIGURED' })
  }
  const auth = getHeader(event, 'authorization') || ''
  const expectedAuth = Buffer.from(`Bearer ${config.cronSecret}`)
  const givenAuth = Buffer.from(auth)
  if (givenAuth.length !== expectedAuth.length || !timingSafeEqual(givenAuth, expectedAuth)) {
    throw createError({ statusCode: 401, statusMessage: 'UNAUTHORIZED' })
  }

  const supabaseAdmin = useSupabaseAdmin()
  const result = {
    releasedOrders: 0,
    expiredWaitlist: 0,
    expiredTransfers: 0,
    remindersCreated: 0,
    notificationsClaimed: 0,
    emailsSent: 0,
    pushSent: 0,
    errors: [] as string[],
  }

  async function safe(label: string, fn: () => Promise<number>) {
    try {
      return await fn()
    } catch (e: any) {
      result.errors.push(`${label}: ${e?.message || e}`)
      return 0
    }
  }

  result.releasedOrders = await safe('release_expired_orders', async () => {
    const { data, error } = await supabaseAdmin.rpc('release_expired_orders')
    if (error) throw error
    return Number(data) || 0
  })

  result.expiredWaitlist = await safe('expire_waitlist_entries', async () => {
    const { data, error } = await supabaseAdmin.rpc('expire_waitlist_entries')
    if (error) throw error
    return Number(data) || 0
  })

  result.expiredTransfers = await safe('expire_ticket_transfers', async () => {
    const { data, error } = await supabaseAdmin.rpc('expire_ticket_transfers')
    if (error) throw error
    return Number(data) || 0
  })

  result.remindersCreated = await safe('generate_event_reminders', async () => {
    const { data, error } = await supabaseAdmin.rpc('generate_event_reminders')
    if (error) throw error
    return Number(data) || 0
  })

  // --- Livraison des notifications (email + push) ---------------------------
  try {
    const { data: batch, error } = await supabaseAdmin.rpc('claim_pending_notifications', { p_limit: 200 })
    if (error) throw error
    const rows = (batch ?? []) as Array<{
      id: string
      user_id: string
      title: string
      message: string
      link: string | null
      email_pending: boolean
      push_pending: boolean
    }>
    result.notificationsClaimed = rows.length

    for (const row of rows) {
      let emailOk = !row.email_pending
      let pushOk = !row.push_pending

      const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, notify_email')
        .eq('user_id', row.user_id)
        .maybeSingle()

      if (row.email_pending) {
        if (!profile?.email || profile.notify_email === false) {
          emailOk = true // pas d'adresse ou opt-out : rien à retenter
        } else {
          try {
            await sendTransactionalEmail({
              to: profile.email,
              toName: profile.full_name || profile.email,
              subject: row.title,
              htmlContent: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2 style="color:#B05400">${escapeHtml(row.title)}</h2>
                <p style="white-space:pre-line;color:#333">${escapeHtml(row.message)}</p>
                ${safeInternalPath(row.link) ? `<p><a href="${escapeHtml(getSiteOriginFromConfig(config))}${safeInternalPath(row.link)}" style="color:#B05400">Ouvrir sur Tikeo →</a></p>` : ''}
              </div>`,
            })
            emailOk = true
            result.emailsSent++
          } catch (e: any) {
            result.errors.push(`email ${row.id}: ${e?.message || e}`)
          }
        }
      }

      if (row.push_pending) {
        const { data: subs } = await supabaseAdmin
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', row.user_id)

        if (!subs || subs.length === 0) {
          pushOk = true // aucun appareil enregistré : rien à retenter
        } else {
          let anySent = false
          for (const sub of subs) {
            const ok = await sendPushToSubscription(sub as any, { title: row.title, body: row.message, url: row.link || undefined })
            if (ok) anySent = true
            else await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id)
          }
          pushOk = true // tenté sur tous les appareils connus ; pas de retry indéfini si l'un a échoué
          if (anySent) result.pushSent++
        }
      }

      await supabaseAdmin
        .from('notifications')
        .update({
          email_pending: !emailOk,
          push_pending: !pushOk,
          delivered_at: new Date().toISOString(),
          delivery_claimed_at: null,
        })
        .eq('id', row.id)
    }
  } catch (e: any) {
    result.errors.push(`notifications: ${e?.message || e}`)
  }

  return result
})

function getSiteOriginFromConfig(config: ReturnType<typeof useRuntimeConfig>): string {
  const root = config.public.rootDomain || 'tikeo.com'
  return `https://${root}`
}
