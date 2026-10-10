<script setup lang="ts">
import type { MaintenanceKind } from '~/utils/maintenance'

/**
 * Contenu de la page de maintenance. Utilisé par la vraie page publique
 * (pages/maintenance) ET par l'aperçu de l'admin (pages/admin/maintenance),
 * pour que ce que l'admin prévisualise soit exactement ce que voient les visiteurs.
 */
const props = withDefaults(
  defineProps<{
    kind?: MaintenanceKind
    title?: string | null
    message?: string | null
    endsAt?: string | null
    checking?: boolean
    feedback?: string
    /** Aperçu admin : bouton désactivé, hauteur réduite, pas de lien admin. */
    preview?: boolean
  }>(),
  { kind: 'planned', title: null, message: null, endsAt: null, checking: false, feedback: '', preview: false }
)
const emit = defineEmits<{ retry: [] }>()

const { t, locale } = useI18n()

const shownTitle = computed(() => props.title?.trim() || t(props.kind === 'emergency' ? 'maintenancePage.defaultTitleEmergency' : 'maintenancePage.defaultTitlePlanned'))
const shownMessage = computed(() => props.message?.trim() || t(props.kind === 'emergency' ? 'maintenancePage.defaultMessageEmergency' : 'maintenancePage.defaultMessagePlanned'))

// Date formatée côté navigateur seulement (fuseau du visiteur) : évite tout
// décalage entre le HTML du serveur et celui du navigateur.
const endsLabel = ref('')
function formatEnds() {
  if (!props.endsAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'long', timeStyle: 'short' }).format(new Date(props.endsAt))
  } catch {
    return ''
  }
}
onMounted(() => (endsLabel.value = formatEnds()))
watch(() => [props.endsAt, locale.value], () => (endsLabel.value = formatEnds()))
</script>

<template>
  <section
    class="flex w-full flex-col items-center justify-center bg-tikeo-surface px-6 text-center"
    :class="preview ? 'py-10' : 'min-h-screen py-16'"
  >
    <img src="/logo-tikeo.png" alt="Tikeo" width="720" height="232" class="h-12 w-auto" />

    <span
      class="mt-8 inline-flex items-center gap-2 border px-3 py-1 text-xs font-bold uppercase tracking-wide"
      :class="kind === 'emergency' ? 'border-tikeo-error/40 bg-tikeo-error/10 text-tikeo-error' : 'border-tikeo-orange/40 bg-tikeo-orange/10 text-tikeo-orange'"
    >
      <TikeoSpinner :size="14" />
      {{ t(kind === 'emergency' ? 'maintenancePage.badgeEmergency' : 'maintenancePage.badgePlanned') }}
    </span>

    <h1 class="mt-5 max-w-xl text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ shownTitle }}</h1>
    <p class="mt-3 max-w-md whitespace-pre-line text-sm text-tikeo-gray-text md:text-base">{{ shownMessage }}</p>

    <p v-if="endsLabel" class="mt-5 border border-tikeo-border bg-tikeo-surface-alt px-4 py-2 text-sm font-semibold text-tikeo-black">
      {{ t('maintenancePage.backAt', { date: endsLabel }) }}
    </p>

    <button type="button" class="btn-primary mt-8" :disabled="preview || checking" @click="emit('retry')">
      <TikeoSpinner v-if="checking" :size="16" class="!text-current" />
      {{ checking ? t('maintenancePage.checking') : t('maintenancePage.retry') }}
    </button>
    <p v-if="feedback" class="mt-3 text-xs text-tikeo-gray-text" role="status">{{ feedback }}</p>

  </section>
</template>
