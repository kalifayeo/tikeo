<script setup lang="ts">
// Bannière de consentement aux cookies (cahier des charges : conformité
// RGPD / loi ivoirienne 2013-450). Accepter et Refuser ont le même poids
// visuel — refuser ne doit pas être plus difficile qu'accepter.
const { t } = useI18n()
const { bannerVisible, setConsent } = useCookieConsent()
</script>

<template>
  <Transition
    enter-active-class="transition duration-300 ease-out"
    enter-from-class="translate-y-4 opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition duration-200 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-4 opacity-0"
  >
    <div
      v-if="bannerVisible"
      role="dialog"
      aria-live="polite"
      :aria-label="t('cookies.title')"
      class="fixed inset-x-3 bottom-20 z-[90] border border-tikeo-border bg-tikeo-surface p-4 shadow-card-hover md:inset-x-auto md:bottom-4 md:right-4 md:w-[26rem]"
    >
      <p class="text-sm font-bold text-tikeo-black">{{ t('cookies.title') }}</p>
      <p class="mt-1 text-xs leading-relaxed text-tikeo-gray-text">
        {{ t('cookies.text') }}
        <NuxtLink to="/confidentialite" class="font-semibold text-tikeo-blue underline">{{ t('cookies.learnMore') }}</NuxtLink>
      </p>
      <div class="mt-3 grid grid-cols-2 gap-2">
        <button type="button" class="btn-secondary !py-2 !text-xs" @click="setConsent('refused')">{{ t('cookies.refuse') }}</button>
        <button type="button" class="btn-primary !py-2 !text-xs" @click="setConsent('accepted')">{{ t('cookies.accept') }}</button>
      </div>
    </div>
  </Transition>
</template>
