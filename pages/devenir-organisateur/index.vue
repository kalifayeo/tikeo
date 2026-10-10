<script setup lang="ts">
// Activation de l'espace organisateur. Il n'y a plus de forfait à choisir :
// la commission Tikeo dépend des ventes cumulées de l'organisateur (paliers,
// voir /organisateur/tarifs et migration 0047). Cette page explique le
// principe puis active l'espace en un clic
// (cf. composables/useOrganizer.ts + /api/account/become-organizer).
definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { profile } = useAuth()
const authStore = useAuthStore()
const { organizer, loading, error, fetchOrganizer, ensureOrganizer } = useOrganizer()
const { tiers, fetchTiers } = useCommission()

const activating = ref(false)
const checkedExisting = ref(false)

const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/organisateur') ? target : '/organisateur/evenements/nouveau'
})

const rateRange = computed(() => {
  const rates = tiers.value.map((x) => x.rate)
  return { max: Math.max(...rates), min: Math.min(...rates) }
})
const fmtRate = (n: number) => String(n).replace('.', ',')

onMounted(async () => {
  if (['organizer', 'admin'].includes(authStore.role)) {
    return router.replace(redirectTarget.value)
  }
  await Promise.all([fetchOrganizer(), fetchTiers()])
  checkedExisting.value = true
})

async function activate() {
  activating.value = true
  try {
    await ensureOrganizer()
    await router.push(redirectTarget.value)
  } catch {
    // error.value (du composable) affiche déjà le message à l'écran.
  } finally {
    activating.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-12 md:px-6">
    <div v-if="!checkedExisting" class="space-y-3">
      <div class="h-8 w-2/3 animate-pulse bg-tikeo-surface-alt" />
      <div class="h-24 animate-pulse bg-tikeo-surface-alt" />
    </div>

    <!-- Une demande existe déjà (statut informatif géré côté admin) -->
    <template v-else-if="organizer">
      <h1 class="text-2xl font-extrabold text-tikeo-black">{{ t('becomeOrganizer.pendingTitle') }}</h1>
      <p class="mt-3 text-sm text-tikeo-gray-text">{{ t('becomeOrganizer.pendingText') }}</p>
      <div class="mt-6">
        <NuxtLink to="/organisateur" class="btn-secondary inline-flex">{{ t('becomeOrganizer.goToSpace') }}</NuxtLink>
      </div>
    </template>

    <!-- Pas encore d'espace organisateur : explication + activation en un clic -->
    <template v-else>
      <h1 class="text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ t('becomeOrganizer.title') }}</h1>
      <p class="mt-3 text-sm text-tikeo-gray-text md:text-base">{{ t('becomeOrganizer.intro', { name: profile?.full_name || '' }) }}</p>

      <ul class="mt-6 space-y-3 text-sm text-tikeo-black">
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 h-5 w-5 shrink-0 bg-tikeo-orange/15 text-center text-xs font-bold leading-5 text-tikeo-orange">1</span>
          {{ t('becomeOrganizer.step1') }}
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 h-5 w-5 shrink-0 bg-tikeo-orange/15 text-center text-xs font-bold leading-5 text-tikeo-orange">2</span>
          {{ t('becomeOrganizer.step2') }}
        </li>
        <li class="flex items-start gap-2.5">
          <span class="mt-0.5 h-5 w-5 shrink-0 bg-tikeo-orange/15 text-center text-xs font-bold leading-5 text-tikeo-orange">3</span>
          {{ t('becomeOrganizer.step3') }}
        </li>
      </ul>

      <div class="mt-6 border border-tikeo-orange bg-tikeo-orange/5 px-4 py-3 text-sm text-tikeo-black">
        <p class="font-semibold">{{ t('becomeOrganizer.commissionTitle') }}</p>
        <p class="mt-1 text-tikeo-gray-text">
          {{ t('becomeOrganizer.commissionText', { max: fmtRate(rateRange.max), min: fmtRate(rateRange.min) }) }}
          <NuxtLink to="/organisateur/tarifs" class="font-semibold text-tikeo-orange hover:underline">{{ t('becomeOrganizer.seeRates') }}</NuxtLink>
        </p>
      </div>

      <p v-if="error" class="mt-6 border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{{ error }}</p>

      <button type="button" class="btn-primary mt-6 !px-6 !py-3" :disabled="activating || loading" @click="activate">
        {{ activating ? t('becomeOrganizer.activating') : t('becomeOrganizer.cta') }}
      </button>
    </template>
  </div>
</template>
