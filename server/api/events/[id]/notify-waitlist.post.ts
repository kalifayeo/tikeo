import { requireUser } from '~/server/utils/userAuth'
import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'
import { sendTransactionalEmail } from '~/server/utils/brevo'
import { getSiteOrigin } from '~/server/utils/siteOrigin'

/**
 * POST /api/events/:id/notify-waitlist — prévient par email tous les
 * inscrits à la liste d'attente d'un événement (« des billets pourraient
 * être de nouveau disponibles »).
 *
 * Déclenché à la main par l'organisateur (ou l'admin), pas automatiquement
 * à chaque billet libéré — voir la note dans la migration 0031_waitlist.sql.
 * N'importe qui d'autre que le propriétaire de l'événement (ou un admin)
 * se voit refuser l'accès : vérifié ici, pas seulement côté interface.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { userId } = await requireUser(event)
  await checkRateLimit(event, { key: 'waitlist-notify', max: 10, windowMs: 60 * 60 * 1000 })

  const eventId = getRouterParam(event, 'id')
  if (!eventId) throw createError({ statusCode: 400, statusMessage: 'INVALID_EVENT' })

  const supabaseAdmin = useSupabaseAdmin()

  const { data: ev, error: evErr } = await supabaseAdmin.from('events').select('id, title, slug, organizer_id').eq('id', eventId).maybeSingle()
  if (evErr || !ev) throw createError({ statusCode: 404, statusMessage: 'EVENT_NOT_FOUND' })

  const { data: profile } = await supabaseAdmin.from('profiles').select('role').eq('user_id', userId).maybeSingle()
  const isAdmin = profile?.role === 'admin'
  if (!isAdmin) {
    const { data: organizer } = await supabaseAdmin.from('organizers').select('id').eq('id', ev.organizer_id).eq('user_id', userId).maybeSingle()
    if (!organizer) throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })
  }

  const { data: entries, error: entriesErr } = await supabaseAdmin
    .from('waitlist_entries')
    .select('id, email, notified_count')
    .eq('event_id', eventId)
  if (entriesErr) throw createError({ statusCode: 500, statusMessage: 'LOAD_FAILED' })
  if (!entries?.length) return { notified: 0 }

  const eventUrl = `${getSiteOrigin(event)}/e/${ev.slug}`
  const subject = `Des billets sont peut-être disponibles pour « ${ev.title} »`
  const htmlContent = `
    <div style="font-family:Poppins,Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px;color:#111;">
      <h2 style="margin:0 0 12px;font-size:18px;">Bonne nouvelle !</h2>
      <p style="margin:0 0 16px;font-size:14px;line-height:1.6;">
        Des billets pour <strong>${ev.title}</strong> pourraient être de nouveau disponibles.
        Vous vous étiez inscrit(e) sur la liste d'attente : c'est le moment d'y retourner, les places sont limitées et proposées au premier arrivé.
      </p>
      <a href="${eventUrl}" style="display:inline-block;background:#FF7A00;color:#fff;padding:12px 24px;text-decoration:none;font-weight:600;font-size:14px;">Voir l'événement</a>
      <p style="margin:20px 0 0;font-size:12px;color:#888;">Si les billets sont de nouveau épuisés à votre arrivée, vous restez inscrit(e) sur la liste d'attente.</p>
    </div>
  `

  let notified = 0
  const notifiedAt = new Date().toISOString()
  for (const entry of entries) {
    try {
      await sendTransactionalEmail({ to: entry.email, subject, htmlContent })
      notified++
      await supabaseAdmin
        .from('waitlist_entries')
        .update({ status: 'notified', notified_at: notifiedAt, notified_count: (entry.notified_count ?? 0) + 1 })
        .eq('id', entry.id)
    } catch (e) {
      console.error('[api/notify-waitlist] échec envoi à', entry.email, e)
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action: 'WAITLIST_NOTIFIED',
    entity_type: 'events',
    entity_id: eventId,
    metadata: { count: notified, title: ev.title },
  })

  return { notified }
})
