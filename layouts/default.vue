<template>
  <div class="flex min-h-screen flex-col bg-tikeo-gray-light">
    <CountryModal />
    <AppTopBar />
    <AppHeader />
    <main class="flex-1 pb-24 md:pb-0">
      <slot />
    </main>
    <AppFooter class="hidden md:block" />
    <MobileBottomNav class="md:hidden" />
    <!-- Introduction, visite guidée et pop-up : voir components/EngagementHost.vue -->
    <EngagementHost />
    <!-- Invitation à installer l'app (PWA) : voir components/InstallAppPrompt.vue -->
    <InstallAppPrompt />
  </div>
</template>
