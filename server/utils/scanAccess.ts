import type { H3Event } from 'h3'

/**
 * Contrôle d'accès du scanner : seul le propriétaire de l'événement, un agent
 * actif de cet événement (table event_agents) ou un admin peut valider des
 * billets. Vérifié ICI, côté serveur — jamais sur la seule foi de l'interface.
 */
export async function requireScanAccess(event: H3Event, userId: string, eventId: string) {
  const admin = useSupabaseAdmin()

  const { data: ev } = await admin.from('events').select('id, title, slug, organizer_id, start_date, end_date, status').eq('id', eventId).maybeSingle()
  if (!ev) throw createError({ statusCode: 404, statusMessage: 'EVENT_NOT_FOUND' })

  const { data: profile } = await admin.from('profiles').select('role').eq('user_id', userId).maybeSingle()
  if (profile?.role === 'admin') return { admin, ev }

  const { data: organizer } = await admin.from('organizers').select('id').eq('id', ev.organizer_id).eq('user_id', userId).maybeSingle()
  if (organizer) return { admin, ev }

  const { data: agent } = await admin.from('event_agents').select('id').eq('event_id', eventId).eq('user_id', userId).eq('status', 'active').maybeSingle()
  if (agent) return { admin, ev }

  throw createError({ statusCode: 403, statusMessage: 'FORBIDDEN' })
}
