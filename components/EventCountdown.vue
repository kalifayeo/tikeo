<script setup lang="ts">
/**
 * Compte à rebours jusqu'au début de l'événement + badge d'urgence
 * « Plus que X billets » quand le stock devient faible.
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

const pad = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <div v-if="showCountdown || started || urgency !== 'none'" class="flex flex-col gap-2.5">
    <!-- Urgence stock -->
    <span
      v-if="urgency !== 'none'"
      class="inline-flex w-fit items-center gap-1.5 px-2.5 py-1 text-xs font-bold"
      :class="{
        'bg-tikeo-error/10 text-tikeo-error': urgency === 'critical' || urgency === 'soldout',
        'bg-tikeo-orange/10 text-tikeo-orange': urgency === 'low',
      }"
    >
      <span v-if="urgency !== 'soldout'" class="relative flex h-2 w-2">
        <span class="absolute inline-flex h-full w-full animate-ping bg-current opacity-60" />
        <span class="relative inline-flex h-2 w-2 bg-current" />
      </span>
      <template v-if="urgency === 'soldout'">{{ t('event.urgencySoldOut') }}</template>
      <template v-else>{{ t('event.urgencyRemaining', { n: remaining }) }}</template>
    </span>

    <!-- Décompte -->
    <div v-if="showCountdown && parts" class="flex items-center gap-2" role="timer" :aria-label="t('event.countdownLabel')">
      <span class="mr-1 text-[11px] font-semibold uppercase tracking-wide text-tikeo-gray-text">{{ t('event.startsIn') }}</span>
      <div v-for="(u, key) in { d: [parts.days, 'event.unitDays'], h: [parts.hours, 'event.unitHours'], m: [parts.minutes, 'event.unitMinutes'], s: [parts.seconds, 'event.unitSeconds'] }" :key="key" class="flex min-w-[3rem] flex-col items-center bg-tikeo-black px-2 py-1.5 text-white">
        <span class="text-lg font-extrabold tabular-nums leading-none">{{ pad(u[0] as number) }}</span>
        <span class="mt-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/70">{{ t(u[1] as string) }}</span>
      </div>
    </div>
    <span v-else-if="started" class="inline-flex w-fit items-center gap-1.5 bg-green-500/10 px-2.5 py-1 text-xs font-bold text-green-700">
      <span class="h-2 w-2 animate-pulse bg-green-600" /> {{ t('event.startedOrOngoing') }}
    </span>
  </div>
</template>
