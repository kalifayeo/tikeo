<script setup lang="ts">
/**
 * Gabarit des pages légales (conditions, confidentialité) : en-tête « encre »
 * comme le reste du site, sommaire collant qui suit la lecture sur desktop,
 * sommaire défilant sur mobile, articles numérotés en cartes carrées, puis un
 * bloc contact et un lien vers l'autre document.
 */
const props = defineProps<{
  title: string
  updatedAt: string
  intro: string
  sections: Array<{ title: string; text: string }>
  /** Autre document légal proposé en bas de page. */
  other: { to: string; label: string }
}>()

const { t } = useI18n()

// « 3. Achat de billets » → numéro (affiché dans un carré) + libellé seul.
const items = computed(() =>
  props.sections.map((s, i) => ({
    id: `article-${i + 1}`,
    n: i + 1,
    title: s.title.replace(/^\d+\.\s*/, ''),
    text: s.text,
  })),
)

const activeId = ref('article-1')
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
      if (visible.length) activeId.value = visible[0].target.id
    },
    { rootMargin: '-90px 0px -65% 0px', threshold: 0 },
  )
  document.querySelectorAll('[data-legal-article]').forEach((el) => observer!.observe(el))
})
onBeforeUnmount(() => observer?.disconnect())

function print() {
  window.print()
}
function toTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <div>
    <PageHero :eyebrow="t('legalPage.eyebrow')" :title="title" :subtitle="intro">
      <div class="flex flex-wrap items-center gap-3">
        <span class="inline-flex h-9 items-center gap-2 border border-white/25 px-3 text-xs font-semibold text-white/85">
          <AppIcon name="calendar" class="h-4 w-4" />
          {{ updatedAt }}
        </span>
        <button
          type="button"
          class="inline-flex h-9 items-center gap-2 border border-white/25 px-3 text-xs font-bold text-white transition-colors hover:border-[#FF7A00] hover:bg-[#FF7A00] hover:text-tikeo-ink print:hidden"
          @click="print"
        >
          {{ t('legalPage.print') }}
        </button>
      </div>
    </PageHero>

    <div class="mx-auto max-w-tikeo-container px-4 py-8 md:px-6 md:py-12 lg:grid lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-12">
      <!-- Sommaire -->
      <nav
        :aria-label="t('legalPage.toc')"
        class="mb-8 print:hidden lg:sticky lg:top-24 lg:mb-0 lg:border lg:border-tikeo-border lg:bg-tikeo-surface lg:p-3 lg:shadow-card"
      >
        <p class="mb-3 hidden px-3 pt-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text lg:block">{{ t('legalPage.toc') }}</p>
        <ol class="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:px-0">
          <li v-for="it in items" :key="it.id" class="shrink-0 lg:shrink">
            <a
              :href="`#${it.id}`"
              class="flex h-10 items-center gap-2.5 border px-3 text-sm font-semibold transition-colors duration-200 lg:h-auto lg:border-transparent lg:py-2.5"
              :class="
                activeId === it.id
                  ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                  : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00] lg:hover:bg-tikeo-surface-alt'
              "
            >
              <span class="text-[11px] font-extrabold opacity-60">{{ String(it.n).padStart(2, '0') }}</span>
              <span class="whitespace-nowrap lg:whitespace-normal">{{ it.title }}</span>
            </a>
          </li>
        </ol>
      </nav>

      <!-- Articles -->
      <div class="min-w-0 space-y-4">
        <article
          v-for="it in items"
          :id="it.id"
          :key="it.id"
          data-legal-article
          class="scroll-mt-24 border border-tikeo-border bg-tikeo-surface p-5 shadow-card md:p-8"
        >
          <div class="flex items-center gap-4">
            <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink font-display text-lg font-extrabold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
              {{ it.n }}
            </span>
            <h2 class="font-display text-xl font-extrabold leading-tight tracking-tight text-tikeo-black md:text-2xl">{{ it.title }}</h2>
          </div>
          <p class="mt-4 text-[15px] leading-relaxed text-tikeo-gray-text md:pl-[3.75rem] md:text-base md:leading-7">{{ it.text }}</p>
        </article>

        <!-- Contact + autre document -->
        <div class="grid gap-4 pt-4 md:grid-cols-2 print:hidden">
          <div class="relative isolate overflow-hidden bg-tikeo-ink p-6 text-white">
            <div class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
            <span class="flex h-11 w-11 items-center justify-center bg-[#FF7A00] text-tikeo-ink">
              <AppIcon name="mail" class="h-6 w-6" :stroke="2" />
            </span>
            <h2 class="mt-4 font-display text-xl font-extrabold">{{ t('legalPage.questionTitle') }}</h2>
            <p class="mt-1 text-sm text-white/75">{{ t('legalPage.questionText') }}</p>
            <NuxtLink to="/contact" class="btn-brand mt-5 !h-11">
              {{ t('legalPage.contactButton') }}
              <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
            </NuxtLink>
          </div>
          <div class="flex flex-col border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
            <span class="flex h-11 w-11 items-center justify-center bg-tikeo-surface-alt text-tikeo-black">
              <AppIcon name="shield-check" class="h-6 w-6" />
            </span>
            <p class="mt-4 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('legalPage.seeAlso') }}</p>
            <h2 class="mt-1 font-display text-xl font-extrabold text-tikeo-black">{{ other.label }}</h2>
            <NuxtLink :to="other.to" class="acc-link mt-auto inline-flex items-center gap-2 self-start pt-5">
              {{ t('legalPage.read') }}
              <AppIcon name="arrow-right" class="h-4 w-4" :stroke="2.4" />
            </NuxtLink>
          </div>
        </div>

        <div class="flex justify-end pt-2 print:hidden">
          <a href="#top" class="acc-btn-ghost" @click.prevent="toTop">
            <AppIcon name="arrow-up" class="h-4 w-4" :stroke="2.4" />
            {{ t('legalPage.backToTop') }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
