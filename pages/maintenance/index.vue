<script setup lang="ts">
import { MAINTENANCE_OFF, retryAfterSeconds, type MaintenanceState } from '~/utils/maintenance'

// Page publique affichée à tous les visiteurs pendant la maintenance
// (voir server/middleware/maintenance.ts). Pas de header/footer du site.
definePageMeta({ layout: false })

const { t } = useI18n()

const { data: state, refresh } = await useFetch<MaintenanceState>('/api/maintenance', {
  key: 'tikeo-maintenance-page',
  default: () => MAINTENANCE_OFF,
})

// Maintenance terminée (ou page ouverte à la main) : retour à l'accueil.
if (state.value && !state.value.enabled) {
  await navigateTo('/', { replace: true })
}

// Réponse HTTP 503 « indisponible temporairement » (et non 200) : les moteurs
// de recherche n'indexent pas cette page et reviennent plus tard.
if (import.meta.server && state.value?.enabled) {
  // (les utilitaires h3 comme setResponseHeader ne sont pas auto-importés dans
  // le code Vue : on écrit directement sur la réponse Node.)
  const res = useRequestEvent()?.node.res
  if (res) {
    res.statusCode = 503
    res.setHeader('Retry-After', String(retryAfterSeconds(state.value)))
    res.setHeader('Cache-Control', 'no-store')
  }
}

useSeoMeta({ title: () => t('maintenancePage.seoTitle'), robots: 'noindex, nofollow' })

const checking = ref(false)
const feedback = ref('')

async function check(manual = false) {
  checking.value = true
  feedback.value = ''
  try {
    await refresh()
    if (state.value && !state.value.enabled) {
      useState<MaintenanceState | null>('tikeo-maintenance').value = null
      await navigateTo('/', { replace: true })
      return
    }
    if (manual) feedback.value = t('maintenancePage.stillClosed')
  } finally {
    checking.value = false
  }
}

// Le site se rouvre tout seul pour le visiteur dès que l'admin désactive la maintenance.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => check(false), 30_000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <MaintenanceNotice
    :kind="state?.kind"
    :title="state?.title"
    :message="state?.message"
    :ends-at="state?.endsAt"
    :checking="checking"
    :feedback="feedback"
    @retry="check(true)"
  />
</template>
