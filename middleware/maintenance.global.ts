import type { MaintenanceState } from '~/utils/maintenance'

/**
 * Mode maintenance — navigation côté navigateur (complète le garde HTTP
 * server/middleware/maintenance.ts, qui, lui, ne voit que les chargements de
 * page complets, pas les changements de page internes de l'application).
 *
 * L'état est relu au plus toutes les 30 s ; si la lecture échoue on laisse
 * passer (le site ne doit jamais se fermer par accident).
 */
const OPEN_PREFIXES = ['/maintenance', '/connexion', '/mot-de-passe-oublie', '/admin', '/commande']
const CHECK_EVERY_MS = 30_000

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return // côté serveur : déjà géré par server/middleware/maintenance.ts
  if (OPEN_PREFIXES.some((p) => to.path === p || to.path.startsWith(p + '/'))) return

  const state = useState<MaintenanceState | null>('tikeo-maintenance', () => null)
  const checkedAt = useState<number>('tikeo-maintenance-checked-at', () => 0)

  if (!state.value || Date.now() - checkedAt.value > CHECK_EVERY_MS) {
    try {
      state.value = await $fetch<MaintenanceState>('/api/maintenance')
      checkedAt.value = Date.now()
    } catch {
      return
    }
  }
  if (!state.value?.enabled) return

  // Aperçu admin (cookie posé par layouts/admin.vue) : voir server/middleware/maintenance.ts.
  if (useCookie('tikeo_maint_bypass').value === '1') return

  return navigateTo('/maintenance')
})
