<script setup lang="ts">
// Point d'entrée de l'espace organisateur (lien "Communauté" du header, etc.) :
// - pas connecté -> connexion, puis retour ici
// - connecté mais pas encore d'espace organisateur -> onboarding
// - déjà organisateur -> direction le tableau de bord
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()

const { fetchOrganizer } = useOrganizer()
const router = useRouter()
const checking = ref(true)

onMounted(async () => {
  const organizer = await fetchOrganizer()
  if (organizer) {
    router.replace('/organisateur/dashboard')
  } else {
    checking.value = false
  }
})
</script>

<template>
  <div v-if="checking" class="flex min-h-[60vh] items-center justify-center">
    <div class="h-8 w-8 animate-spin rounded-full border-2 border-tikeo-border border-t-tikeo-orange" />
  </div>
  <div v-else class="mx-auto flex max-w-2xl flex-col items-center gap-4 px-6 py-20 text-center">
    <img src="/logo-tikeo.png" alt="Tikeo" class="h-10 w-auto" />
    <h1 class="text-xl font-bold text-tikeo-black">{{ t('organizerOnboarding.title') }}</h1>
    <p class="text-sm text-tikeo-gray-text">{{ t('organizerOnboarding.description') }}</p>
    <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary mt-2">{{ t('organizerOnboarding.cta') }}</NuxtLink>
    <NuxtLink to="/organisateur/tarifs" class="text-xs font-semibold text-tikeo-orange">{{ t('organizerOnboarding.pricingLink') }}</NuxtLink>
  </div>
</template>
