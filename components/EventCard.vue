<script setup lang="ts">
import type { EventCardData } from '~/types/database'

const props = defineProps<{
  event: EventCardData
  /**
   * "grid"    = carte verticale standard (grille desktop)
   * "full"    = carte verticale étroite (carrousels, mobile)
   * "tile"    = carte qui remplit la hauteur de sa cellule (mosaïque « Prochainement »)
   * "feature" = grande affiche (événement mis en avant)
   */
  variant?: 'grid' | 'full' | 'tile' | 'feature'
}>()

const { t, locale } = useI18n()
const router = useRouter()
const route = useRoute()
const { isFavorite, toggleFavorite } = useFavorites()

async function handleFavoriteClick() {
  const ok = await toggleFavorite(props.event.id)
  if (!ok) {
    router.push({ path: '/connexion', query: { redirect: route.fullPath } })
  }
}

const isFeature = computed(() => props.variant === 'feature')
const isTile = computed(() => props.variant === 'tile')

const dateParts = computed(() => {
  const d = new Date(props.event.startDate)
  return {
    weekday: d.toLocaleDateString(locale.value, { weekday: 'short' }).replace('.', ''),
    day: String(d.getDate()).padStart(2, '0'),
    month: d.toLocaleDateString(locale.value, { month: 'short' }).replace('.', ''),
    full: d.toLocaleDateString(locale.value, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
  }
})

const isFree = computed(() => props.event.priceFrom === 0)
const formattedPrice = computed(() => props.event.priceFrom.toLocaleString('fr-FR'))

const initials = computed(() => {
  const name = props.event.organizerName
  if (!name) return '•'
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
})

const eventUrl = computed(() => `/e/${props.event.slug}`)
</script>

<template>
  <!-- ===================== AFFICHE (événement mis en avant) ===================== -->
  <article
    v-if="isFeature"
    class="group relative flex min-h-[26rem] shrink-0 flex-col justify-end overflow-hidden bg-tikeo-ink text-white shadow-card transition-shadow duration-300 hover:shadow-card-hover"
  >
    <img
      :src="event.coverImage"
      alt=""
      loading="lazy"
      decoding="async"
      class="absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.04]"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-tikeo-ink via-tikeo-ink/55 to-transparent" aria-hidden="true" />

    <div class="absolute left-4 top-4 flex flex-col items-center bg-white px-3 py-2 leading-none text-tikeo-ink">
      <span class="text-[11px] font-semibold capitalize text-tikeo-ink/70">{{ dateParts.weekday }}</span>
      <span class="mt-1 font-display text-3xl font-extrabold">{{ dateParts.day }}</span>
      <span class="mt-0.5 text-xs font-semibold capitalize text-tikeo-ink/70">{{ dateParts.month }}</span>
    </div>

    <button
      type="button"
      class="absolute right-4 top-4 flex h-10 items-center gap-1.5 rounded-full bg-white/95 px-3 text-tikeo-ink transition-transform active:scale-90"
      :aria-pressed="isFavorite(event.id)"
      :aria-label="isFavorite(event.id) ? t('home.removeFavorite') : t('home.addFavorite')"
      @click.prevent="handleFavoriteClick"
    >
      <svg class="h-[18px] w-[18px]" :class="isFavorite(event.id) ? 'fill-[#FF7A00] text-[#FF7A00]' : 'fill-none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
      </svg>
      <span v-if="event.favoritesCount" class="text-xs font-semibold">{{ event.favoritesCount.toLocaleString('fr-FR') }}</span>
    </button>

    <div class="relative z-10 flex flex-col gap-3 p-5 md:p-7">
      <span v-if="event.category" class="w-fit rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur-sm">{{ event.category }}</span>
      <h3 class="font-display text-2xl font-extrabold leading-[1.08] tracking-tight md:text-4xl">
        <NuxtLink :to="eventUrl" class="after:absolute after:inset-0 after:content-['']">{{ event.title }}</NuxtLink>
      </h3>
      <p class="flex items-center gap-1.5 text-sm text-white/85">
        <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.5-4-7-7.4-7-10.5A7 7 0 0119 10.5C19 13.6 16.5 17 12 21z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
        {{ event.city }}<template v-if="event.country">, {{ event.country }}</template>
      </p>
      <div class="mt-1 flex items-center justify-between gap-4 border-t border-white/20 pt-4">
        <p class="leading-tight">
          <span class="block text-xs text-white/70">{{ t('home.from') }}</span>
          <span class="font-display text-xl font-bold md:text-2xl">
            <template v-if="isFree">{{ t('home.free') }}</template>
            <template v-else>{{ formattedPrice }} <span class="text-sm font-semibold">FCFA</span></template>
          </span>
        </p>
        <span class="bg-[#FF7A00] px-5 py-2.5 text-sm font-bold text-tikeo-ink">{{ t('home.buyShort') }}</span>
      </div>
    </div>
  </article>

  <!-- ===================== BILLET (carte standard) ===================== -->
  <article
    v-else
    class="group relative flex shrink-0 flex-col bg-tikeo-surface shadow-card transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-card-hover"
    :class="[
      variant === 'full' || isTile ? 'w-[72vw] max-w-[260px] md:w-full md:max-w-none' : 'w-full',
      isTile ? 'h-full' : '',
    ]"
  >
    <!-- Visuel -->
    <div class="relative overflow-hidden" :class="isTile ? 'min-h-[9rem] flex-1' : variant === 'full' ? 'h-36' : 'h-44'">
      <img
        :src="event.coverImage"
        alt=""
        loading="lazy"
        decoding="async"
        class="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
      />
      <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" aria-hidden="true" />

      <!-- Talon de date -->
      <div class="absolute left-3 top-3 flex min-w-[2.9rem] flex-col items-center bg-white px-2 py-1.5 leading-none text-tikeo-ink shadow-sm">
        <span class="font-display text-xl font-extrabold">{{ dateParts.day }}</span>
        <span class="mt-0.5 text-[11px] font-semibold capitalize text-tikeo-ink/70">{{ dateParts.month }}</span>
      </div>

      <span v-if="event.category" class="absolute bottom-2.5 left-3 max-w-[70%] truncate rounded-full bg-tikeo-ink/85 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur-sm">
        {{ event.category }}
      </span>
    </div>

    <!-- Perforation du billet -->
    <div class="relative h-0" aria-hidden="true">
      <span class="absolute -left-[11px] -top-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
      <span class="absolute -right-[11px] -top-[11px] h-[22px] w-[22px] rounded-full bg-tikeo-surface-alt" />
      <span class="absolute inset-x-4 top-0 border-t-2 border-dashed border-tikeo-gray-text/35" />
    </div>

    <!-- Infos -->
    <div class="flex flex-col gap-2 px-4 pb-4 pt-4">
      <h3 class="line-clamp-2 font-display font-bold leading-snug tracking-tight text-tikeo-black" :class="variant === 'full' ? 'min-h-[2.5rem] text-[15px]' : 'min-h-[2.75rem] text-base'">
        <NuxtLink :to="eventUrl" class="after:absolute after:inset-0 after:z-[1] after:content-['']">{{ event.title }}</NuxtLink>
      </h3>

      <p class="flex items-center gap-1.5 truncate text-[13px] text-tikeo-gray-text">
        <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 21c-4.5-4-7-7.4-7-10.5A7 7 0 0119 10.5C19 13.6 16.5 17 12 21z" />
          <circle cx="12" cy="10.5" r="2.2" />
        </svg>
        <span class="truncate">{{ event.city }}<template v-if="event.country && variant === 'grid'">, {{ event.country }}</template></span>
      </p>

      <div class="mt-1 flex items-end justify-between gap-3">
        <p class="leading-tight">
          <span class="block text-[11px] text-tikeo-gray-text">{{ t('home.from') }}</span>
          <span class="font-display text-[17px] font-bold text-tikeo-black">
            <template v-if="isFree">{{ t('home.free') }}</template>
            <template v-else>{{ formattedPrice }} <span class="text-xs font-semibold text-tikeo-gray-text">FCFA</span></template>
          </span>
        </p>
        <span class="bg-tikeo-orange px-3.5 py-2 text-[13px] font-bold text-white transition-colors duration-200 group-hover:bg-[rgb(var(--tikeo-orange-strong-hover))]">
          {{ t('home.buyShort') }}
        </span>
      </div>

      <!-- Organisateur -->
      <div v-if="event.organizerName && variant === 'grid'" class="mt-1 flex items-center gap-2 border-t border-tikeo-border pt-3">
        <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-tikeo-ink text-[10px] font-bold text-white">{{ initials }}</span>
        <p class="min-w-0 truncate text-xs text-tikeo-gray-text">{{ event.organizerName }}</p>
        <svg v-if="event.verified" class="h-4 w-4 shrink-0 text-tikeo-success" viewBox="0 0 24 24" fill="currentColor" :aria-label="t('home.verified')">
          <title>{{ t('home.verified') }}</title>
          <path d="M12 2l2.4 1.8 3-.2 1 2.8 2.5 1.7-.9 2.9.9 2.9-2.5 1.7-1 2.8-3-.2L12 22l-2.4-1.8-3 .2-1-2.8-2.5-1.7.9-2.9-.9-2.9 2.5-1.7 1-2.8 3 .2L12 2zm-1.2 13.4l5-5-1.2-1.2-3.8 3.8-1.6-1.6-1.2 1.2 2.8 2.8z" />
        </svg>
      </div>
    </div>

    <!-- Favori (au-dessus du lien étendu) -->
    <button
      type="button"
      class="absolute right-3 top-3 z-[2] flex h-9 items-center gap-1 rounded-full bg-white/95 px-2.5 text-tikeo-ink shadow-sm transition-transform active:scale-90"
      :aria-pressed="isFavorite(event.id)"
      :aria-label="isFavorite(event.id) ? t('home.removeFavorite') : t('home.addFavorite')"
      @click.prevent="handleFavoriteClick"
    >
      <svg class="h-[18px] w-[18px]" :class="isFavorite(event.id) ? 'fill-tikeo-orange text-tikeo-orange' : 'fill-none'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
      </svg>
      <span v-if="event.favoritesCount" class="text-xs font-semibold">{{ event.favoritesCount.toLocaleString('fr-FR') }}</span>
    </button>
  </article>
</template>
