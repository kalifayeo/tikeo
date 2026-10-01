<script setup lang="ts">
// Avant ce correctif, "Créer un événement" (en-tête et bannière d'accueil)
// pointait directement vers /organisateur/evenements/nouveau, réservée aux
// organisateurs (middleware `organizer`) : un acheteur connecté cliquait
// dessus et se retrouvait silencieusement renvoyé vers l'accueil, sans
// aucune explication. Le middleware redirige désormais vers
// /organisateur/tarifs en premier lieu, puis ici une fois une formule
// choisie : cette page explique la situation et active l'espace
// organisateur (voir composables/useOrganizer.ts + /api/account/become-organizer).
//
// Cette page activait auparavant l'espace organisateur en un clic, sans
// jamais faire choisir de formule tarifaire — n'importe qui pouvait devenir
// organisateur et publier sans même savoir quelle commission s'appliquerait.
// La formule est désormais choisie sur /organisateur/tarifs (seul point
// d'entrée : voir middleware/organizer.ts) et transmise ici via `?plan=...` ;
// sans formule valide dans l'URL, on renvoie systématiquement vers la page
// de tarifs plutôt que de laisser activer un espace organisateur "à l'aveugle".
definePageMeta({ middleware: 'auth' })

const VALID_PLANS = ['decouverte', 'essentiel', 'pro', 'business'] as const
type Plan = (typeof VALID_PLANS)[number]

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { profile } = useAuth()
const authStore = useAuthStore()
const { organizer, loading, error, fetchOrganizer, ensureOrganizer } = useOrganizer()

const activating = ref(false)
const checkedExisting = ref(false)

// Où renvoyer une fois organisateur (le lien d'origine si on vient bien du
// middleware, sinon l'assistant de création par défaut).
const redirectTarget = computed(() => {
  const target = route.query.redirect
  return typeof target === 'string' && target.startsWith('/organisateur') ? target : '/organisateur/evenements/nouveau'
})

const selectedPlan = computed<Plan | null>(() => {
  const plan = route.query.plan
  return typeof plan === 'string' && (VALID_PLANS as readonly string[]).includes(plan) ? (plan as Plan) : null
})

const planLabels: Record<Plan, string> = {
  decouverte: t('organizerPricingPage.discoveryName'),
  essentiel: t('organizerPricingPage.essentialName'),
  pro: t('organizerPricingPage.proName'),
  business: t('organizerPricingPage.businessName'),
}
const planCommissions: Record<Plan, string> = {
  decouverte: t('organizerPricingPage.discoveryCommission'),
  essentiel: t('organizerPricingPage.essentialCommission'),
  pro: t('organizerPricingPage.proCommission'),
  business: t('organizerPricingPage.businessCommission'),
}

function tarifsRedirect() {
  return { path: '/organisateur/tarifs', query: route.query.redirect ? { redirect: route.query.redirect } : undefined }
}

onMounted(async () => {
  // Déjà organisateur/admin (ex. lien direct après une promotion récente) :
  // pas besoin d'expliquer quoi que ce soit, on renvoie directement.
  if (['organizer', 'admin'].includes(authStore.role)) {
    return router.replace(redirectTarget.value)
  }
  await fetchOrganizer()
  checkedExisting.value = true

  // Pas encore de demande ET aucune formule valide dans l'URL : la personne
  // est arrivée ici directement (lien partagé, favori, etc.) sans passer par
  // la page de tarifs. On l'y renvoie plutôt que de la laisser activer un
  // espace organisateur sans avoir vu ni choisi de formule.
  if (!organizer.value && !selectedPlan.value) {
    return router.replace(tarifsRedirect())
  }
})

async function activate() {
  if (!selectedPlan.value) return
  activating.value = true
  try {
    await ensureOrganizer(selectedPlan.value)
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
      <div class="mt-4 flex items-center justify-between gap-3 border border-tikeo-border bg-tikeo-surface-alt px-4 py-3 text-sm">
        <span class="text-tikeo-gray-text">{{ t('becomeOrganizer.currentPlanLabel') }}</span>
        <span class="font-semibold text-tikeo-black">{{ planLabels[organizer.plan] }} · {{ planCommissions[organizer.plan] }}</span>
      </div>
      <NuxtLink v-if="organizer.status === 'pending'" :to="tarifsRedirect()" class="mt-3 inline-block text-xs font-semibold text-tikeo-orange hover:underline">
        {{ t('becomeOrganizer.changePlan') }}
      </NuxtLink>
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

      <div v-if="selectedPlan" class="mt-6 flex items-center justify-between gap-3 border border-tikeo-orange bg-tikeo-orange/5 px-4 py-3">
        <div>
          <p class="text-xs text-tikeo-gray-text">{{ t('becomeOrganizer.selectedPlanLabel') }}</p>
          <p class="font-semibold text-tikeo-black">{{ planLabels[selectedPlan] }} · {{ planCommissions[selectedPlan] }}</p>
        </div>
        <NuxtLink :to="tarifsRedirect()" class="shrink-0 text-xs font-semibold text-tikeo-orange hover:underline">{{ t('becomeOrganizer.changePlan') }}</NuxtLink>
      </div>

      <p v-if="error" class="mt-6 border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-600">{{ error }}</p>

      <button type="button" class="btn-primary mt-6 !px-6 !py-3" :disabled="activating || loading || !selectedPlan" @click="activate">
        {{ activating ? t('becomeOrganizer.activating') : t('becomeOrganizer.cta') }}
      </button>
    </template>
  </div>
</template>
