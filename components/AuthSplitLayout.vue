<script setup lang="ts">
/**
 * Gabarit des pages connexion / inscription / mot de passe oublié : un grand
 * « billet » à deux volets — grande photo de concert à gauche (logo, promesse),
 * perforation avec encoches, formulaire à droite. Sur mobile l'image devient
 * un bandeau compact au-dessus du formulaire.
 */
defineProps<{ title: string; subtitle?: string }>()
const { t } = useI18n()
const year = new Date().getFullYear()

</script>

<template>
  <div class="flex min-h-[calc(100vh-64px)] items-center justify-center bg-tikeo-gray-light px-0 py-0 md:px-6 md:py-12">
    <div class="relative grid w-full max-w-5xl overflow-hidden bg-tikeo-surface shadow-card-hover md:grid-cols-[minmax(0,9fr)_minmax(0,11fr)]">
      <div class="absolute inset-x-0 top-0 z-20 h-1 bg-tikeo-brand" aria-hidden="true" />

      <!-- Encoches de la perforation (desktop) -->
      <span class="absolute -top-3.5 left-[45%] z-20 hidden h-7 w-7 -translate-x-1/2 rounded-full bg-tikeo-gray-light md:block" aria-hidden="true" />
      <span class="absolute -bottom-3.5 left-[45%] z-20 hidden h-7 w-7 -translate-x-1/2 rounded-full bg-tikeo-gray-light md:block" aria-hidden="true" />

      <!-- ============ Panneau image ============ -->
      <aside class="relative isolate min-h-[170px] overflow-hidden bg-tikeo-ink text-white md:min-h-[640px]">
        <img
          src="/images/auth-concert.jpg"
          alt=""
          class="absolute inset-0 -z-20 h-full w-full object-cover object-center"
          fetchpriority="high"
          decoding="async"
        />
        <div class="absolute inset-0 -z-10 bg-gradient-to-t from-tikeo-ink/90 via-tikeo-ink/25 to-tikeo-ink/55" aria-hidden="true" />
        <span class="pointer-events-none absolute inset-y-6 right-0 hidden border-r-2 border-dashed border-white/30 md:block" aria-hidden="true" />

        <!-- Mobile : bandeau image compact -->
        <div class="flex h-full min-h-[170px] items-start justify-between px-6 pt-7 md:hidden">
          <NuxtLink to="/" aria-label="Tikeo"><img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto drop-shadow" /></NuxtLink>
          <p class="text-[11px] font-bold uppercase tracking-wider text-white/80">{{ t('authLayout.secure') }}</p>
        </div>

        <!-- Desktop : image + légende -->
        <div class="hidden h-full flex-col justify-between gap-10 p-10 md:flex lg:p-12">
          <NuxtLink to="/" aria-label="Tikeo" class="inline-flex"><img src="/logo-tikeo.png" alt="Tikeo" class="h-11 w-auto drop-shadow-lg" /></NuxtLink>

          <div>
            <p class="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/80">
              <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
              {{ t('authLayout.secure') }}
            </p>
            <p class="mt-3 font-display text-3xl font-extrabold leading-[1.1] tracking-tight lg:text-[2.5rem]">
              {{ t('header.publish') }}<span class="text-[#FF7A00]">.</span><br />{{ t('home.buy') }}<span class="text-[#FF7A00]">.</span><br />{{ t('authLayout.live') }}
            </p>
            <p class="mt-4 max-w-sm text-sm leading-relaxed text-white/85">{{ t('authLayout.intro') }}</p>
            <p class="mt-8 text-xs text-white/60">© {{ year }} Tikeo — {{ t('authLayout.footer') }}</p>
          </div>
        </div>
      </aside>

      <!-- ============ Formulaire ============ -->
      <section class="flex flex-col justify-center px-6 py-9 md:px-10 md:py-14 lg:px-14">
        <div class="mx-auto w-full max-w-sm">
          <h1 class="font-display text-[1.75rem] font-extrabold leading-tight tracking-tight text-tikeo-black md:text-3xl">{{ title }}</h1>
          <p v-if="subtitle" class="mt-2 text-sm leading-relaxed text-tikeo-gray-text">{{ subtitle }}</p>
          <div class="mt-7">
            <slot />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
