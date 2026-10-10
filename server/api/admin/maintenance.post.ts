import { requireCsrf } from '~/server/utils/csrf'
import { getMaintenanceState, maintenanceFromRow, setMaintenanceCache } from '~/server/utils/maintenance'

/**
 * POST /api/admin/maintenance
 * Active / désactive le mode maintenance et met à jour ses textes.
 * Réservé aux admins porteurs de la permission `settings.manage` (même
 * contrôle que les autres routes /api/admin : jeton vérifié par Supabase,
 * rôle relu en base, 2FA exigée, CSRF).
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)

  const body = await readBody<{ enabled?: unknown; kind?: unknown; title?: unknown; message?: unknown; endsAt?: unknown }>(event)

  if (typeof body.enabled !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: "Le champ « enabled » est obligatoire (true/false)." })
  }
  const kind = body.kind === 'emergency' ? 'emergency' : body.kind === 'planned' || body.kind == null ? 'planned' : null
  if (!kind) throw createError({ statusCode: 400, statusMessage: 'Type de maintenance invalide.' })

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const message = typeof body.message === 'string' ? body.message.trim() : ''
  if (title.length > 120) throw createError({ statusCode: 400, statusMessage: 'Titre trop long (120 caractères maximum).' })
  if (message.length > 600) throw createError({ statusCode: 400, statusMessage: 'Message trop long (600 caractères maximum).' })

  let endsAt: string | null = null
  if (body.endsAt) {
    const d = new Date(String(body.endsAt))
    if (Number.isNaN(d.getTime())) throw createError({ statusCode: 400, statusMessage: 'Date de retour estimé invalide.' })
    endsAt = d.toISOString()
  }

  const { adminUserId } = await requirePermission(event, 'settings.manage')

  const before = await getMaintenanceState(true)
  const supabaseAdmin = useSupabaseAdmin() as any

  const { data, error } = await supabaseAdmin
    .from('site_maintenance')
    .update({
      enabled: body.enabled,
      kind,
      title: title || null,
      message: message || null,
      ends_at: endsAt,
      updated_at: new Date().toISOString(),
      updated_by: adminUserId,
    })
    .eq('id', 1)
    .select('enabled, kind, title, message, ends_at, updated_at')
    .maybeSingle()

  if (error || !data) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Impossible d'enregistrer la maintenance" +
        (error?.message ? ` : ${error.message}` : ' (la migration 0039_site_maintenance.sql a-t-elle été exécutée ?).'),
    })
  }

  const state = maintenanceFromRow(data)
  setMaintenanceCache(state)

  // Journal d'audit (best-effort : ne bloque jamais l'action).
  try {
    const action = state.enabled && !before.enabled ? 'maintenance.enable' : !state.enabled && before.enabled ? 'maintenance.disable' : 'maintenance.update'
    await supabaseAdmin.rpc('log_admin_action', {
      p_user_id: adminUserId,
      p_action: action,
      p_entity_type: 'site_maintenance',
      p_entity_id: null,
      p_metadata: { kind: state.kind, ends_at: state.endsAt },
      p_ip_address: getRequestIP(event, { xForwardedFor: true }) || null,
    })
  } catch {
    /* non bloquant */
  }

  return { maintenance: state }
})
