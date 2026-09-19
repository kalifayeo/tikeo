<script setup lang="ts">
// Initialise la session utilisateur (si déjà connecté) au chargement de l'app,
// puis reste synchronisé avec Supabase Auth (connexion, déconnexion,
// rafraîchissement de token, clic sur un lien reçu par email).
const { fetchSession } = useAuth()
const authStore = useAuthStore()
const supabase = useSupabase()

onMounted(() => {
  fetchSession()
  supabase.auth.onAuthStateChange((_event, session) => {
    authStore.setUser(session?.user ?? null)
    if (session?.user) {
      authStore.fetchProfile()
    } else {
      authStore.profile = null
    }
  })
})

// Applique le thème clair/sombre dès le rendu serveur pour éviter tout flash.
const { theme } = useTheme()
useHead(() => ({
  htmlAttrs: { class: theme.value === 'dark' ? 'dark' : '' },
}))
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
