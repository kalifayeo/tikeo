<script setup lang="ts">
/**
 * Invitation à installer Tikeo sur l'écran d'accueil.
 *  - Android / Chrome / Edge : bouton natif d'installation.
 *  - iPhone / iPad (Safari) : pas d'API d'installation, on explique le geste
 *    « Partager → Sur l'écran d'accueil ».
 * Discret : jamais avant que l'introduction ait été vue, jamais si déjà
 * installé ou refusé récemment (14 jours).
 */
const { t } = useI18n()
const installEvent = useState<any>('tikeo-pwa-install-event', () => null)
const installed = useState<boolean>('tikeo-pwa-installed', () => false)

const DISMISS_KEY = 'tikeo:install-dismissed'
const DISMISS_DAYS = 14

const visible = ref(false)
const ios = ref(false)

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return at && Date.now() - at < DISMISS_DAYS * 86400000
  } catch {
    return false
  }
}
function isStandalone() {
  return window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true
}
function introSeen() {
  try {
    return localStorage.getItem('tikeo:intro-done:v1') === '1'
  } catch {
    return false
  }
}

function evaluate() {
  if (installed.value || isStandalone() || recentlyDismissed() || !introSeen()) return
  ios.value = /iphone|ipad|ipod/i.test(navigator.userAgent) && !(window as any).MSStream
  visible.value = !!installEvent.value || ios.value
}

onMounted(() => {
  // Attend que le visiteur ait eu le temps de découvrir le site.
  setTimeout(evaluate, 25000)
})
watch(installEvent, () => visible.value && evaluate())

function dismiss() {
  visible.value = false
  try {
    localStorage.setItem(DISMISS_KEY, String(Date.now()))
  } catch {
    /* ignoré */
  }
}

async function install() {
  const ev = installEvent.value
  if (!ev) return
  ev.prompt()
  const choice = await ev.userChoice.catch(() => null)
  installEvent.value = null
  if (choice?.outcome === 'accepted') visible.value = false
  else dismiss()
}
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-6 opacity-0"
    leave-active-class="transition duration-200 ease-in"
    leave-to-class="translate-y-6 opacity-0"
  >
    <div
      v-if="visible"
      class="fixed inset-x-3 bottom-24 z-[80] border border-tikeo-border bg-tikeo-surface p-4 shadow-card-hover md:inset-x-auto md:bottom-4 md:left-4 md:w-96"
      role="dialog"
      :aria-label="t('pwa.title')"
    >
      <div class="flex items-start gap-3">
        <!-- Icône dessinée en SVG (aucun fichier image à charger : s'affiche toujours) -->
        <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-brand text-white" aria-hidden="true">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" />
            <path stroke-linecap="round" stroke-linejoin="round" d="M10 9.5v5M14 9.5v5" />
          </svg>
        </span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-tikeo-black">{{ t('pwa.title') }}</p>
          <p class="mt-0.5 text-xs leading-relaxed text-tikeo-gray-text">{{ ios ? t('pwa.iosIntro') : t('pwa.body') }}</p>
        </div>
        <button type="button" class="-mr-1 -mt-1 p-1 text-tikeo-gray-text hover:text-tikeo-black" :aria-label="t('common.close')" @click="dismiss">
          <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- iPhone / iPad : pas d'installation en un clic possible, on guide pas à pas -->
      <ol v-if="ios" class="mt-3 space-y-2 border-t border-tikeo-border pt-3 text-xs text-tikeo-black">
        <li class="flex items-center gap-2.5">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center bg-tikeo-orange text-[11px] font-bold text-white">1</span>
          <span>{{ t('pwa.iosStep1') }}</span>
        </li>
        <li class="flex items-center gap-2.5">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center bg-tikeo-orange text-[11px] font-bold text-white">2</span>
          <span class="flex items-center gap-1.5">
            {{ t('pwa.iosStep2') }}
            <svg class="h-5 w-5 shrink-0 text-tikeo-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 3v12m0-12l-4 4m4-4l4 4M6 11H5a1 1 0 00-1 1v8a1 1 0 001 1h14a1 1 0 001-1v-8a1 1 0 00-1-1h-1" />
            </svg>
          </span>
        </li>
        <li class="flex items-center gap-2.5">
          <span class="flex h-6 w-6 shrink-0 items-center justify-center bg-tikeo-orange text-[11px] font-bold text-white">3</span>
          <span class="flex items-center gap-1.5">
            {{ t('pwa.iosStep3') }}
            <svg class="h-5 w-5 shrink-0 text-tikeo-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <rect x="4" y="4" width="16" height="16" rx="3" /><path stroke-linecap="round" d="M12 8.5v7M8.5 12h7" />
            </svg>
          </span>
        </li>
      </ol>

      <div class="mt-3 flex items-center gap-3">
        <button v-if="!ios" type="button" class="btn-primary !px-4 !py-2 text-xs" @click="install">{{ t('pwa.install') }}</button>
        <button
          type="button"
          class="text-xs font-semibold"
          :class="ios ? 'btn-primary !px-4 !py-2' : 'text-tikeo-gray-text hover:text-tikeo-orange'"
          @click="dismiss"
        >
          {{ ios ? t('pwa.gotIt') : t('pwa.notNow') }}
        </button>
      </div>
    </div>
  </Transition>
</template>
