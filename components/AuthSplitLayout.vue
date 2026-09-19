<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex min-h-[calc(100vh-64px)] items-center justify-center bg-tikeo-gray-light px-4 py-8 md:py-14">
    <div class="grid w-full max-w-4xl overflow-hidden border border-tikeo-border bg-tikeo-surface shadow-card-hover md:grid-cols-2">
      <!-- Panneau gauche : image / branding (masqué sur mobile) -->
      <div class="relative hidden overflow-hidden bg-tikeo-brand md:flex md:flex-col md:justify-between md:p-8 lg:p-10">
        <div class="absolute inset-0 bg-gradient-to-br from-tikeo-orange via-tikeo-brand to-tikeo-blue-dark opacity-90" />
        <NuxtLink to="/" class="relative z-10 flex items-center gap-2">
          <span class="inline-flex bg-white px-3 py-1.5">
            <img src="/logo-tikeo.png" alt="Tikeo" class="h-7 w-auto" />
          </span>
        </NuxtLink>
        <div class="relative z-10 text-white">
          <p class="text-xl font-bold leading-snug lg:text-2xl">{{ $t('header.publish') }}.<br />{{ $t('home.buy') }}.<br />Vivez l'instant.</p>
          <p class="mt-3 max-w-sm text-sm text-white/80">
            La billetterie simple et intelligente pour vos événements, en Côte d'Ivoire et en Afrique.
          </p>
        </div>
        <p class="relative z-10 text-xs text-white/60">© {{ new Date().getFullYear() }} Tikeo — La billetterie simple et intelligente</p>
      </div>

      <!-- Panneau droit : formulaire -->
      <div class="flex flex-col justify-center px-6 py-10 md:px-10 lg:px-14">
        <div class="mx-auto w-full max-w-sm">
          <NuxtLink to="/" class="mb-8 flex items-center justify-center md:hidden">
            <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto" />
          </NuxtLink>
          <h1 class="text-xl font-bold text-tikeo-black">{{ title }}</h1>
          <p v-if="subtitle" class="mt-1 text-sm text-tikeo-gray-text">{{ subtitle }}</p>
          <div class="mt-6">
            <slot />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
