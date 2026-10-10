<script setup lang="ts">
const { t } = useI18n()
const year = new Date().getFullYear()
const { openPreferences } = useCookieConsent()

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Logos réellement utilisés au paiement (public/paiement/*).
const payments = [
  { name: 'Orange Money', src: '/paiement/orange-money.png' },
  { name: 'MTN MoMo', src: '/paiement/mtn.png' },
  { name: 'Moov Money', src: '/paiement/moov.png' },
  { name: 'Wave', src: '/paiement/wave.png' },
  { name: 'Djamo', src: '/paiement/djamo.png' },
  { name: 'Carte bancaire', src: '/paiement/carte.png' },
]

const columns = computed(() => [
  {
    title: t('footer.discover'),
    links: [
      { to: '/evenements', label: t('footer.allEvents') },
      { to: '/recherche', label: t('header.search') },
      { to: '/mon-espace/mes-billets', label: t('header.myTickets') },
      { to: '/mon-espace/mes-favoris', label: t('header.favorites') },
    ],
  },
  {
    title: t('footer.organizer'),
    links: [
      { to: '/organisateur', label: t('footer.becomeOrganizer') },
      { to: '/organisateur/evenements/nouveau', label: t('header.publish') },
      { to: '/organisateur/tarifs', label: t('header.pricing') },
    ],
  },
  {
    title: t('footer.support'),
    links: [
      { to: '/faq', label: t('header.faq') },
      { to: '/contact', label: t('footer.customerService') },
      { to: '/avis', label: t('feedback.footerLink') },
      { to: '/conditions', label: t('footer.refundPolicy') },
      { to: '/conditions', label: t('footer.legal') },
    ],
  },
  {
    title: t('footer.about'),
    links: [
      { to: '/qui-sommes-nous', label: t('header.about') },
      { to: '/partenaires', label: t('partners.navLabel') },
      { to: '/contact', label: t('header.contact2') },
      { to: '/conditions', label: t('footer.terms') },
      { to: '/confidentialite', label: t('footer.privacy') },
    ],
  },
])
</script>

<template>
  <footer class="relative mt-12 overflow-hidden bg-tikeo-ink text-white">
    <!-- Bord de billet déchiré : demi-cercles découpés dans le fond de page -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[7px]"
      style="background-image: radial-gradient(circle at 50% 0, rgb(var(--tikeo-surface-alt)) 6px, transparent 6.5px); background-size: 24px 7px"
      aria-hidden="true"
    />

    <!-- Mot-symbole géant, purement décoratif -->
    <p
      class="pointer-events-none absolute -bottom-[0.18em] left-1/2 -translate-x-1/2 select-none whitespace-nowrap font-display text-[26vw] font-extrabold leading-none tracking-tighter text-white/[0.035] lg:text-[17rem]"
      aria-hidden="true"
    >
      Tikeo
    </p>

    <div class="relative mx-auto max-w-tikeo-container px-4 pb-24 pt-10 md:px-6 md:pb-6 md:pt-12">
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2.9fr)] lg:gap-14">
        <!-- Marque -->
        <div>
          <NuxtLink to="/" class="inline-block bg-white p-2" aria-label="Tikeo">
            <img src="/logo-tikeo.png" alt="Tikeo" width="174" height="56" loading="lazy" class="h-8 w-auto md:h-9" />
          </NuxtLink>
          <p class="mt-4 max-w-xs font-display text-lg font-bold leading-snug md:text-xl">{{ t('footer.tagline') }}</p>
        </div>

        <!-- Liens -->
        <nav class="grid grid-cols-2 gap-x-6 gap-y-7 sm:grid-cols-4" :aria-label="'Tikeo'">
          <div v-for="col in columns" :key="col.title">
            <h3 class="mb-3 flex items-center gap-2 font-display text-[15px] font-bold">
              <span class="h-3 w-1 bg-[#FF7A00]" aria-hidden="true" />
              {{ col.title }}
            </h3>
            <ul class="space-y-1.5 text-[13px] leading-snug">
              <li v-for="l in col.links" :key="l.label">
                <NuxtLink :to="l.to" class="group inline-flex items-center gap-1 text-white/70 transition-colors hover:text-white">
                  <span class="underline decoration-transparent decoration-2 underline-offset-[5px] transition-colors group-hover:decoration-[#FF7A00]">{{ l.label }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <!-- Réseaux sociaux + moyens de paiement : une seule ligne (elle passe à la ligne sur très petit écran) -->
      <div class="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-white/10 pt-5">
        <div class="flex items-center gap-3">
          <p class="text-[11px] font-bold uppercase tracking-wider text-white/55">{{ t('footer.followUs') }}</p>
          <ul class="flex gap-1.5">
            <li v-for="s in SOCIAL_LINKS" :key="s.name">
              <a
                :href="s.href"
                target="_blank"
                rel="noopener noreferrer"
                :aria-label="s.name"
                :title="s.name"
                class="flex h-9 w-9 items-center justify-center border border-white/20 text-white transition-colors duration-200 hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink"
              >
                <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="currentColor"><path :d="s.path" /></svg>
              </a>
            </li>
          </ul>
        </div>

        <div class="flex items-center gap-3">
          <p class="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-white/55">
            <AppIcon name="shield-check" class="h-4 w-4 text-[#FF9A3D]" />
            <span class="hidden sm:inline">{{ t('footer.payTitle') }}</span>
          </p>
          <ul class="flex gap-1.5">
            <li v-for="p in payments" :key="p.name">
              <img :src="p.src" :alt="p.name" :title="p.name" width="36" height="36" loading="lazy" class="h-9 w-9 bg-white object-contain p-1" />
            </li>
          </ul>
        </div>
      </div>

      <!-- Barre basse -->
      <div class="mt-5 flex flex-col gap-4 border-t border-white/10 pt-4 md:flex-row md:items-center md:justify-between">
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-white/60">
          <span>© {{ year }} Tikeo</span>
          <NuxtLink to="/confidentialite" class="transition-colors hover:text-white">{{ t('footer.privacy') }}</NuxtLink>
          <NuxtLink to="/conditions" class="transition-colors hover:text-white">{{ t('footer.terms') }}</NuxtLink>
          <button type="button" class="transition-colors hover:text-white" @click="openPreferences">{{ t('footer.cookies') }}</button>
        </div>

        <div class="flex items-center justify-between gap-4 md:justify-end">
          <p class="text-xs text-white/60">{{ t('footer.madeIn') }}</p>
          <div class="flex items-center gap-3">
            <LanguageSwitcher
              up
              class="[&>button]:border-white/25 [&>button]:bg-transparent [&>button]:text-white/80 [&>button:hover]:border-[#FF7A00] [&>button:hover]:text-[#FF9A3D]"
            />
            <button
              type="button"
              class="flex h-9 w-9 items-center justify-center bg-[#FF7A00] text-tikeo-ink transition-colors duration-200 hover:bg-white"
              :aria-label="t('footer.backToTop')"
              @click="scrollTop"
            >
              <AppIcon name="arrow-up" class="h-4 w-4" :stroke="2.6" />
            </button>
          </div>
        </div>
      </div>
    </div>
  </footer>
</template>
