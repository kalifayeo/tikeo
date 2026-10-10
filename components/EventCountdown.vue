<script setup lang="ts">
/**
 * Compte à rebours jusqu'au début de l'événement + badge d'urgence
 * « Plus que X billets » quand le stock devient faible.
 * Pensé pour le fond encre (hero de la page événement).
 * Le décompte ne démarre qu'après le montage côté navigateur : le rendu
 * serveur n'affiche rien de variable, donc aucun décalage d'hydratation.
 */
const props = defineProps<{
  startDate: string
  /** Billets encore disponibles, tous types confondus (null = illimité / inconnu). */
  remaining: number | null
  /** Vrai si tous les types de billets sont épuisés. */
  soldOut: boolean
}>()

const { t } = useI18n()
const now = ref<number | null>(null)
let timer: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  now.value = Date.now()
  timer = setInterval(() => (now.value = Date.now()), 1000)
})
onBeforeUnmount(() => timer && clearInterval(timer))

const diff = computed(() => (now.value === null ? null : new Date(props.startDate).getTime() - now.value))
const started = computed(() => diff.value !== null && diff.value <= 0)

const parts = computed(() => {
  if (diff.value === null || diff.value <= 0) return null
  const s = Math.floor(diff.value / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  }
})
// Au-delà de 60 jours, un compte à rebours à la seconde n'apporte rien.
const showCountdown = computed(() => !!parts.value && parts.value.days <= 60)

const LOW_STOCK = 20
const urgency = computed<'none' | 'soldout' | 'low' | 'critical'>(() => {
  if (props.soldOut) return 'soldout'
  if (props.remaining === null) return 'none'
  if (props.remaining <= 5) return 'critical'
  if (props.remaining <= LOW_STOCK) return 'low'
  return 'none'
})

const units = computed(() => {
  const p = parts.value
  if (!p) return []
  return [
    { key: 'd', value: p.days, label: t('event.unitDays') },
    { key: 'h', value: p.hours, label: t('event.unitHours') },
    { key: 'm', value: p.minutes, label: t('event.unitMinutes') },
    { key: 's', value: p.seconds, label: t('event.unitSeconds') },
  ]
})

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <div v-if="showCountdown || started || urgency !== 'none'" class="flex flex-col gap-3">
    <!-- Urgence stock -->
    <span
      v-if="urgency !== 'none'"
      class="inline-flex w-fit items-center gap-2 px-3 py-1.5 text-xs font-bold"
      :class="urgency === 'low' ? 'bg-[#FF7A00] text-tikeo-ink' : 'bg-white text-tikeo-error'"
    >
      <span v-if="urgency !== 'soldout'" class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping bg-current opacity-60" />
        <span class="relative inline-flex h-2 w-2 bg-current" />
      </span>
      <template v-if="urgency === 'soldout'">{{ t('event.urgencySoldOut') }}</template>
      <template v-else>{{ t('event.urgencyRemaining', { n: remaining }) }}</template>
    </span>

    <!-- Décompte -->
    <div v-if="showCountdown && parts" role="timer" :aria-label="t('event.countdownLabel')">
      <p class="mb-2 text-[11px] font-bold uppercase tracking-wider text-white/60">{{ t('event.startsIn') }}</p>
      <div class="flex gap-2">
        <div v-for="u in units" :key="u.key" class="flex min-w-[3.6rem] flex-col items-center border border-white/15 bg-white/[0.07] px-2.5 py-2 md:min-w-[4.2rem]">
          <span class="font-display text-2xl font-extrabold tabular-nums leading-none md:text-3xl">{{ pad(u.value) }}</span>
          <span class="mt-1 text-[10px] font-semibold uppercase tracking-wide text-white/60">{{ u.label }}</span>
        </div>
      </div>
    </div>
    <span v-else-if="started" class="inline-flex w-fit items-center gap-2 bg-white/10 px-3 py-1.5 text-xs font-bold text-white">
      <span class="h-2 w-2 animate-pulse bg-[#4ADE80]" /> {{ t('event.startedOrOngoing') }}
    </span>
  </div>
</template>
