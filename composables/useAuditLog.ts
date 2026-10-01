/**
 * Écrit une entrée dans le journal d'audit (table `audit_logs`, migration
 * 0001). Utilisé par les pages/composables admin pour tracer les actions
 * sensibles (rôles, suspensions, sécurité...).
 *
 * Best-effort et jamais bloquant : un journal qui ne s'écrit pas ne doit
 * jamais empêcher l'action elle-même de réussir.
 */
export async function writeAuditLog(input: { action: string; entityType: string; entityId?: string | null; metadata?: Record<string, unknown> }) {
  try {
    const supabase = useSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    })
  } catch {
    /* non bloquant */
  }
}
