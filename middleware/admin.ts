// Réservé à l'administration Tikeo (cahier des charges §8.5, §41-44).
// Toute personne non connectée ou dont le profil n'a pas le rôle "admin"
// est redirigée — jamais de contenu admin rendu, même brièvement.
//
// RBAC (migration 0021) : une page peut en plus déclarer
// `definePageMeta({ adminPermission: 'events.view' })` pour n'être
// accessible qu'aux rôles admin porteurs de cette permission (ou au Super
// Admin). Ce filtrage est un confort d'interface — la véritable barrière
// est la RLS/les triggers côté base, qui refusent de toute façon la
// moindre lecture/écriture sans la permission correspondante.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const authStore = useAuthStore()
  if (!authStore.user) {
    await authStore.fetchSession()
  }

  if (!authStore.user) {
    return navigateTo({ path: '/connexion', query: { redirect: to.fullPath } })
  }

  if (authStore.profile === null) {
    await authStore.fetchProfile()
  }

  // fetchProfile() déconnecte immédiatement un compte suspendu (y compris un
  // admin — cf. stores/authStore.ts) : si la session vient de disparaître,
  // c'est le cas ici.
  if (!authStore.user) {
    return navigateTo({ path: '/connexion', query: { redirect: to.fullPath } })
  }

  if (authStore.role !== 'admin') {
    // Aide au diagnostic : si un compte censé être admin atterrit ici, la
    // cause est presque toujours que la colonne "role" du profil Supabase
    // n'est pas exactement 'admin' (ou que le profil n'a pas pu être chargé,
    // voir le message d'erreur éventuel juste au-dessus dans la console).
    console.warn(`[admin middleware] Accès refusé à ${to.fullPath} : rôle actuel = "${authStore.role}"`)
    return navigateTo('/')
  }

  if (authStore.adminContext === null) {
    await authStore.fetchAdminContext()
  }

  const requiredPermission = to.meta.adminPermission as string | string[] | undefined
  if (requiredPermission) {
    const required = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission]
    const allowed = authStore.isSuperAdmin || required.some((key) => authStore.hasPermission(key as any))
    if (!allowed) {
      console.warn(`[admin middleware] Accès refusé à ${to.fullPath} : permission manquante (${required.join(', ')}).`)
      return navigateTo('/admin')
    }
  }
})
