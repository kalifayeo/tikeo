<script setup lang="ts">
/**
 * Bandeau « Votre avis compte » de la page d'accueil : note moyenne, étoiles
 * cliquables (un clic ouvre /avis avec la note déjà choisie) et les derniers
 * avis publiés.
 */
const { t } = useI18n()
const router = useRouter()
const { items, stats, fetchWall } = useSiteFeedbackWall()
const relative = useRelativeTime()
const hover = ref(0)

onMounted(() => fetchWall(6))

const latest = computed(() => items.value.slice(0, 3))
function rate(n: number) {
  router.push({ path: '/avis', query: { rating: String(n) }, hash: '#donner-mon-avis' })
}
</script>

<template>
  <section class="border-y border-tikeo-border bg-tikeo-surface" :aria-label="t('feedback.stripTitle')">
    <div class="mx-auto grid max-w-tikeo-container gap-8 px-4 py-9 md:px-6 md:py-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-center lg:gap-14">
      <div>
        <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black md:text-3xl">{{ t('feedback.stripTitle') }}</h2>
        <p class="mt-2 max-w-md text-sm leading-relaxed text-tikeo-gray-text md:text-base">{{ t('feedback.stripText') }}</p>

        <div class="mt-5 flex items-center gap-1" role="group" :aria-label="t('feedback.yourRating')" @mouseleave="hover = 0">
          <button
            v-for="n in 5"
            :key="n"
            type="button"
            class="text-[#FF7A00] transition-transform duration-150 hover:scale-125 active:scale-95"
            :aria-label="t('feedback.starsAria', { n })"
            @mouseenter="hover = n"
            @focus="hover = n"
            @blur="hover = 0"
            @click="rate(n)"
          >
            <svg class="h-9 w-9" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 2.8l2.75 5.78 6.3.82-4.6 4.36 1.14 6.26L12 17l-5.59 3.02 1.14-6.26-4.6-4.36 6.3-.82z" :fill="n <= hover ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            </svg>
          </button>
          <span class="ml-2 min-w-[7rem] text-sm font-bold text-tikeo-black">{{ hover ? t(`feedback.rating${hover}`) : '' }}</span>
        </div>

        <div class="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3">
          <NuxtLink to="/avis" class="btn-ink !h-11">
            <AppIcon name="star" class="h-4 w-4" :stroke="2.2" />
            {{ t('feedback.giveFeedback') }}
          </NuxtLink>
          <p v-if="stats && stats.total > 0" class="flex items-center gap-2 text-sm font-semibold text-tikeo-gray-text">
            <span class="font-display text-2xl font-extrabold text-tikeo-black">{{ Number(stats.average).toFixed(1) }}</span>
            <StarRating :model-value="Math.round(stats.average)" readonly size="sm" />
            <span>({{ t('feedback.count', { n: stats.total }) }})</span>
          </p>
        </div>
      </div>

      <ul v-if="latest.length" class="grid gap-3 md:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
        <li v-for="f in latest" :key="f.id" class="flex flex-col border border-tikeo-border bg-tikeo-surface-alt p-4">
          <StarRating :model-value="f.rating" readonly size="sm" />
          <p class="mt-2 line-clamp-4 flex-1 text-sm leading-relaxed text-tikeo-black">{{ f.message }}</p>
          <p class="mt-3 text-xs font-bold text-tikeo-gray-text">{{ f.display_name }} · {{ relative(f.created_at) }}</p>
        </li>
      </ul>
      <div v-else class="border border-dashed border-tikeo-border p-6 text-center text-sm text-tikeo-gray-text">{{ t('feedback.beFirst') }}</div>
    </div>
  </section>
</template>
