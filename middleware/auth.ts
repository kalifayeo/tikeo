// Protège une page : redirige vers /connexion si personne n'est connecté.
// L'auth Supabase est gérée côté client (plugin .client.ts) : sur le tout
// premier chargement (SSR ou hard refresh), la session n'est pas encore
// résolue, donc on l'attend explicitement ici avant de trancher.
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const authStore = useAuthStore()
  if (!authStore.user) {
    await authStore.fetchSession()
  }

  if (!authStore.user) {
    return navigateTo({ path: '/connexion', query: { redirect: to.fullPath } })
  }
})
