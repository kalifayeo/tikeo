<script setup lang="ts">
/**
 * Page d'explication du scanner pour les comptes qui n'y ont pas accès
 * (visiteurs et acheteurs). Les admins et organisateurs, eux, vont
 * directement sur /organisateur/evenements/scanner.
 */
const { t } = useI18n()
const { isAuthenticated } = useAuth()
const canScan = useCanScan()

// Un compte autorisé qui arrive ici (lien partagé, favori...) est renvoyé vers le vrai scanner.
if (canScan.value) await navigateTo('/organisateur/evenements/scanner', { replace: true })

const steps = computed(() => [
  { icon: 'calendar-plus', title: t('scannerInfo.step1Title'), text: t('scannerInfo.step1Text') },
  { icon: 'ticket', title: t('scannerInfo.step2Title'), text: t('scannerInfo.step2Text') },
  { icon: 'scan', title: t('scannerInfo.step3Title'), text: t('scannerInfo.step3Text') },
])
</script>

<template>
  <div class="mx-auto max-w-2xl px-4 py-10 md:py-16">
    <div class="border border-tikeo-border bg-tikeo-surface p-6 text-center shadow-card md:p-10">
      <span class="mx-auto flex h-16 w-16 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="scan" class="h-8 w-8" />
      </span>
      <h1 class="mt-5 font-display text-2xl font-extrabold leading-tight text-tikeo-black md:text-3xl">{{ t('scannerInfo.title') }}</h1>
      <p class="mx-auto mt-3 max-w-md text-sm leading-relaxed text-tikeo-gray-text md:text-base">
        {{ isAuthenticated ? t('scannerInfo.introBuyer') : t('scannerInfo.introVisitor') }}
      </p>

      <ol class="mt-8 space-y-3 text-left">
        <li v-for="(s, i) in steps" :key="s.icon" class="flex items-start gap-3 border border-tikeo-border p-3.5">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink">
            <AppIcon :name="s.icon" class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <p class="text-sm font-bold text-tikeo-black">{{ i + 1 }}. {{ s.title }}</p>
            <p class="mt-0.5 text-xs leading-relaxed text-tikeo-gray-text md:text-sm">{{ s.text }}</p>
          </div>
        </li>
      </ol>

      <p class="mt-6 flex items-start gap-2 border-l-4 border-[#FF7A00] bg-[#FF7A00]/10 px-4 py-2.5 text-left text-sm text-tikeo-black">
        <AppIcon name="info" class="mt-0.5 h-4 w-4 shrink-0 text-tikeo-orange" />
        {{ t('scannerInfo.buyerNote') }}
      </p>

      <div class="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <template v-if="isAuthenticated">
          <NuxtLink to="/mon-espace/mes-billets" class="btn-ink">
            <AppIcon name="qr" class="h-5 w-5" />{{ t('scannerInfo.myTickets') }}
          </NuxtLink>
          <NuxtLink to="/organisateur/tarifs" class="acc-btn-ghost !h-12">{{ t('scannerInfo.becomeOrganizer') }}</NuxtLink>
        </template>
        <template v-else>
          <NuxtLink :to="{ path: '/connexion', query: { redirect: '/organisateur/evenements/scanner' } }" class="btn-ink">
            <AppIcon name="login" class="h-5 w-5" />{{ t('scannerInfo.login') }}
          </NuxtLink>
          <NuxtLink to="/evenements" class="acc-btn-ghost !h-12">{{ t('common.browseEvents') }}</NuxtLink>
        </template>
      </div>
    </div>
  </div>
</template>
