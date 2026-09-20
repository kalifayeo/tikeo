<script setup lang="ts">
// Bannière d'accueil : les images (et gifs) qui défilent sont chargées
// depuis Supabase (table `home_slides`, gérée dans /admin/accueil), avec un
// visuel de secours si l'admin n'a encore rien configuré. Le texte affiché
// sur la grande bannière centrale vient de `home_hero_content` (même page
// admin), avec repli sur les traductions par défaut.
const { t } = useI18n()

const FALLBACK_IMAGE = '/sample-event.jpg'

const { byZone } = useHomeSlides()
const centerSlides = byZone('center')
const leftSlides = byZone('left')
const rightSlides = byZone('right')

const { content: heroContent } = useHomeHeroContent()

const heroTitle = computed(() => heroContent.value?.title || t('hero.title'))
const heroSubtitle = computed(() => heroContent.value?.subtitle || t('hero.subtitle'))
const heroCtaLabel = computed(() => heroContent.value?.cta_label || t('hero.cta'))
const heroCtaUrl = computed(() => heroContent.value?.cta_url || '/organisateur/evenements/nouveau')
const heroCtaIsExternal = computed(() => /^https?:\/\//i.test(heroCtaUrl.value))

function mediaUrls(list: { media_url: string }[]) {
  return list.length > 0 ? list.map((s) => s.media_url) : [FALLBACK_IMAGE]
}

// On duplique la liste pour boucler sans à-coup : l'animation glisse de 0 à
// -50 %, soit exactement la largeur/hauteur de la liste d'origine.
function loop(list: string[]) {
  return list.length > 1 ? [...list, ...list] : list
}

const centerLoop = computed(() => loop(mediaUrls(centerSlides.value)))
const leftLoop = computed(() => loop(mediaUrls(leftSlides.value)))
const rightLoop = computed(() => loop(mediaUrls(rightSlides.value)))

// Vitesse proportionnelle au nombre d'images, avec un plancher pour que le
// défilement reste lisible même avec une seule image en boucle.
function trackDuration(loopedList: string[], secondsPerItem: number, minSeconds: number) {
  const originalCount = loopedList.length > 1 ? loopedList.length / 2 : 1
  return `${Math.max(originalCount * secondsPerItem, minSeconds)}s`
}

const centerDuration = computed(() => trackDuration(centerLoop.value, 8, 10))
const leftDuration = computed(() => trackDuration(leftLoop.value, 7, 9))
const rightDuration = computed(() => trackDuration(rightLoop.value, 7, 9))

function trackBasis(loopedList: string[]) {
  return `${100 / loopedList.length}%`
}

// Hauteur fixe partagée par les 3 colonnes (centre + gauche + droite) :
// c'est ce qui manquait avant. Sans hauteur explicite sur les colonnes
// latérales, le navigateur ne pouvait pas résoudre les hauteurs en
// pourcentage à l'intérieur (dépendance circulaire avec le flex stretch),
// et retombait sur la taille réelle des images — d'où l'effet "trop
// grand" et un défilement qui semblait beaucoup trop rapide (même durée
// d'animation, mais une distance à parcourir bien plus grande).
const HERO_HEIGHT_CLASSES = 'h-52 sm:h-64 md:h-80 lg:h-[26rem]'
</script>

<template>
  <section class="mx-auto max-w-tikeo-container px-4 pt-4 md:px-6 md:pt-6">
    <div class="relative flex items-stretch gap-3 overflow-hidden">
      <!-- Colonne gauche (desktop uniquement) : défilement vertical continu -->
      <div class="hidden w-1/6 shrink-0 overflow-hidden rounded-none border border-tikeo-border lg:block" :class="HERO_HEIGHT_CLASSES">
        <div
          class="tikeo-marquee-y flex flex-col"
          :style="{ height: `${leftLoop.length * 100}%`, animationDuration: leftDuration }"
        >
          <img
            v-for="(src, i) in leftLoop"
            :key="`left-${i}`"
            :src="src"
            alt=""
            class="w-full shrink-0 object-cover opacity-80"
            :style="{ height: trackBasis(leftLoop) }"
            loading="lazy"
          />
        </div>
      </div>

      <!-- Bannière principale : défilement horizontal continu, de droite à gauche -->
      <div class="relative w-full overflow-hidden rounded-none border border-tikeo-border md:w-4/6" :class="HERO_HEIGHT_CLASSES">
        <div
          class="tikeo-marquee-x flex h-full"
          :style="{ width: `${centerLoop.length * 100}%`, animationDuration: centerDuration }"
        >
          <img
            v-for="(src, i) in centerLoop"
            :key="`center-${i}`"
            :src="src"
            :alt="i === 0 ? t('hero.title') : ''"
            class="h-full shrink-0 object-cover"
            :style="{ width: trackBasis(centerLoop) }"
            :loading="i === 0 ? 'eager' : 'lazy'"
            :fetchpriority="i === 0 ? 'high' : 'auto'"
            decoding="async"
          />
        </div>
        <div class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-black/10" />
        <div class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center sm:gap-3 md:px-10">
          <h1 class="text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl md:text-5xl lg:text-6xl">
            {{ heroTitle }}
          </h1>
          <p class="max-w-xs text-xs text-white/90 sm:max-w-md sm:text-sm md:text-lg lg:max-w-lg">
            {{ heroSubtitle }}
          </p>
          <a
            v-if="heroCtaIsExternal"
            :href="heroCtaUrl"
            target="_blank"
            rel="noopener"
            class="btn-primary mt-1 !px-5 !py-2.5 !text-sm sm:mt-2 sm:!px-7 sm:!py-3 sm:!text-base"
          >
            {{ heroCtaLabel }}
          </a>
          <NuxtLink v-else :to="heroCtaUrl" class="btn-primary mt-1 !px-5 !py-2.5 !text-sm sm:mt-2 sm:!px-7 sm:!py-3 sm:!text-base">
            {{ heroCtaLabel }}
          </NuxtLink>
        </div>
      </div>

      <!-- Colonne droite (desktop uniquement) : défilement vertical continu -->
      <div class="hidden w-1/6 shrink-0 overflow-hidden rounded-none border border-tikeo-border lg:block" :class="HERO_HEIGHT_CLASSES">
        <div
          class="tikeo-marquee-y flex flex-col"
          :style="{ height: `${rightLoop.length * 100}%`, animationDuration: rightDuration }"
        >
          <img
            v-for="(src, i) in rightLoop"
            :key="`right-${i}`"
            :src="src"
            alt=""
            class="w-full shrink-0 object-cover opacity-80"
            :style="{ height: trackBasis(rightLoop) }"
            loading="lazy"
          />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
/* Défilement horizontal continu (grande bannière), de droite à gauche */
.tikeo-marquee-x {
  animation-name: tikeo-marquee-x;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
@keyframes tikeo-marquee-x {
  from {
    transform: translateX(0);
  }
  to {
    transform: translateX(-50%);
  }
}

/* Défilement vertical continu (colonnes latérales) */
.tikeo-marquee-y {
  animation-name: tikeo-marquee-y;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
  will-change: transform;
}
@keyframes tikeo-marquee-y {
  from {
    transform: translateY(0);
  }
  to {
    transform: translateY(-50%);
  }
}

/* Pause au survol pour laisser le temps de regarder une image/un gif */
.tikeo-marquee-x:hover,
.tikeo-marquee-y:hover {
  animation-play-state: paused;
}

@media (prefers-reduced-motion: reduce) {
  .tikeo-marquee-x,
  .tikeo-marquee-y {
    animation: none;
  }
}
</style>
