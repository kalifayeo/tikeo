<script setup lang="ts">
/**
 * Chef d'orchestre des trois expériences, dans l'ordre :
 *   1. Introduction (1re visite sur l'appareil)
 *   2. Visite guidée des boutons du header (1re visite sur l'appareil)
 *   3. Pop-up d'annonce (selon sa fréquence, sa période et son public)
 * Une seule chose s'affiche à la fois. Monté dans layouts/default.vue : rien
 * de tout cela n'apparaît dans l'admin, l'espace organisateur ni les pages
 * de connexion.
 */
import type { OnboardingSlide, Popup, TourStep } from '~/types/database'
import { fetchEngagementContent, useDeviceEngagementState, type EngagementPhase } from '~/composables/useEngagement'

const authStore = useAuthStore()
const route = useRoute()
const device = useDeviceEngagementState()

const phase = ref<EngagementPhase>('idle')
const slides = ref<OnboardingSlide[]>([])
const steps = ref<TourStep[]>([])
const popups = ref<Popup[]>([])
const popup = ref<Popup | null>(null)

// Pas de pop-up au milieu d'un paiement ou d'une authentification.
const QUIET_ROUTES = ['/connexion', '/inscription', '/paiement', '/commande', '/checkout', '/mot-de-passe']
const isQuietRoute = () => QUIET_ROUTES.some((p) => route.path.startsWith(p))

function pickPopup(): Popup | null {
  const loggedIn = !!authStore.user
  return (
    popups.value.find((p) => {
      if (p.audience === 'visitors' && loggedIn) return false
      if (p.audience === 'members' && !loggedIn) return false
      const now = Date.now()
      if (p.starts_at && new Date(p.starts_at).getTime() > now) return false
      if (p.ends_at && new Date(p.ends_at).getTime() <= now) return false
      return device.shouldShowPopup(p)
    }) ?? null
  )
}

function goPopup() {
  if (isQuietRoute()) {
    phase.value = 'done'
    return
  }
  popup.value = pickPopup()
  phase.value = popup.value ? 'popup' : 'done'
}

function goTour() {
  if (device.tourDone() || !steps.value.length) return goPopup()
  phase.value = 'tour'
}

function closeIntro() {
  device.markIntroDone()
  phase.value = 'idle'
  setTimeout(goTour, 500)
}

function closeTour() {
  device.markTourDone()
  phase.value = 'idle'
  setTimeout(goPopup, 900)
}

function closePopup() {
  if (popup.value) device.markPopupSeen(popup.value)
  popup.value = null
  phase.value = 'done'
}

onMounted(async () => {
  if (isQuietRoute()) return
  try {
    const content = await fetchEngagementContent()
    slides.value = content.slides
    steps.value = content.steps
    popups.value = content.popups
  } catch {
    return // le contenu d'accueil ne doit jamais gêner la navigation
  }
  // Laisse le temps à la page (et à la session) de s'afficher avant d'interrompre.
  setTimeout(() => {
    if (!device.introDone() && slides.value.length) phase.value = 'intro'
    else goTour()
  }, 900)
})
</script>

<template>
  <OnboardingIntro v-if="phase === 'intro'" :slides="slides" @close="closeIntro" />
  <HeaderTour v-else-if="phase === 'tour'" :steps="steps" @close="closeTour" />
  <AnnouncementPopup v-else-if="phase === 'popup' && popup" :popup="popup" @close="closePopup" />
</template>
