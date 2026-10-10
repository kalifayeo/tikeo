<script setup lang="ts">
const { t } = useI18n()
const { stats } = useHomeStats()

// Visuel de la 1re section (photo de public en salle). Pour le changer :
// remplacer cette valeur ou le fichier public/sample-event.jpg.
const heroImage = '/sample-event.jpg'

useSeoMeta({
  title: () => `${t('aboutPage.eyebrow')} | Tikeo`,
  description: () => t('aboutPage.intro'),
})

const statItems = computed(() => [
  { value: `${stats.value.events}+`, label: t('aboutPage.statsEventsLabel') },
  { value: `${stats.value.organizers}+`, label: t('aboutPage.statsOrganizersLabel') },
  { value: `${stats.value.cities}+`, label: t('aboutPage.statsCitiesLabel') },
])

const values = computed(() => [
  { title: t('aboutPage.value1Title'), text: t('aboutPage.value1Text'), icon: 'shield' },
  { title: t('aboutPage.value2Title'), text: t('aboutPage.value2Text'), icon: 'bolt' },
  { title: t('aboutPage.value3Title'), text: t('aboutPage.value3Text'), icon: 'pin' },
])

const icons: Record<string, string> = {
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z',
  bolt: 'M13 2L4 14h6l-1 8 9-12h-6l1-8z',
  pin: 'M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
}

const audiences = computed(() => [
  {
    icon: 'ticket',
    title: t('aboutPage.forBuyersTitle'),
    points: [t('aboutPage.forBuyers1'), t('aboutPage.forBuyers2'), t('aboutPage.forBuyers3')],
    to: '/',
    cta: t('aboutPage.discoverButton'),
    dark: false,
  },
  {
    icon: 'calendar-plus',
    title: t('aboutPage.forOrganizersTitle'),
    points: [t('aboutPage.forOrganizers1'), t('aboutPage.forOrganizers2'), t('aboutPage.forOrganizers3')],
    to: '/organisateur/tarifs',
    cta: t('organizerPricingPage.eyebrow'),
    dark: true,
  },
])

const payments = ['Orange Money', 'MTN MoMo', 'Moov Money', 'Wave', 'Visa', 'Mastercard']
</script>

<template>
  <div>
    <!-- 1re section : grande image plein cadre, texte superposé -->
    <section class="relative isolate overflow-hidden bg-tikeo-ink text-white">
      <img
        :src="heroImage"
        alt=""
        class="absolute inset-0 -z-20 h-full w-full object-cover"
        fetchpriority="high"
        decoding="async"
      />
      <div class="absolute inset-0 -z-10 bg-gradient-to-r from-tikeo-ink via-tikeo-ink/80 to-tikeo-ink/20" aria-hidden="true" />
      <div class="absolute inset-0 -z-10 bg-gradient-to-t from-tikeo-ink via-transparent to-tikeo-ink/40" aria-hidden="true" />
      <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
      <div class="pointer-events-none absolute -bottom-24 -left-24 -z-10 h-72 w-72 rounded-full bg-[#FF7A00]/25 blur-3xl" aria-hidden="true" />

      <div class="mx-auto flex min-h-[460px] max-w-tikeo-container flex-col justify-end px-4 pb-24 pt-16 md:min-h-[600px] md:px-6 md:pb-32 md:pt-24">
        <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/70">
          <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
          {{ t('aboutPage.eyebrow') }}
        </p>
        <h1 class="mt-3 max-w-3xl font-display text-[2.1rem] font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          {{ t('aboutPage.title') }}
        </h1>
        <p class="mt-5 max-w-xl text-sm leading-relaxed text-white/80 md:text-lg">{{ t('aboutPage.intro') }}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <NuxtLink to="/" class="btn-brand">{{ t('aboutPage.discoverButton') }}</NuxtLink>
          <NuxtLink
            to="/contact"
            class="inline-flex h-12 items-center justify-center gap-2 border border-white/40 px-6 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white hover:text-tikeo-ink"
          >
            {{ t('aboutPage.contactButton') }}
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- Chiffres : bandeau qui chevauche le hero -->
    <section class="relative z-10 mx-auto -mt-12 max-w-tikeo-container md:-mt-16 px-4 md:px-6">
      <dl class="grid grid-cols-3 divide-x divide-tikeo-border border border-tikeo-border bg-tikeo-surface shadow-card-hover">
        <div v-for="s in statItems" :key="s.label" class="px-2 py-5 text-center md:py-8">
          <dt class="sr-only">{{ s.label }}</dt>
          <dd class="font-display text-3xl font-extrabold leading-none tracking-tight text-tikeo-black md:text-6xl">
            <span class="text-[#FF7A00]">{{ s.value }}</span>
          </dd>
          <p class="mt-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-tikeo-gray-text md:text-xs">{{ s.label }}</p>
        </div>
      </dl>
    </section>

    <!-- Mission + billet des moyens de paiement -->
    <section class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6 md:py-20">
      <div class="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-16">
        <div>
          <SectionHeading :eyebrow="t('aboutPage.eyebrow')" :title="t('aboutPage.missionTitle')" />
          <p class="mt-5 max-w-xl text-base leading-relaxed text-tikeo-gray-text md:text-lg">{{ t('aboutPage.missionText') }}</p>
        </div>

        <!-- Faux billet : encoches + perforation -->
        <div class="relative mx-auto w-full max-w-md bg-tikeo-ink text-white shadow-card-hover">
          <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
          <div class="flex items-center justify-between gap-4 p-6 pt-7">
            <div>
              <p class="font-display text-2xl font-extrabold tracking-tight">Tikeo</p>
              <p class="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/60">{{ t('aboutPage.paymentsTitle') }}</p>
            </div>
            <span class="flex h-14 w-14 shrink-0 items-center justify-center bg-white text-tikeo-ink">
              <AppIcon name="qr" class="h-9 w-9" :stroke="1.6" />
            </span>
          </div>
          <div class="relative">
            <div class="border-t-2 border-dashed border-white/25" />
            <span class="absolute -left-3 -top-3 h-6 w-6 rounded-full bg-tikeo-surface-alt" aria-hidden="true" />
            <span class="absolute -right-3 -top-3 h-6 w-6 rounded-full bg-tikeo-surface-alt" aria-hidden="true" />
          </div>
          <div class="p-6">
            <p class="text-sm text-white/75">{{ t('aboutPage.paymentsText') }}</p>
            <ul class="mt-4 flex flex-wrap gap-2">
              <li v-for="p in payments" :key="p" class="border border-white/25 px-3 py-1.5 text-xs font-bold">{{ p }}</li>
            </ul>
          </div>
        </div>
      </div>
    </section>

    <!-- Valeurs -->
    <section class="border-y border-tikeo-border bg-tikeo-surface-alt">
      <div class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6 md:py-20">
        <SectionHeading :title="t('aboutPage.valuesTitle')" center />
        <div class="mt-10 grid gap-5 md:grid-cols-3">
          <article
            v-for="(v, i) in values"
            :key="v.title"
            class="group relative overflow-hidden border border-tikeo-border bg-tikeo-surface p-6 shadow-card transition-transform duration-300 hover:-translate-y-1 md:p-8"
          >
            <span class="absolute right-5 top-4 font-display text-6xl font-extrabold leading-none text-tikeo-surface-alt" aria-hidden="true">0{{ i + 1 }}</span>
            <span class="relative flex h-12 w-12 items-center justify-center bg-tikeo-ink text-white transition-colors duration-200 group-hover:bg-[#FF7A00] group-hover:text-tikeo-ink dark:bg-[#FF7A00] dark:text-tikeo-ink">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" :d="icons[v.icon]" />
              </svg>
            </span>
            <h3 class="relative mt-5 font-display text-xl font-extrabold text-tikeo-black">{{ v.title }}</h3>
            <p class="relative mt-2 text-sm leading-relaxed text-tikeo-gray-text md:text-[15px]">{{ v.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- Pour qui ? -->
    <section class="mx-auto max-w-tikeo-container px-4 py-12 md:px-6 md:py-20">
      <div class="grid gap-5 md:grid-cols-2">
        <article
          v-for="a in audiences"
          :key="a.title"
          class="flex flex-col border p-6 shadow-card md:p-8"
          :class="a.dark ? 'border-tikeo-ink bg-tikeo-ink text-white' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black'"
        >
          <span class="flex h-12 w-12 items-center justify-center bg-[#FF7A00] text-tikeo-ink">
            <AppIcon :name="a.icon" class="h-6 w-6" :stroke="2" />
          </span>
          <h3 class="mt-5 font-display text-2xl font-extrabold">{{ a.title }}</h3>
          <ul class="mt-5 flex-1 space-y-3">
            <li v-for="p in a.points" :key="p" class="flex items-start gap-3 text-sm md:text-[15px]">
              <AppIcon name="check" class="mt-0.5 h-5 w-5 shrink-0 text-[#FF7A00]" :stroke="2.6" />
              <span :class="a.dark ? 'text-white/85' : 'text-tikeo-gray-text'">{{ p }}</span>
            </li>
          </ul>
          <NuxtLink
            :to="a.to"
            class="mt-7 inline-flex items-center gap-2 text-sm font-bold underline decoration-[#FF7A00] decoration-2 underline-offset-[6px] transition-colors hover:text-[#FF7A00]"
          >
            {{ a.cta }}
            <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
          </NuxtLink>
        </article>
      </div>
    </section>

    <OrganizerCtaBanner />
  </div>
</template>
