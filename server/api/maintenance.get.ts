import { getMaintenanceState } from '~/server/utils/maintenance'

/**
 * GET /api/maintenance — état public du mode maintenance (la page
 * /maintenance et le middleware de navigation s'en servent). Ne contient rien
 * de sensible : activé ou non, type, textes affichés, retour estimé.
 */
export default defineEventHandler(async (event) => {
  setResponseHeader(event, 'Cache-Control', 'no-store')
  return await getMaintenanceState()
})
