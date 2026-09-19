// Réservé aux organisateurs (et aux admins, qui peuvent tout superviser).
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
    return navigateTo('/')
  }
})
