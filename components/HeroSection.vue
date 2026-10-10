<script setup lang="ts">
// Bannière d'accueil : texte + bouton viennent de `home_hero_content`
// (/admin/accueil), les visuels de `home_slides` (zones centre, gauche et
// droite fusionnées dans un seul diaporama). Un visuel de secours s'affiche
// tant que l'admin n'a rien configuré.
// Sous le titre, un mini-moteur de recherche (ville + période) pilote les
// mêmes filtres que le reste de l'accueil (useHomeFilters).
const { t } = useI18n()

const FALLBACK_IMAGE = '/sample-event.jpg'

const { byZone } = useHomeSlides()
const centerSlides = byZone('center')
const leftSlides = byZone('left')
const rightSlides = byZone('right')

const { content: heroContent } = useHomeHeroContent()
const { open: openPresentation } = usePresentationVideo()

const heroTitle = computed(() => heroContent.value?.title || t('hero.title'))
const heroSubtitle = computed(() => heroContent.value?.subtitle || t('hero.subtitle'))
const heroCtaLabel = computed(() => heroContent.value?.cta_label || t('hero.cta'))
const heroCtaUrl = computed(() => heroContent.value?.cta_url || '/organisateur/evenements/nouveau')
const heroCtaIsExternal = computed(() => /^https?:\/\//i.test(heroCtaUrl.value))

// --- Diaporama ---------------------------------------------------------
const images = computed(() => {
  const all = [...centerSlides.value, ...leftSlides.value, ...rightSlides.value].map((s) => s.media_url)
  return all.length > 0 ? all : [FALLBACK_IMAGE]
})

const current = ref(0)
const paused = ref(false)
const SLIDE_MS = 5500
// Économiseur de données / « réduire les animations » (Paramètres) : pas de
// défilement automatique. Le passage à la diapo suivante est piloté par la fin
// de l'animation de la barre de progression (donc toujours synchronisé avec elle,
// y compris quand on met en pause au survol).
const { dataSaver, prefs } = useUiPrefs()
const osReducedMotion = ref(false)

const autoplay = computed(() => images.value.length > 1 && !dataSaver.value && !prefs.value?.reduceMotion && !osReducedMotion.value)
const counter = computed(() => `${String(current.value + 1).padStart(2, '0')} / ${String(images.value.length).padStart(2, '0')}`)

function go(i: number) {
  current.value = (i + images.value.length) % images.value.length
}

function onBarEnd() {
  if (autoplay.value && !paused.value) go(current.value + 1)
}

onMounted(() => {
  osReducedMotion.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
watch(
  () => images.value.length,
  () => {
    if (current.value >= images.value.length) current.value = 0
  }
)

// --- Moteur de recherche rapide ---------------------------------------
const { filters, resetFilters, activeFilterCount } = useHomeFilters()
const dateOptions = useHomeDateRangeOptions()
const quickDates = computed(() => dateOptions.value.filter((o) => o.value !== 'all'))
const cities = ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Korhogo', 'San-Pédro', 'Man', 'Daloa', 'Gagnoa']

function toggleDate(value: typeof filters.value.date) {
  filters.value = { ...filters.value, date: filters.value.date === value ? 'all' : value }
}

function showEvents() {
  const anchors = document.querySelectorAll<HTMLElement>('[data-events-anchor]')
  const visible = Array.from(anchors).find((el) => el.offsetParent !== null)
  visible?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <section class="hero relative isolate overflow-hidden bg-tikeo-ink text-white">
    <!-- Fond : lueurs de marque + quadrillage qui s'estompe (décor, coupé en mode économie de données) -->
    <div class="tk-deco pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div class="absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#FF7A00]/20 blur-[110px]" />
      <div class="absolute -bottom-48 left-[8%] h-[30rem] w-[30rem] rounded-full bg-[#0057B8]/35 blur-[120px]" />
      <div class="hero__grid absolute inset-0" />
    </div>

    <!-- Trame de points : rappelle la perforation d'un billet -->
    <div
      class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block"
      style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0"
      aria-hidden="true"
    />

    <div class="mx-auto grid max-w-tikeo-container gap-8 px-4 pb-9 pt-5 md:gap-10 md:px-6 md:pb-14 md:pt-12 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-center lg:gap-16 lg:pb-16 lg:pt-16">
      <!-- ============ Texte + recherche ============ -->
      <div class="order-2 flex flex-col lg:order-1">
        <h1 class="hero__rise font-display text-[2.6rem] font-extrabold leading-[0.98] tracking-[-0.03em] sm:text-6xl lg:text-[4.5rem]" style="--d: 0ms; text-wrap: balance">
          {{ heroTitle }}
        </h1>
        <p class="hero__rise mt-5 max-w-md text-base leading-relaxed text-white/75 md:text-lg" style="--d: 90ms">
          {{ heroSubtitle }}
        </p>

        <!-- Recherche rapide : un billet à deux volets (perforation + encoches) -->
        <div class="hero__rise hero-ticket relative mt-7 border border-white/15 bg-white/[0.07] backdrop-blur-md md:mt-9" style="--d: 180ms">
          <span class="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#FF7A00] to-[#0057B8]" aria-hidden="true" />

          <div class="flex items-center justify-between gap-3 px-5 pb-4 pt-4 md:px-6 md:pt-5">
            <p class="font-display text-lg font-extrabold tracking-tight">{{ t('hero.finderTitle') }}</p>
            <AppIcon name="ticket" class="h-6 w-6 shrink-0 text-[#FF9A3D]" />
          </div>

          <!-- Ligne de perforation + encoches -->
          <div class="relative" aria-hidden="true">
            <div class="border-t-2 border-dashed border-white/20" />
            <span class="absolute -left-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border border-white/15 bg-tikeo-ink" />
            <span class="absolute -right-[9px] -top-[9px] h-[18px] w-[18px] rounded-full border border-white/15 bg-tikeo-ink" />
          </div>

          <div class="px-5 pb-5 pt-4 md:px-6 md:pb-6">
            <div class="flex flex-col gap-3 sm:flex-row">
              <label class="group relative block flex-1">
                <span class="sr-only">{{ t('filters.city') }}</span>
                <AppIcon name="pin" class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#FF9A3D]" />
                <select
                  v-model="filters.city"
                  class="h-12 w-full cursor-pointer appearance-none border border-white/20 bg-tikeo-ink-soft pl-11 pr-10 text-sm font-semibold text-white transition-colors hover:border-white/45 focus:border-[#FF7A00] focus:outline-none"
                >
                  <option :value="null">{{ t('filters.allCities') }}</option>
                  <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
                </select>
                <svg class="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/70 transition-transform group-focus-within:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </label>
              <button
                type="button"
                class="hero-cta group relative flex h-12 items-center justify-center gap-2 overflow-hidden bg-[#FF7A00] px-7 text-sm font-extrabold text-tikeo-ink transition-colors hover:bg-white sm:shrink-0"
                @click="showEvents"
              >
                <AppIcon name="search" class="h-[18px] w-[18px]" :stroke="2.4" />
                <span>{{ t('filters.seeEvents') }}</span>
                <AppIcon name="arrow-down" class="h-4 w-4 transition-transform duration-300 group-hover:translate-y-0.5" :stroke="2.6" />
              </button>
            </div>

            <div class="no-scrollbar mt-3.5 flex gap-2 overflow-x-auto sm:flex-wrap sm:overflow-visible" role="group" :aria-label="t('filters.date')">
              <button
                v-for="opt in quickDates"
                :key="opt.value"
                type="button"
                class="shrink-0 rounded-full border px-4 py-2 text-[13px] font-bold transition-all duration-200 active:scale-95"
                :class="
                  filters.date === opt.value
                    ? 'border-[#FF7A00] bg-[#FF7A00] text-tikeo-ink shadow-[0_6px_18px_-6px_rgba(255,122,0,0.7)]'
                    : 'border-white/25 text-white/85 hover:-translate-y-0.5 hover:border-white/70 hover:text-white'
                "
                :aria-pressed="filters.date === opt.value"
                @click="toggleDate(opt.value)"
              >
                {{ opt.label }}
              </button>
              <button
                v-if="activeFilterCount > 0"
                type="button"
                class="inline-flex items-center gap-1 px-2 py-2 text-[13px] font-bold text-[#FF9A3D] underline-offset-4 hover:underline"
                @click="resetFilters"
              >
                <AppIcon name="close" class="h-3.5 w-3.5" :stroke="2.6" />
                {{ t('home.resetFilters') }}
              </button>
            </div>
          </div>
        </div>

        <!-- Appel organisateur (contenu géré dans /admin/accueil) + réassurance -->
        <div class="hero__rise mt-6 flex flex-wrap items-center gap-x-6 gap-y-4 md:mt-7" style="--d: 270ms">
          <!-- Vidéo de présentation : montre le site et comment l'utiliser -->
          <button
            type="button"
            class="group inline-flex h-11 items-center gap-2.5 bg-white/10 pl-2 pr-5 text-sm font-bold text-white ring-1 ring-white/25 transition-colors hover:bg-white hover:text-tikeo-ink"
            @click="openPresentation"
          >
            <span class="relative flex h-7 w-7 items-center justify-center rounded-full bg-[#FF7A00] text-tikeo-ink">
              <span class="hero-play-ring absolute inset-0 rounded-full bg-[#FF7A00]" aria-hidden="true" />
              <svg class="relative h-3.5 w-3.5 translate-x-px" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
            </span>
            {{ t('presentationVideo.button') }}
          </button>
          <a
            v-if="heroCtaIsExternal"
            :href="heroCtaUrl"
            target="_blank"
            rel="noopener"
            class="group inline-flex h-11 items-center gap-2 border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink"
          >
            <AppIcon name="plus" class="h-4 w-4" :stroke="2.6" />
            {{ heroCtaLabel }}
          </a>
          <NuxtLink
            v-else
            :to="heroCtaUrl"
            class="group inline-flex h-11 items-center gap-2 border border-white/30 px-5 text-sm font-bold text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink"
          >
            <AppIcon name="plus" class="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" :stroke="2.6" />
            {{ heroCtaLabel }}
          </NuxtLink>

          <ul class="flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] font-semibold text-white/70">
            <li class="flex items-center gap-1.5"><AppIcon name="phone" class="h-4 w-4 text-[#FF9A3D]" />{{ t('hero.trustPay') }}</li>
            <li class="flex items-center gap-1.5"><AppIcon name="qr" class="h-4 w-4 text-[#FF9A3D]" />{{ t('hero.trustQr') }}</li>
          </ul>
        </div>
      </div>

      <!-- ============ Diaporama ============ -->
      <div
        class="hero__rise relative order-1 lg:order-2"
        style="--d: 120ms"
        role="region"
        aria-roledescription="carousel"
        :aria-label="t('hero.sliderLabel')"
        @mouseenter="paused = true"
        @mouseleave="paused = false"
        @focusin="paused = true"
        @focusout="paused = false"
      >
        <!-- Cadre décalé orange (desktop) -->
        <div class="tk-deco pointer-events-none absolute -bottom-3 -right-3 hidden h-full w-full border-2 border-[#FF7A00]/70 lg:block" aria-hidden="true" />

        <div class="relative aspect-[16/10] overflow-hidden bg-tikeo-ink-soft shadow-[0_30px_60px_-24px_rgba(0,0,0,0.65)] lg:aspect-auto lg:h-[29rem]">
          <img
            v-for="(src, i) in images"
            :key="`${src}-${i}`"
            :src="src"
            :alt="i === 0 ? t('hero.title') : ''"
            class="absolute inset-0 h-full w-full object-cover transition-all duration-[1100ms] ease-out"
            :class="i === current ? 'scale-100 opacity-100' : 'scale-[1.04] opacity-0'"
            :aria-hidden="i === current ? 'false' : 'true'"
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : 'auto'"
            decoding="async"
          />

          <!-- Perforation sur le bord gauche : le visuel est un billet -->
          <div
            class="pointer-events-none absolute inset-y-0 left-0 w-2"
            style="background-image: radial-gradient(circle at 0 10px, #0E2240 4.5px, transparent 5px); background-size: 8px 20px"
            aria-hidden="true"
          />
          <!-- Voile bas pour la lisibilité des commandes -->
          <div class="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />

          <!-- Commandes : segments de progression + compteur + flèches -->
          <div v-if="images.length > 1" class="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 px-4 pb-3.5 md:px-5">
            <div class="flex min-w-0 flex-1 items-center gap-1.5">
              <button
                v-for="(_, i) in images"
                :key="i"
                type="button"
                class="group flex h-7 min-w-[1.25rem] max-w-[3.25rem] flex-1 items-center"
                :aria-label="t('hero.slideAria', { n: i + 1 })"
                :aria-current="i === current ? 'true' : undefined"
                @click="go(i)"
              >
                <span class="relative block h-[3px] w-full overflow-hidden bg-white/35 transition-all group-hover:h-[5px] group-hover:bg-white/60">
                  <span
                    v-if="i === current"
                    :key="`bar-${current}`"
                    class="hero__bar absolute inset-y-0 left-0 bg-[#FF7A00]"
                    :class="autoplay ? '' : 'hero__bar--static'"
                    :style="{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: paused ? 'paused' : 'running' }"
                    @animationend="onBarEnd"
                  />
                </span>
              </button>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span class="hidden text-xs font-bold tabular-nums tracking-wider text-white/85 sm:block">{{ counter }}</span>
              <div class="flex gap-1.5">
                <button type="button" class="flex h-9 w-9 items-center justify-center bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-tikeo-ink active:scale-95" :aria-label="t('home.scrollPrev')" @click="go(current - 1)">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M15 5l-7 7 7 7" /></svg>
                </button>
                <button type="button" class="flex h-9 w-9 items-center justify-center bg-white/15 text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-tikeo-ink active:scale-95" :aria-label="t('home.scrollNext')" @click="go(current + 1)">
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.hero__grid {
  background-image: linear-gradient(rgba(255, 255, 255, 0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255, 255, 255, 0.045) 1px, transparent 1px);
  background-size: 56px 56px;
  -webkit-mask-image: radial-gradient(ellipse 75% 85% at 70% 35%, #000 10%, transparent 75%);
  mask-image: radial-gradient(ellipse 75% 85% at 70% 35%, #000 10%, transparent 75%);
}

/* Entrée de la bannière : une seule séquence, au chargement de la page. */
.hero__rise {
  animation: hero-rise 0.8s var(--ease-tikeo) both;
  animation-delay: var(--d, 0ms);
}
@keyframes hero-rise {
  from { opacity: 0; transform: translateY(22px); }
  to { opacity: 1; transform: translateY(0); }
}

/* Barre de progression de la diapositive courante. */
.hero__bar {
  width: 100%;
  transform-origin: left center;
  animation-name: hero-bar;
  animation-timing-function: linear;
  animation-fill-mode: both;
}
.hero__bar--static {
  animation: none;
}
@keyframes hero-bar {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* Reflet qui traverse le bouton principal au survol. */
.hero-cta::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(105deg, transparent 35%, rgba(255, 255, 255, 0.55) 50%, transparent 65%);
  transform: translateX(-120%);
  transition: transform 0.7s var(--ease-tikeo);
  pointer-events: none;
}
.hero-cta:hover::after {
  transform: translateX(120%);
}

.hero-play-ring {
  animation: hero-play-ring 2.2s ease-out infinite;
}
@keyframes hero-play-ring {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  70%,
  100% {
    transform: scale(1.9);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .hero-play-ring {
    animation: none;
    display: none;
  }
}
</style>
