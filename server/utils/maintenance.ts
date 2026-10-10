import { MAINTENANCE_OFF, type MaintenanceState } from '~/utils/maintenance'

/**
 * Lecture de l'état de maintenance côté serveur, avec un cache mémoire de
 * 15 s : le garde HTTP (server/middleware/maintenance.ts) s'exécute à chaque
 * requête de page et ne doit pas interroger la base à chaque fois.
 *
 * - Hébergement « serverless » (Vercel) : chaque instance a son propre cache,
 *   donc un changement d'état met au plus ~15 s à être vu partout.
 * - « Fail-open » : si la lecture échoue (table pas encore migrée, panne
 *   Supabase), on garde le dernier état connu — ou « ouvert » — plutôt que de
 *   fermer tout le site par erreur.
 */
const TTL_MS = 15_000
let cache: { at: number; state: MaintenanceState } | null = null

function fromRow(row: any): MaintenanceState {
  if (!row) return MAINTENANCE_OFF
  return {
    enabled: !!row.enabled,
    kind: row.kind === 'emergency' ? 'emergency' : 'planned',
    title: row.title || null,
    message: row.message || null,
    endsAt: row.ends_at || null,
    updatedAt: row.updated_at || null,
  }
}

export async function getMaintenanceState(force = false): Promise<MaintenanceState> {
  const now = Date.now()
  if (!force && cache && now - cache.at < TTL_MS) return cache.state

  let state: MaintenanceState
  try {
    const { data, error } = await (useSupabaseAdmin() as any)
      .from('site_maintenance')
      .select('enabled, kind, title, message, ends_at, updated_at')
      .eq('id', 1)
      .maybeSingle()
    if (error) throw error
    state = fromRow(data)
  } catch {
    state = cache?.state ?? MAINTENANCE_OFF
  }

  cache = { at: now, state }
  return state
}

/** Appelé juste après une modification par l'admin : effet immédiat sur cette instance. */
export function setMaintenanceCache(state: MaintenanceState) {
  cache = { at: Date.now(), state }
}

export { fromRow as maintenanceFromRow }
