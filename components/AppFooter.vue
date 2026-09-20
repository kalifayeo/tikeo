<script setup lang="ts">
const { t } = useI18n()
const year = new Date().getFullYear()
const { openPreferences } = useCookieConsent()

function scrollTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
}
</script>

<template>
  <footer class="mt-8 border-t border-tikeo-border bg-tikeo-surface">
    <div class="mx-auto grid max-w-tikeo-container grid-cols-2 gap-x-6 gap-y-8 px-6 py-10 sm:gap-x-8 md:grid-cols-4">
      <div>
        <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-tikeo-black">{{ t('footer.about') }}</h3>
        <ul class="space-y-2 text-sm text-tikeo-gray-text">
          <li><NuxtLink to="/qui-sommes-nous" class="hover:text-tikeo-orange">{{ t('header.about') }}</NuxtLink></li>
          <li><NuxtLink to="/evenements" class="hover:text-tikeo-orange">{{ t('footer.allEvents') }}</NuxtLink></li>
          <li><NuxtLink to="/contact" class="hover:text-tikeo-orange">{{ t('header.contact2') }}</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-tikeo-black">{{ t('footer.community') }}</h3>
        <ul class="space-y-2 text-sm text-tikeo-gray-text">
          <li><a href="#" class="hover:text-tikeo-orange">{{ t('footer.socialNetworks') }}</a></li>
          <li><a href="#" class="hover:text-tikeo-orange">{{ t('footer.physicalOutlets') }}</a></li>
          <li><NuxtLink to="/faq" class="hover:text-tikeo-orange">{{ t('header.faq') }}</NuxtLink></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-tikeo-black">{{ t('footer.organizer') }}</h3>
        <ul class="space-y-2 text-sm text-tikeo-gray-text">
          <li><NuxtLink to="/organisateur" class="hover:text-tikeo-orange">{{ t('footer.becomeOrganizer') }}</NuxtLink></li>
          <li><NuxtLink to="/organisateur/tarifs" class="hover:text-tikeo-orange">{{ t('header.pricing') }}</NuxtLink></li>
          <li><a href="#" class="hover:text-tikeo-orange">{{ t('footer.references') }}</a></li>
        </ul>
      </div>
      <div>
        <h3 class="mb-3 text-xs font-bold uppercase tracking-wide text-tikeo-black">{{ t('footer.support') }}</h3>
        <ul class="space-y-2 text-sm text-tikeo-gray-text">
          <li><NuxtLink to="/contact" class="hover:text-tikeo-orange">{{ t('footer.customerService') }}</NuxtLink></li>
          <li><a href="#" class="hover:text-tikeo-orange">{{ t('footer.refundPolicy') }}</a></li>
          <li><NuxtLink to="/conditions" class="hover:text-tikeo-orange">{{ t('footer.legal') }}</NuxtLink></li>
        </ul>
      </div>
    </div>

    <div class="border-t border-tikeo-border">
      <div class="mx-auto flex max-w-tikeo-container flex-col items-center justify-between gap-3 px-6 py-4 md:flex-row">
        <div class="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-tikeo-gray-text">
          <NuxtLink to="/confidentialite" class="hover:text-tikeo-orange">{{ t('footer.privacy') }}</NuxtLink>
          <NuxtLink to="/conditions" class="hover:text-tikeo-orange">{{ t('footer.terms') }}</NuxtLink>
          <button type="button" class="hover:text-tikeo-orange" @click="openPreferences">{{ t('footer.cookies') }}</button>
          <span>© {{ year }} Tikeo</span>
        </div>

        <div class="flex items-center gap-3">
          <LanguageSwitcher />
          <div class="flex items-center gap-2.5 text-tikeo-gray-text">
            <a href="#" aria-label="Facebook" class="hover:text-tikeo-orange">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12a10 10 0 10-11.6 9.9v-7H7.9V12h2.5V9.8c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.5h-1.3c-1.2 0-1.6.8-1.6 1.6V12h2.8l-.4 2.9h-2.4v7A10 10 0 0022 12z" /></svg>
            </a>
            <a href="#" aria-label="Instagram" class="hover:text-tikeo-orange">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="4" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>
            </a>
            <a href="#" aria-label="TikTok" class="hover:text-tikeo-orange">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M16.5 2h-3v13.5a2.5 2.5 0 11-2-2.45V10a5.5 5.5 0 105.5 5.5V8.8a6.6 6.6 0 003.5 1V6.8a3.5 3.5 0 01-3.5-3.5V2z" /></svg>
            </a>
            <a href="#" aria-label="LinkedIn" class="hover:text-tikeo-orange">
              <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M4.98 3.5a2 2 0 110 4 2 2 0 010-4zM3 9h4v12H3V9zm7 0h3.8v1.7h.1c.5-.9 1.8-1.9 3.7-1.9 4 0 4.7 2.6 4.7 6V21h-4v-5.4c0-1.3 0-3-1.8-3s-2.1 1.4-2.1 2.9V21h-4V9z" /></svg>
            </a>
          </div>
          <button
            type="button"
            class="flex h-8 w-8 items-center justify-center bg-tikeo-orange text-white hover:bg-tikeo-orange-dark transition-colors duration-200"
            :aria-label="t('footer.backToTop')"
            @click="scrollTop"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>
