<script setup lang="ts">
const { t } = useI18n()

const items = computed(() => [
  { q: t('faqPage.q1'), a: t('faqPage.a1'), cat: t('faqPage.catBuyers') },
  { q: t('faqPage.q2'), a: t('faqPage.a2'), cat: t('faqPage.catBuyers') },
  { q: t('faqPage.q3'), a: t('faqPage.a3'), cat: t('faqPage.catBuyers') },
  { q: t('faqPage.q4'), a: t('faqPage.a4'), cat: t('faqPage.catOrganizers') },
  { q: t('faqPage.q6'), a: t('faqPage.a6'), cat: t('faqPage.catOrganizers') },
  { q: t('faqPage.q8'), a: t('faqPage.a8'), cat: t('faqPage.catOrganizers') },
  { q: t('faqPage.q5'), a: t('faqPage.a5'), cat: t('faqPage.catPayment') },
  { q: t('faqPage.q7'), a: t('faqPage.a7'), cat: t('faqPage.catAccount') },
])

const openIndex = ref<number | null>(0)
function toggle(i: number) {
  openIndex.value = openIndex.value === i ? null : i
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-14">
    <div class="mb-8 text-center">
      <h1 class="text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ t('faqPage.title') }}</h1>
      <p class="mt-3 text-sm text-tikeo-gray-text md:text-base">{{ t('faqPage.intro') }}</p>
    </div>

    <div class="divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
      <div v-for="(item, i) in items" :key="i">
        <button
          type="button"
          class="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
          @click="toggle(i)"
        >
          <span>
            <span class="mb-1 block text-[10px] font-bold uppercase tracking-wide text-tikeo-orange">{{ item.cat }}</span>
            <span class="block text-sm font-semibold text-tikeo-black md:text-base">{{ item.q }}</span>
          </span>
          <svg
            class="h-5 w-5 shrink-0 text-tikeo-gray-text transition-transform"
            :class="{ 'rotate-180': openIndex === i }"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-show="openIndex === i" class="px-4 pb-4 text-sm leading-relaxed text-tikeo-gray-text">
          {{ item.a }}
        </div>
      </div>
    </div>

    <div class="mt-8 flex flex-col items-center gap-3 border border-dashed border-tikeo-border p-6 text-center">
      <p class="text-sm text-tikeo-gray-text">{{ t('faqPage.stillQuestion') }}</p>
      <NuxtLink to="/contact" class="btn-primary">{{ t('faqPage.contactButton') }}</NuxtLink>
    </div>
  </div>
</template>
