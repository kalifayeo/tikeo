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
  </div>
</template>
