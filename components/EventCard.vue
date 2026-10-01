<script setup lang="ts">
import type { EventCardData } from '~/types/database'

const props = defineProps<{
  event: EventCardData
  /** "grid" = carte compacte desktop, "full" = carte pleine largeur (mobile) */
  variant?: 'grid' | 'full'
}>()

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const { isFavorite, toggleFavorite } = useFavorites()

async function handleFavoriteClick() {
  const ok = await toggleFavorite(props.event.id)
  if (!ok) {
    router.push({ path: '/connexion', query: { redirect: route.fullPath } })
  }
}

const formattedDate = computed(() => {
  const d = new Date(props.event.startDate)
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
})

const formattedPrice = computed(() => `${props.event.priceFrom.toLocaleString('fr-FR')} FCFA`)

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
</script>

<template>
  <div
    class="group flex shrink-0 flex-col overflow-hidden border border-tikeo-border bg-tikeo-surface hover:-translate-y-1.5 hover:shadow-card-hover"
    style="transition-property: transform, box-shadow; transition-duration: 0.3s; transition-timing-function: var(--ease-tikeo)"
    :class="variant === 'full' ? 'w-[68vw] max-w-[240px] md:w-full md:max-w-none' : 'w-full'"
  >
    <NuxtLink :to="`/e/${event.slug}`" class="block">
      <div class="relative">
        <img
          :src="event.coverImage"
          :alt="event.title"
          loading="lazy"
          decoding="async"
          class="w-full object-cover transition group-hover:scale-105"
          :class="variant === 'full' ? 'h-28' : 'h-40'"
        />
        <!-- Badge organisateur vérifié -->
        <span
          v-if="event.verified"
          class="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-tikeo-success text-white"
          :title="t('home.verified')"
        >
          <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3">
            <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </span>
        <!-- Étiquette catégorie -->
        <span v-if="event.category" class="absolute bottom-0 right-0 bg-tikeo-orange px-2 py-0.5 text-[11px] font-semibold uppercase text-white">
          {{ event.category }}
        </span>
      </div>
    </NuxtLink>

    <div :class="variant === 'full' ? 'space-y-1.5 p-2.5' : 'space-y-1.5 p-3.5'">
      <div class="flex items-start justify-between gap-2">
        <NuxtLink :to="`/e/${event.slug}`" class="line-clamp-1 flex-1 font-bold uppercase tracking-tight text-tikeo-black" :class="variant === 'full' ? 'text-xs' : 'text-sm'">
          {{ event.title }}
        </NuxtLink>
        <button
          type="button"
          class="-m-1.5 flex shrink-0 items-center gap-1 p-1.5 text-tikeo-gray-text transition-transform active:scale-[0.85]"
          :aria-pressed="isFavorite(event.id)"
          :aria-label="isFavorite(event.id) ? t('home.removeFavorite') : t('home.addFavorite')"
          @click.prevent="handleFavoriteClick"
        >
          <svg class="h-4 w-4" :class="isFavorite(event.id) ? 'fill-tikeo-orange text-tikeo-orange' : 'fill-none text-tikeo-gray-text'" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
          </svg>
          <span v-if="event.favoritesCount" class="text-[11px]">{{ event.favoritesCount.toLocaleString('fr-FR') }}</span>
        </button>
      </div>

      <div class="flex items-center gap-1.5 text-tikeo-gray-text" :class="variant === 'full' ? 'text-[11px]' : 'text-xs'">
        <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M8 7V3M16 7V3M3.5 9h17M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" />
        </svg>
        <span>{{ formattedDate }}</span>
      </div>

      <div class="flex items-center gap-1.5 text-tikeo-gray-text" :class="variant === 'full' ? 'text-[11px]' : 'text-xs'">
        <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M17 9V7a5 5 0 00-10 0v2M5 9h14l-1 12H6L5 9z" />
        </svg>
        <span>{{ t('home.from') }} {{ formattedPrice }}</span>
      </div>

      <div v-if="variant !== 'full'" class="flex items-center gap-1.5 text-xs text-tikeo-gray-text">
        <svg class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M12 21c-4.5-4-7-7.4-7-10.5A7 7 0 0119 10.5C19 13.6 16.5 17 12 21z" />
          <circle cx="12" cy="10.5" r="2.2" stroke-width="1.8" />
        </svg>
        <span>{{ event.city }}<span v-if="event.country">, {{ event.country }}</span></span>
      </div>

      <NuxtLink :to="`/e/${event.slug}`" class="btn-primary block w-full !py-2 text-center" :class="variant === 'full' ? '!text-xs' : '!text-sm'">
        {{ t('home.buy') }}
      </NuxtLink>
    </div>

    <div v-if="event.organizerName && variant !== 'full'" class="flex items-center justify-between border-t border-tikeo-border px-3.5 py-2">
      <div class="flex min-w-0 items-center gap-2">
        <span class="flex h-6 w-6 shrink-0 items-center justify-center bg-tikeo-brand text-[10px] font-bold text-white">{{ initials }}</span>
        <p class="min-w-0 truncate text-xs text-tikeo-gray-text">
          {{ t('home.publishedBy') }} <span class="font-semibold text-tikeo-black">{{ event.organizerName }}</span>
        </p>
      </div>
      <button type="button" class="shrink-0 border border-tikeo-border px-2.5 py-1 text-[11px] font-semibold text-tikeo-black transition duration-200 hover:border-tikeo-orange hover:text-tikeo-orange active:scale-[0.9]">
        {{ t('home.subscribe') }}
      </button>
    </div>
  </div>
</template>
