<script setup lang="ts">
// Initialise la session utilisateur (si déjà connecté) au chargement de l'app,
// puis reste synchronisé avec Supabase Auth (connexion, déconnexion,
// rafraîchissement de token, clic sur un lien reçu par email).
const { fetchSession } = useAuth()
const authStore = useAuthStore()
const supabase = useSupabase()

const { watchSystemTheme } = useTheme()

// Mises à jour en direct (notifications + favoris) sur TOUTES les pages et tous
// les layouts, sans rechargement : voir useMyNotifications / useFavorites.
useMyNotifications()
useFavorites()

onMounted(() => {
  watchSystemTheme()
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
// Préférences d'affichage (taille du texte, contraste, animations...) : voir
// composables/useUiPrefs.ts — appliquées aussi dès le rendu serveur.
const { htmlClasses } = useUiPrefs()
useHead(() => ({
  htmlAttrs: { class: [theme.value === 'dark' ? 'dark' : '', ...htmlClasses.value].filter(Boolean).join(' ') },
  // Écran de démarrage (components/SplashScreen.vue) : si déjà vu pendant cette
  // visite, on le masque AVANT le premier affichage pour éviter tout flash.
  script: [
    {
      innerHTML: "try{if(sessionStorage.getItem('tikeo:splash-seen')==='1')document.documentElement.setAttribute('data-splash-seen','')}catch(e){}",
      tagPosition: 'head',
    },
  ],
}))

// SEO par défaut (titre, description, Open Graph, canonical, noindex des
// zones privées) déduit de la route — voir composables/useRouteSeo.ts.
useRouteSeo()
</script>

<template>
  <!-- Logo plein écran à l'ouverture du site, avant la page d'accueil -->
  <SplashScreen />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <!-- Chargement entre les pages (connexion lente), bandeau hors connexion et toasts -->
  <NavigationLoader />
  <ToastHost />
  <!-- Consentement cookies : au niveau racine pour être présent sur toutes les zones -->
  <CookieBanner />
</template>
