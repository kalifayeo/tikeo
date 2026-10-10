<script setup lang="ts">
// Tarifs organisateurs : une commission par billet vendu qui BAISSE avec les
// ventes cumulées (paliers lus dans la table commission_tiers, migration 0047).
// Aucun forfait à choisir ni à payer. L'organisateur choisit, par événement,
// qui paie la commission (lui ou l'acheteur) — voir l'assistant de création.
const { t, locale } = useI18n()
const { isAuthenticated } = useAuth()
const { tiers, status, fetchTiers, fetchStatus } = useCommission()

useSeoMeta({
  title: () => `${t('organizerPricingPage.eyebrow')} | Tikeo`,
  description: () => t('organizerPricingPage.intro'),
})

onMounted(async () => {
  await fetchTiers()
  if (isAuthenticated.value) await fetchStatus()
})

const fmt = (n: number) => new Intl.NumberFormat(locale.value, { maximumFractionDigits: 0 }).format(Math.round(n))
const fmtRate = (n: number) => String(n).replace('.', ',')

// Paliers triés + bornes lisibles : « de 0 à 1 000 000 », « au-delà de 20 000 000 ».
const ladder = computed(() => {
  const list = [...tiers.value].sort((a, b) => a.min_sales - b.min_sales)
  return list.map((tier, i) => {
    const next = list[i + 1]
    return {
      ...tier,
      max: next ? next.min_sales : null,
      range: next
        ? t('organizerPricingPage.tierRange', { from: fmt(tier.min_sales), to: fmt(next.min_sales) })
        : t('organizerPricingPage.tierBeyond', { from: fmt(tier.min_sales) }),
      current: !!status.value && !status.value.custom && status.value.rate === tier.rate && status.value.sales >= tier.min_sales && (!next || status.value.sales < next.min_sales),
    }
  })
})

const steps = computed(() => [
  { title: t('organizerBanner.step1Title'), text: t('organizerBanner.step1Text') },
  { title: t('organizerBanner.step2Title'), text: t('organizerBanner.step2Text') },
  { title: t('organizerBanner.step3Title'), text: t('organizerBanner.step3Text') },
])

const included = computed(() => [
  { icon: 'qr', text: t('organizerPricingPage.included1') },
  { icon: 'card', text: t('organizerPricingPage.included2') },
  { icon: 'dashboard', text: t('organizerPricingPage.included3') },
  { icon: 'shield-check', text: t('organizerPricingPage.included4') },
])

// --- Simulateur : calcul progressif par palier (comme en base : chaque vente
// est facturée au taux du palier atteint par les ventes cumulées) ------------
const price = ref(5000)
const qty = ref(200)
const safe = (n: unknown) => Math.max(0, Number(n) || 0)
const gross = computed(() => safe(price.value) * safe(qty.value))
const breakdown = computed(() =>
  ladder.value
    .map((tier) => {
      const upper = tier.max ?? Infinity
      const amount = Math.max(0, Math.min(gross.value, upper) - tier.min_sales)
      return { ...tier, amount, fee: (amount * tier.rate) / 100 }
    })
    .filter((row) => row.amount > 0),
)
const fee = computed(() => breakdown.value.reduce((sum, r) => sum + r.fee, 0))
const avgRate = computed(() => (gross.value > 0 ? (fee.value / gross.value) * 100 : 0))
const feePerTicket = computed(() => (safe(qty.value) > 0 ? fee.value / safe(qty.value) : 0))

const faqs = computed(() => [
  { q: t('organizerPricingPage.faq1q'), a: t('organizerPricingPage.faq1a') },
  { q: t('organizerPricingPage.faq2q'), a: t('organizerPricingPage.faq2a') },
  { q: t('organizerPricingPage.faq3q'), a: t('organizerPricingPage.faq3a') },
  { q: t('organizerPricingPage.faq4q'), a: t('organizerPricingPage.faq4a') },
])
const openFaq = ref<number | null>(0)

const ctaLink = computed(() => (isAuthenticated.value ? '/devenir-organisateur' : '/inscription'))
</script>

<template>
  <div>
    <PageHero
      :eyebrow="t('organizerPricingPage.eyebrow')"
      :title="t('organizerPricingPage.title')"
      :subtitle="t('organizerPricingPage.intro')"
    >
      <div class="flex flex-wrap gap-3">
        <a href="#paliers" class="btn-brand">{{ t('organizerPricingPage.seeTiers') }}</a>
        <a
          href="#simulateur"
          class="inline-flex h-12 items-center justify-center gap-2 border border-white/30 px-6 text-sm font-bold text-white transition-colors hover:border-white hover:bg-white hover:text-tikeo-ink"
        >
          {{ t('organizerPricingPage.simTitle') }}
        </a>
      </div>
    </PageHero>

    <!-- Paliers -->
    <section id="paliers" class="mx-auto max-w-tikeo-container scroll-mt-24 px-4 pb-6 pt-10 md:px-6 md:pt-14">
      <p v-if="status" class="mb-6 border border-tikeo-border bg-tikeo-surface-alt px-4 py-3 text-sm text-tikeo-black">
        <template v-if="status.custom">{{ t('organizerPricingPage.yourRateCustom', { rate: fmtRate(status.rate) }) }}</template>
        <template v-else>
          {{ t('organizerPricingPage.yourRate', { rate: fmtRate(status.rate), sales: fmt(status.sales) }) }}
          <span v-if="status.next_min_sales"> {{ t('organizerPricingPage.yourNext', { rate: fmtRate(status.next_rate || 0), amount: fmt(status.next_min_sales - status.sales) }) }}</span>
        </template>
      </p>

      <div class="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-stretch">
        <article
          v-for="(tier, i) in ladder"
          :key="tier.min_sales"
          class="relative flex flex-col border p-6 shadow-card md:p-7"
          :class="tier.current ? 'border-[#FF7A00] bg-tikeo-ink text-white' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black'"
        >
          <span v-if="tier.current" class="absolute -top-3 left-6 bg-[#FF7A00] px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-tikeo-ink">
            {{ t('organizerPricingPage.yourTier') }}
          </span>
          <p class="text-[11px] font-bold uppercase tracking-wider" :class="tier.current ? 'text-white/60' : 'text-tikeo-gray-text'">
            {{ t('organizerPricingPage.tierLabel', { n: i + 1 }) }}
          </p>
          <p class="mt-4 flex items-baseline gap-2">
            <span class="font-display text-5xl font-extrabold leading-none tracking-tight" :class="tier.current ? 'text-[#FF7A00]' : 'text-tikeo-black'">{{ fmtRate(tier.rate) }}%</span>
            <span class="text-xs font-semibold" :class="tier.current ? 'text-white/70' : 'text-tikeo-gray-text'">{{ t('organizerPricingPage.perTicketSold') }}</span>
          </p>
          <p class="mt-5 border-t pt-4 text-sm font-semibold" :class="tier.current ? 'border-white/15' : 'border-tikeo-border'">
            {{ tier.range }}
          </p>
          <p class="mt-1 text-xs" :class="tier.current ? 'text-white/60' : 'text-tikeo-gray-text'">{{ t('organizerPricingPage.tierUnit') }}</p>
        </article>
      </div>
      <p class="mt-8 text-center text-xs text-tikeo-gray-text">{{ t('organizerPricingPage.commissionNote') }}</p>
    </section>

    <!-- Qui paie la commission -->
    <section class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6">
      <SectionHeading :eyebrow="t('organizerPricingPage.payerEyebrow')" :title="t('organizerPricingPage.payerTitle')" :text="t('organizerPricingPage.payerIntro')" />
      <div class="mt-8 grid gap-5 md:grid-cols-2">
        <div class="border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
          <h3 class="font-display text-lg font-extrabold text-tikeo-black">{{ t('organizerPricingPage.payerOrganizerTitle') }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-tikeo-gray-text">{{ t('organizerPricingPage.payerOrganizerText') }}</p>
        </div>
        <div class="border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
          <h3 class="font-display text-lg font-extrabold text-tikeo-black">{{ t('organizerPricingPage.payerBuyerTitle') }}</h3>
          <p class="mt-2 text-sm leading-relaxed text-tikeo-gray-text">{{ t('organizerPricingPage.payerBuyerText') }}</p>
        </div>
      </div>
    </section>

    <!-- Inclus partout -->
    <section class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6">
      <div class="border border-tikeo-border bg-tikeo-surface shadow-card">
        <p class="border-b border-tikeo-border px-5 py-3 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text md:px-6">
          {{ t('organizerPricingPage.includedTitle') }}
        </p>
        <ul class="grid grid-cols-2 lg:grid-cols-4">
          <li
            v-for="(it, i) in included"
            :key="it.text"
            class="flex items-center gap-3 border-tikeo-border p-4 md:p-5"
            :class="[i % 2 === 1 ? 'border-l' : '', i >= 2 ? 'border-t lg:border-t-0' : '', i > 0 ? 'lg:border-l' : '']"
          >
            <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-surface-alt text-tikeo-black">
              <AppIcon :name="it.icon" class="h-5 w-5" />
            </span>
            <span class="text-sm font-semibold leading-snug text-tikeo-black">{{ it.text }}</span>
          </li>
        </ul>
      </div>
    </section>

    <!-- Simulateur -->
    <section id="simulateur" class="mx-auto max-w-tikeo-container scroll-mt-24 px-4 py-10 md:px-6 md:py-16">
      <SectionHeading :eyebrow="t('organizerPricingPage.simEyebrow')" :title="t('organizerPricingPage.simTitle')" :text="t('organizerPricingPage.simIntro')" />

      <div class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div class="space-y-5 border border-tikeo-border bg-tikeo-surface p-6 shadow-card md:p-7">
          <div>
            <label for="sim-price" class="acc-label mb-1.5 block">{{ t('organizerPricingPage.simPrice') }}</label>
            <input id="sim-price" v-model.number="price" type="number" min="0" step="500" inputmode="numeric" class="field-input" />
          </div>
          <div>
            <label for="sim-qty" class="acc-label mb-1.5 block">{{ t('organizerPricingPage.simQty') }}</label>
            <input id="sim-qty" v-model.number="qty" type="number" min="0" step="10" inputmode="numeric" class="field-input" />
          </div>
          <div class="border-t border-dashed border-tikeo-border pt-5">
            <p class="acc-label">{{ t('organizerPricingPage.simGross') }}</p>
            <p class="mt-1 font-display text-3xl font-extrabold tracking-tight text-tikeo-black">
              {{ fmt(gross) }} <span class="text-base font-bold text-tikeo-gray-text">FCFA</span>
            </p>
          </div>
        </div>

        <div class="border border-tikeo-border bg-tikeo-surface shadow-card">
          <div class="grid grid-cols-2 divide-x divide-tikeo-border border-b border-tikeo-border">
            <div class="p-5 md:px-6">
              <p class="acc-label">{{ t('organizerPricingPage.simCommission') }}</p>
              <p class="mt-1 font-display text-2xl font-extrabold text-tikeo-black">{{ fmt(fee) }} <span class="text-xs font-bold text-tikeo-gray-text">FCFA</span></p>
              <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('organizerPricingPage.simAverage', { rate: avgRate.toFixed(1).replace('.', ','), perTicket: fmt(feePerTicket) }) }}</p>
            </div>
            <div class="p-5 md:px-6">
              <p class="acc-label">{{ t('organizerPricingPage.simNet') }}</p>
              <p class="mt-1 font-display text-2xl font-extrabold text-tikeo-black">{{ fmt(gross - fee) }} <span class="text-xs font-bold text-tikeo-gray-text">FCFA</span></p>
              <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('organizerPricingPage.simIfOrganizerPays') }}</p>
            </div>
          </div>
          <p class="border-b border-tikeo-border bg-tikeo-surface-alt px-5 py-3 text-xs text-tikeo-black md:px-6">
            {{ t('organizerPricingPage.simIfBuyerPays', { net: fmt(gross), perTicket: fmt(safe(price) + feePerTicket) }) }}
          </p>
          <ul class="divide-y divide-tikeo-border">
            <li v-for="row in breakdown" :key="row.min_sales" class="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm md:px-6">
              <span class="text-tikeo-gray-text">{{ row.range }}</span>
              <span class="font-semibold text-tikeo-black">{{ fmt(row.amount) }} × {{ fmtRate(row.rate) }}% = {{ fmt(row.fee) }} FCFA</span>
            </li>
          </ul>
          <p class="bg-tikeo-surface-alt px-5 py-3 text-[11px] text-tikeo-gray-text md:px-6">{{ t('organizerPricingPage.simNote') }}</p>
        </div>
      </div>
    </section>

    <!-- Comment ça marche -->
    <section class="border-y border-tikeo-border bg-tikeo-surface-alt">
      <div class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6 md:py-16">
        <SectionHeading :eyebrow="t('organizerPricingPage.howEyebrow')" :title="t('organizerPricingPage.howTitle')" center />
        <ol class="mt-10 grid gap-5 md:grid-cols-3">
          <li v-for="(s, i) in steps" :key="s.title" class="relative border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
            <span class="font-display text-5xl font-extrabold leading-none text-[#FF7A00]">0{{ i + 1 }}</span>
            <h3 class="mt-4 font-display text-lg font-bold text-tikeo-black">{{ s.title }}</h3>
            <p class="mt-1.5 text-sm leading-relaxed text-tikeo-gray-text">{{ s.text }}</p>
          </li>
        </ol>
      </div>
    </section>

    <!-- Sur mesure -->
    <section class="mx-auto max-w-tikeo-container px-4 py-10 md:px-6 md:py-16">
      <div class="relative isolate overflow-hidden bg-tikeo-ink p-6 text-white md:p-10">
        <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <div class="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-[#FF7A00]/20 blur-3xl" aria-hidden="true" />
        <div class="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div class="max-w-xl">
            <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
              <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
              {{ t('organizerPricingPage.customTagline') }}
            </p>
            <h2 class="mt-2 font-display text-2xl font-extrabold md:text-3xl">{{ t('organizerPricingPage.customName') }}</h2>
            <p class="mt-2 text-sm leading-relaxed text-white/75">{{ t('organizerPricingPage.customText') }}</p>
          </div>
          <NuxtLink to="/contact" class="btn-brand shrink-0 self-start md:self-auto">
            {{ t('organizerPricingPage.customButton') }}
            <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- FAQ tarifs -->
    <section class="mx-auto max-w-4xl px-4 pb-10 md:px-6 md:pb-16">
      <SectionHeading :title="t('organizerPricingPage.faqTitle')" center />
      <div class="mt-8 divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface shadow-card">
        <FaqItem
          v-for="(f, i) in faqs"
          :key="f.q"
          :question="f.q"
          :answer="f.a"
          :open="openFaq === i"
          @toggle="openFaq = openFaq === i ? null : i"
        />
      </div>
    </section>

    <!-- CTA final -->
    <section class="mx-auto max-w-tikeo-container px-4 pb-14 md:px-6 md:pb-20">
      <div class="flex flex-col items-start gap-6 bg-[#FF7A00] p-6 text-tikeo-ink md:flex-row md:items-center md:justify-between md:p-10">
        <div>
          <h2 class="font-display text-2xl font-extrabold leading-tight md:text-4xl">{{ t('organizerPricingPage.ctaTitle') }}</h2>
          <p class="mt-2 max-w-md text-sm font-medium md:text-base">{{ t('organizerPricingPage.ctaText') }}</p>
        </div>
        <NuxtLink
          :to="status ? '/organisateur/evenements/nouveau' : ctaLink"
          class="inline-flex h-12 shrink-0 items-center justify-center gap-2 bg-tikeo-ink px-7 text-sm font-bold text-white transition-colors hover:bg-white hover:text-tikeo-ink"
        >
          {{ status ? t('organizerPricingPage.ctaCreate') : t('organizerPricingPage.ctaButton') }}
          <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
        </NuxtLink>
      </div>
    </section>
  </div>
</template>
