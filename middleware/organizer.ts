// Réservé aux organisateurs (et aux admins, qui peuvent tout superviser).
//
// Avant ce correctif : un acheteur connecté qui cliquait sur "Créer un
// événement" / "Publier un événement" (en-tête, bannière d'accueil) était
// renvoyé en silence vers "/" — aucune explication, ce qui donnait
// l'impression que le bouton ne faisait rien (surtout si l'utilisateur
// était déjà sur la page d'accueil).
//
// On le redirige maintenant vers /devenir-organisateur, qui explique la
// commission (paliers selon les ventes) puis active l'espace en un clic.
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

  if (!['organizer', 'admin'].includes(authStore.role)) {
    return navigateTo({ path: '/devenir-organisateur', query: { redirect: to.fullPath } })
  }
})
