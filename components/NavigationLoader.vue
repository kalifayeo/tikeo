<script setup lang="ts">
/**
 * Indicateur de chargement ENTRE les pages — le même esprit que l'écran de
 * démarrage de l'app (logo + loader orange), mais déclenché quand le passage
 * d'une page à l'autre prend du temps (connexion lente, gros écran à charger).
 *
 *  - navigation rapide (< 450 ms) : rien d'autre que la fine barre orange en haut ;
 *  - au-delà : voile + logo + loader orange « Chargement… » ;
 *  - connexion détectée lente (2G/3G/économie de données) ou attente > 4 s :
 *    message « La connexion est lente… » ;
 *  - attente > 10 s : bouton « Réessayer » (recharge la page visée) ;
 *  - hors connexion : bandeau permanent, puis « Connexion rétablie ».
 */
const { t } = useI18n()
const nuxtApp = useNuxtApp()
const router = useRouter()

const SHOW_AFTER_MS = 450
const SLOW_AFTER_MS = 4000
const RETRY_AFTER_MS = 10000

const pending = ref(false)
const slow = ref(false)
const canRetry = ref(false)
const online = ref(true)
const justBackOnline = ref(false)
const targetPath = ref('')

let tShow: ReturnType<typeof setTimeout> | null = null
let tSlow: ReturnType<typeof setTimeout> | null = null
let tRetry: ReturnType<typeof setTimeout> | null = null
let tBack: ReturnType<typeof setTimeout> | null = null

function clearTimers() {
  for (const x of [tShow, tSlow, tRetry]) if (x) clearTimeout(x)
  tShow = tSlow = tRetry = null
}

function poorConnection(): boolean {
  const c = (navigator as any).connection
  if (!c) return false
  return c.saveData === true || ['slow-2g', '2g', '3g'].includes(c.effectiveType) || (typeof c.rtt === 'number' && c.rtt > 900)
}

function start() {
  if (nuxtApp.isHydrating) return
  clearTimers()
  slow.value = false
  canRetry.value = false
  tShow = setTimeout(() => {
    pending.value = true
    if (poorConnection() || !online.value) slow.value = true
  }, SHOW_AFTER_MS)
  tSlow = setTimeout(() => (slow.value = true), SLOW_AFTER_MS)
  tRetry = setTimeout(() => (canRetry.value = true), RETRY_AFTER_MS)
}

function stop() {
  clearTimers()
  pending.value = false
  slow.value = false
  canRetry.value = false
}

function retry() {
  // Recharge complètement la page visée : repart d'une connexion neuve.
  window.location.assign(targetPath.value || window.location.href)
}

function onOffline() {
  online.value = false
  justBackOnline.value = false
  if (tBack) clearTimeout(tBack)
}
function onOnline() {
  online.value = true
  justBackOnline.value = true
  tBack = setTimeout(() => (justBackOnline.value = false), 2600)
}

onMounted(() => {
  online.value = navigator.onLine
  nuxtApp.hook('page:loading:start', start)
  nuxtApp.hook('page:loading:end', stop)
  router.beforeEach((to) => {
    targetPath.value = to.fullPath
  })
  window.addEventListener('offline', onOffline)
  window.addEventListener('online', onOnline)
})

onBeforeUnmount(() => {
  clearTimers()
  if (tBack) clearTimeout(tBack)
  if (import.meta.client) {
    window.removeEventListener('offline', onOffline)
    window.removeEventListener('online', onOnline)
  }
})
</script>

<template>
  <!-- Fine barre de progression orange → bleu, tout en haut -->
  <NuxtLoadingIndicator color="linear-gradient(90deg, #FF7A00 0%, #FF9A3D 55%, #0057B8 100%)" :height="3" :throttle="150" />

  <!-- Bandeau connexion -->
  <Transition name="navl-banner">
    <div
      v-if="!online || justBackOnline"
      class="fixed inset-x-0 top-0 z-[9400] flex items-center justify-center gap-2 px-4 py-2 text-center text-[13px] font-bold"
      :class="online ? 'bg-tikeo-success text-white' : 'bg-tikeo-ink text-white'"
      role="status"
    >
      <AppIcon :name="online ? 'check-circle' : 'alert'" class="h-4 w-4" :stroke="2.4" />
      {{ online ? t('navLoader.backOnline') : t('navLoader.offline') }}
    </div>
  </Transition>

  <!-- Voile de chargement entre deux pages -->
  <Transition name="navl">
    <div v-if="pending" class="navl fixed inset-0 z-[9000] flex flex-col items-center justify-center gap-5 px-6 text-center" role="alert" aria-live="polite">
      <img src="/logo-tikeo.png" alt="" class="navl__logo h-auto w-[min(150px,42vw)]" width="720" height="232" decoding="async" />
      <TikeoSpinner :size="34" />
      <div class="min-h-[3.25rem] max-w-xs">
        <p class="text-sm font-bold text-tikeo-black">{{ slow ? t('navLoader.slowTitle') : t('navLoader.loading') }}</p>
        <p v-if="slow" class="mt-1 text-xs leading-relaxed text-tikeo-gray-text">{{ t('navLoader.slowText') }}</p>
      </div>
      <button v-if="canRetry" type="button" class="btn-ink !h-11 !px-6" @click="retry">
        <AppIcon name="refresh" class="h-4 w-4" :stroke="2.4" />
        {{ t('navLoader.retry') }}
      </button>
    </div>
  </Transition>
</template>

<style scoped>
.navl {
  background: rgb(var(--tikeo-surface) / 0.82);
  -webkit-backdrop-filter: blur(6px);
  backdrop-filter: blur(6px);
}
.navl__logo {
  animation: navl-pulse 1.6s ease-in-out infinite;
}
@keyframes navl-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(0.97); }
}
.navl-enter-active,
.navl-leave-active {
  transition: opacity 0.3s ease;
}
.navl-enter-from,
.navl-leave-to {
  opacity: 0;
}
.navl-banner-enter-active,
.navl-banner-leave-active {
  transition: transform 0.3s var(--ease-tikeo);
}
.navl-banner-enter-from,
.navl-banner-leave-to {
  transform: translateY(-100%);
}
</style>
