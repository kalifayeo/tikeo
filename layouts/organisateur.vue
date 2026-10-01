<script setup lang="ts">
const { t } = useI18n()
const { profile, user, signOut } = useAuth()
const { organizer, fetchOrganizer } = useOrganizer()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)

if (!organizer.value) {
  onMounted(fetchOrganizer)
}

const navGroups = computed(() => [
  {
    label: t('organizerNav.overview'),
    items: [{ to: '/organisateur/dashboard', label: t('organizerNav.dashboard'), icon: 'grid' }],
  },
  {
    label: t('organizerNav.management'),
    items: [
      { to: '/organisateur/evenements', label: t('organizerNav.myEvents'), icon: 'calendar' },
      { to: '/organisateur/evenements/scanner', label: t('organizerNav.scanner'), icon: 'qrcode' },
      { to: '/organisateur/revenus', label: t('organizerNav.revenue'), icon: 'card' },
    ],
  },
  {
    label: t('organizerNav.account'),
    items: [{ to: '/organisateur/parametres', label: t('organizerNav.settings'), icon: 'settings' }],
  },
])

const statusMeta = computed<Record<string, { label: string; class: string }>>(() => ({
  pending: { label: t('organizerNav.statusPending'), class: 'bg-yellow-500/10 text-yellow-700 border-yellow-500/30' },
  approved: { label: t('organizerNav.statusApproved'), class: 'bg-tikeo-success/10 text-tikeo-success border-tikeo-success/30' },
  suspended: { label: t('organizerNav.statusSuspended'), class: 'bg-tikeo-error/10 text-tikeo-error border-tikeo-error/30' },
}))
const currentStatus = computed(() => (organizer.value ? statusMeta.value[organizer.value.status] : null))

const initials = computed(() => {
  const name = profile.value?.full_name?.trim()
  if (name) return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return user.value?.email?.slice(0, 2).toUpperCase() || 'OR'
})

function isActive(to: string) {
  return route.path === to || (to !== '/organisateur/evenements' && route.path.startsWith(to))
}

async function handleLogout() {
  await signOut()
  router.push('/connexion')
}

const icons: Record<string, string> = {
  grid: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  calendar: 'M8 7V3M16 7V3M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M16 15h2',
  settings:
    'M10.3 3.4a1.9 1.9 0 013.4 0l.3.7a1.9 1.9 0 002.3 1l.7-.2a1.9 1.9 0 012.4 2.4l-.2.7a1.9 1.9 0 001 2.3l.7.3a1.9 1.9 0 010 3.4l-.7.3a1.9 1.9 0 00-1 2.3l.2.7a1.9 1.9 0 01-2.4 2.4l-.7-.2a1.9 1.9 0 00-2.3 1l-.3.7a1.9 1.9 0 01-3.4 0l-.3-.7a1.9 1.9 0 00-2.3-1l-.7.2a1.9 1.9 0 01-2.4-2.4l.2-.7a1.9 1.9 0 00-1-2.3l-.7-.3a1.9 1.9 0 010-3.4l.7-.3a1.9 1.9 0 001-2.3l-.2-.7a1.9 1.9 0 012.4-2.4l.7.2a1.9 1.9 0 002.3-1l.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z',
  qrcode:
    'M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 2h2v2h-2v-2zm4 0h2v2h-2v-2zm-4 4h2v2h-2v-2zm4 0h2v2h-2v-2zm0-8h2v2h-2v-2z',
}
</script>

<template>
  <div class="flex min-h-screen bg-tikeo-gray-light">
    <!-- Sidebar (desktop) -->
    <aside class="hidden w-60 shrink-0 flex-col border-r border-tikeo-border bg-tikeo-surface md:flex">
      <NuxtLink to="/organisateur/dashboard" class="flex items-center gap-2 border-b border-tikeo-border px-5 py-4">
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
        <span class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('organizerNav.badge') }}</span>
      </NuxtLink>
      <nav class="flex-1 overflow-y-auto py-3">
        <div class="px-3 pb-4">
          <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary flex w-full items-center justify-center gap-1.5 !py-2 text-sm">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            {{ t('organizerNav.createEvent') }}
          </NuxtLink>
        </div>
        <div v-for="group in navGroups" :key="group.label" class="mb-4">
          <p class="px-5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-tikeo-gray-text">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-5 py-2.5 text-sm font-medium"
            :class="isActive(item.to) ? 'border-l-2 border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-l-2 border-transparent text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black'"
          >
            <svg class="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="icons[item.icon]" />
            </svg>
            {{ item.label }}
          </NuxtLink>
        </div>
      </nav>
      <div class="border-t border-tikeo-border p-4">
        <NuxtLink to="/" class="text-xs font-medium text-tikeo-gray-text hover:text-tikeo-orange">{{ t('organizerNav.backToSite') }}</NuxtLink>
      </div>
    </aside>

    <!-- Sidebar (mobile, off-canvas) -->
    <Transition
      enter-active-class="transition-transform duration-200"
      leave-active-class="transition-transform duration-150"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside v-if="sidebarOpen" class="fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-tikeo-surface md:hidden">
        <div class="flex items-center justify-between border-b border-tikeo-border px-5 py-4">
          <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
          <button type="button" class="p-1 text-tikeo-gray-text" :aria-label="t('organizerNav.closeMenu')" @click="sidebarOpen = false">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto py-3">
          <div class="px-3 pb-4">
            <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary flex w-full items-center justify-center gap-1.5 !py-2 text-sm" @click="sidebarOpen = false">
              + {{ t('organizerNav.createEvent') }}
            </NuxtLink>
          </div>
          <div v-for="group in navGroups" :key="group.label" class="mb-4">
            <p class="px-5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-tikeo-gray-text">{{ group.label }}</p>
            <NuxtLink
              v-for="item in group.items"
              :key="item.to"
              :to="item.to"
              class="flex items-center gap-3 px-5 py-2.5 text-sm font-medium"
              :class="isActive(item.to) ? 'border-l-2 border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-l-2 border-transparent text-tikeo-gray-text'"
              @click="sidebarOpen = false"
            >
              <svg class="h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" :d="icons[item.icon]" />
              </svg>
              {{ item.label }}
            </NuxtLink>
          </div>
        </nav>
        <div class="border-t border-tikeo-border p-4">
          <NuxtLink to="/" class="flex items-center gap-2 text-xs font-medium text-tikeo-gray-text hover:text-tikeo-orange" @click="sidebarOpen = false">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {{ t('organizerNav.backToSite') }}
          </NuxtLink>
        </div>
      </aside>
    </Transition>
    <button v-if="sidebarOpen" type="button" class="fixed inset-0 z-40 bg-black/40 md:hidden" :aria-label="t('organizerNav.closeMenu')" @click="sidebarOpen = false" />

    <!-- Colonne principale -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="flex items-center justify-between border-b border-tikeo-border bg-tikeo-surface px-4 py-3 md:px-6">
        <button type="button" class="p-1.5 text-tikeo-gray-text md:hidden" :aria-label="t('organizerNav.openMenu')" @click="sidebarOpen = true">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <p class="hidden truncate text-sm font-semibold text-tikeo-black md:block">{{ organizer?.name || t('organizerNav.fallbackTitle') }}</p>
        <div class="flex items-center gap-2.5">
          <span v-if="currentStatus" class="hidden rounded-full border px-2.5 py-1 text-[11px] font-semibold sm:inline" :class="currentStatus.class">
            {{ currentStatus.label }}
          </span>
          <ThemeToggle />
          <LanguageSwitcher />
          <span class="flex h-8 w-8 items-center justify-center bg-tikeo-brand text-xs font-bold text-white">{{ initials }}</span>
          <button type="button" class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold text-tikeo-gray-text hover:border-tikeo-error hover:text-tikeo-error" @click="handleLogout">
            {{ t('organizerNav.logout') }}
          </button>
        </div>
      </header>

      <!-- Bandeau d'alerte si le compte n'est pas encore validé par l'admin -->
      <div v-if="organizer?.status === 'pending'" class="border-b border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-xs text-yellow-800 md:px-6">
        {{ t('organizerNav.bannerPending') }}
      </div>
      <div v-else-if="organizer?.status === 'suspended'" class="border-b border-tikeo-error/30 bg-tikeo-error/10 px-4 py-2.5 text-xs text-tikeo-error md:px-6">
        {{ t('organizerNav.bannerSuspended') }}
      </div>

      <main class="flex-1">
        <slot />
      </main>

      <footer class="border-t border-tikeo-border bg-tikeo-surface px-4 py-3 text-center text-xs text-tikeo-gray-text md:px-6">
        © {{ new Date().getFullYear() }} Tikeo — {{ t('organizerNav.footer') }}
      </footer>
    </div>
  </div>
</template>
