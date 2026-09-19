// Réservé à l'administration Tikeo (cahier des charges §8.5, §41-44).
// Toute personne non connectée ou dont le profil n'a pas le rôle "admin"
// est redirigée — jamais de contenu admin rendu, même brièvement.
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

  if (authStore.role !== 'admin') {
    // Aide au diagnostic : si un compte censé être admin atterrit ici, la
    // cause est presque toujours que la colonne "role" du profil Supabase
    // n'est pas exactement 'admin' (ou que le profil n'a pas pu être chargé,
    // voir le message d'erreur éventuel juste au-dessus dans la console).
    console.warn(`[admin middleware] Accès refusé à ${to.fullPath} : rôle actuel = "${authStore.role}"`)
    return navigateTo('/')
  }
})
