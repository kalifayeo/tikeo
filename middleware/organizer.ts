// Réservé aux organisateurs (et aux admins, qui peuvent tout superviser).
//
// Avant ce correctif : un acheteur connecté qui cliquait sur "Créer un
// événement" / "Publier un événement" (en-tête, bannière d'accueil) était
// renvoyé en silence vers "/" — aucune explication, ce qui donnait
// l'impression que le bouton ne faisait rien (surtout si l'utilisateur
// était déjà sur la page d'accueil).
//
// On le redirige maintenant vers /organisateur/tarifs : la personne doit
// d'abord voir les formules et en choisir une elle-même avant de pouvoir
// activer son espace organisateur (cf. pages/organisateur/tarifs/index.vue
// et pages/devenir-organisateur/index.vue, qui refuse désormais l'activation
// tant qu'aucune formule n'a été choisie).
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
    return navigateTo({ path: '/organisateur/tarifs', query: { redirect: to.fullPath } })
  }
})
