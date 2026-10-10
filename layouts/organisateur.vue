<script setup lang="ts">
const { t } = useI18n()
const { profile, user, signOut } = useAuth()
const { organizer, fetchOrganizer } = useOrganizer()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
// Menu latéral masquable sur grand écran (mémorisé, Ctrl+B) : composables/useSidebarCollapse.ts
const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapse('organizer')

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
      { to: '/organisateur/evenements/scanner', label: t('organizerNav.scanner'), icon: 'scan' },
      { to: '/organisateur/revenus', label: t('organizerNav.revenue'), icon: 'wallet' },
      { to: '/organisateur/codes-promo', label: t('promoCodes.title'), icon: 'tag' },
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
  if (route.path === to) return true
  // « Mes événements » reste actif sur ses sous-pages (modifier, nouveau, statistiques…),
  // sauf pour le scanner qui a sa propre entrée dans le menu.
  if (to === '/organisateur/evenements') return route.path.startsWith(to + '/') && !route.path.startsWith('/organisateur/evenements/scanner')
  return route.path.startsWith(to + '/')
}

async function handleLogout() {
  await signOut()
  router.push('/connexion')
}

// Barre du bas (mobile) : les 4 accès les plus fréquents + « Créer » au centre
const bottomItems = computed(() => [
  { to: '/organisateur/dashboard', label: t('organizerNav.dashboard'), icon: 'grid' },
  { to: '/organisateur/evenements', label: t('organizerNav.myEvents'), icon: 'calendar' },
  { to: '/organisateur/evenements/scanner', label: t('organizerNav.scanner'), icon: 'scan' },
  { to: '/organisateur/revenus', label: t('organizerNav.revenue'), icon: 'wallet' },
])

// Ferme le tiroir à chaque changement de page et bloque le défilement derrière lui
watch(() => route.path, () => { sidebarOpen.value = false })
watch(sidebarOpen, (open) => {
  if (typeof document !== 'undefined') document.body.style.overflow = open ? 'hidden' : ''
})
onBeforeUnmount(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <div class="flex min-h-screen bg-tikeo-gray-light">
    <!-- ============ Menu latéral (desktop) ============ -->
    <aside
      class="sticky top-0 hidden h-screen shrink-0 overflow-hidden border-r border-tikeo-border bg-tikeo-surface transition-[width,border-color] duration-300 ease-out md:block"
      :class="sidebarCollapsed ? 'md:w-0 md:border-transparent' : 'md:w-64'"
      :aria-hidden="sidebarCollapsed ? 'true' : undefined"
      :inert="sidebarCollapsed || undefined"
    >
      <div class="flex h-full w-64 flex-col">
      <NuxtLink to="/organisateur/dashboard" class="group relative flex items-center gap-2.5 border-b border-tikeo-border px-5 py-4">
        <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
        <span class="bg-tikeo-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ t('organizerNav.badge') }}</span>
      </NuxtLink>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <NuxtLink to="/organisateur/evenements/nouveau" class="btn-ink group mb-5 !h-12 w-full">
          <AppIcon name="plus" class="h-[18px] w-[18px] transition-transform duration-300 group-hover:rotate-90" :stroke="2.4" />
          {{ t('organizerNav.createEvent') }}
        </NuxtLink>

        <div v-for="group in navGroups" :key="group.label" class="mb-5">
          <p class="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">
            <span class="h-[3px] w-4 bg-[#FF7A00]" aria-hidden="true" />{{ group.label }}
          </p>
          <ul class="space-y-1">
            <li v-for="item in group.items" :key="item.to">
              <NuxtLink
                :to="item.to"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                class="group relative flex h-11 items-center gap-3 border px-3 text-sm font-semibold transition-all duration-200"
                :class="
                  isActive(item.to)
                    ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                    : 'border-transparent text-tikeo-black hover:translate-x-1 hover:border-tikeo-border hover:bg-tikeo-surface-alt'
                "
              >
                <AppIcon :name="item.icon" class="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <span v-if="isActive(item.to)" class="h-1.5 w-1.5 bg-[#FF7A00] dark:bg-tikeo-ink" aria-hidden="true" />
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <div class="border-t border-tikeo-border p-4">
        <NuxtLink to="/" class="group flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tikeo-gray-text transition-colors hover:text-tikeo-orange">
          <AppIcon name="arrow-left" class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('organizerNav.backToSite').replace('← ', '') }}
        </NuxtLink>
      </div>
      </div>
    </aside>

    <!-- ============ Tiroir (mobile) ============ -->
    <Transition name="org-fade">
      <button v-if="sidebarOpen" type="button" class="fixed inset-0 z-40 bg-tikeo-ink/60 backdrop-blur-sm md:hidden" :aria-label="t('organizerNav.closeMenu')" @click="sidebarOpen = false" />
    </Transition>
    <Transition
      enter-active-class="transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
      leave-active-class="transition-transform duration-200 ease-in"
      enter-from-class="-translate-x-full"
      leave-to-class="-translate-x-full"
    >
      <aside v-if="sidebarOpen" class="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-tikeo-surface shadow-2xl md:hidden">
        <div class="relative flex items-center justify-between border-b border-tikeo-border px-5 py-4">
          <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
          <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
          <button type="button" class="org-icon-btn !h-9 !w-9" :aria-label="t('organizerNav.closeMenu')" @click="sidebarOpen = false">
            <AppIcon name="close" class="h-5 w-5" />
          </button>
        </div>

        <div class="flex items-center gap-3 border-b border-tikeo-border bg-tikeo-surface-alt px-5 py-4">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-sm font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ initials }}</span>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-tikeo-black">{{ organizer?.name || t('organizerNav.fallbackTitle') }}</p>
            <p v-if="currentStatus" class="truncate text-xs text-tikeo-gray-text">{{ currentStatus.label }}</p>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto px-3 py-4">
          <NuxtLink to="/organisateur/evenements/nouveau" class="btn-ink mb-5 !h-12 w-full">
            <AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.4" />
            {{ t('organizerNav.createEvent') }}
          </NuxtLink>
          <div v-for="group in navGroups" :key="group.label" class="mb-5">
            <p class="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">
              <span class="h-[3px] w-4 bg-[#FF7A00]" aria-hidden="true" />{{ group.label }}
            </p>
            <ul class="space-y-1">
              <li v-for="item in group.items" :key="item.to">
                <NuxtLink
                  :to="item.to"
                  class="flex h-12 items-center gap-3 border px-3 text-[15px] font-semibold transition-colors"
                  :class="
                    isActive(item.to)
                      ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                      : 'border-transparent text-tikeo-black active:bg-tikeo-surface-alt'
                  "
                >
                  <AppIcon :name="item.icon" class="h-5 w-5 shrink-0" />
                  {{ item.label }}
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>

        <div class="space-y-1 border-t border-tikeo-border p-3">
          <NuxtLink to="/" class="drawer-row !px-3">
            <span class="drawer-icon"><AppIcon name="home" class="h-5 w-5" /></span>
            <span class="flex-1">{{ t('organizerNav.backToSite').replace('← ', '') }}</span>
          </NuxtLink>
          <button type="button" class="drawer-row w-full !px-3 text-left" @click="handleLogout">
            <span class="drawer-icon !bg-tikeo-error/10 !text-tikeo-error"><AppIcon name="logout" class="h-5 w-5" /></span>
            <span class="flex-1">{{ t('organizerNav.logout') }}</span>
          </button>
        </div>
      </aside>
    </Transition>

    <!-- ============ Colonne principale ============ -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header class="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-tikeo-border bg-tikeo-surface/95 px-4 pb-2.5 pt-3 backdrop-blur md:px-8">
        <!-- Filet de marque : orange → bleu, comme le logo -->
        <span class="pointer-events-none absolute inset-x-0 top-0 h-[3px] bg-tikeo-brand" aria-hidden="true" />
        <div class="flex min-w-0 items-center gap-3">
          <button
            type="button"
            class="org-icon-btn hidden md:flex"
            :aria-label="sidebarCollapsed ? t('organizerNav.showSidebar') : t('organizerNav.hideSidebar')"
            :title="(sidebarCollapsed ? t('organizerNav.showSidebar') : t('organizerNav.hideSidebar')) + ' (Ctrl+B)'"
            :aria-pressed="sidebarCollapsed"
            @click="toggleSidebar"
          >
            <AppIcon :name="sidebarCollapsed ? 'menu' : 'chevron-left'" class="h-5 w-5" :stroke="2.2" />
          </button>
          <button type="button" class="org-icon-btn !border-tikeo-ink !bg-tikeo-ink !text-white md:hidden dark:!border-[#FF7A00] dark:!bg-[#FF7A00] dark:!text-tikeo-ink" :aria-label="t('organizerNav.openMenu')" @click="sidebarOpen = true">
            <AppIcon name="menu" class="h-5 w-5" />
          </button>
          <NuxtLink to="/organisateur/dashboard" class="flex min-w-0 items-center gap-2" :class="sidebarCollapsed ? '' : 'md:hidden'" aria-label="Tikeo">
            <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
            <span class="hidden bg-tikeo-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white min-[430px]:inline-block dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ t('organizerNav.badge') }}</span>
          </NuxtLink>
          <p class="hidden truncate font-display text-base font-extrabold tracking-tight text-tikeo-black md:block">{{ organizer?.name || t('organizerNav.fallbackTitle') }}</p>
        </div>
        <div class="flex items-center gap-2 md:gap-2.5">
          <span v-if="currentStatus" class="hidden items-center gap-1.5 border px-2.5 py-1 text-[11px] font-bold sm:inline-flex" :class="currentStatus.class">
            <AppIcon :name="organizer?.status === 'approved' ? 'shield-check' : 'clock'" class="h-3.5 w-3.5" />
            {{ currentStatus.label }}
          </span>
          <ThemeToggle compact boxed />
          <LanguageSwitcher compact boxed />
          <span class="hidden h-9 w-9 items-center justify-center bg-tikeo-ink text-xs font-bold text-white sm:flex dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ initials }}</span>
          <button
            type="button"
            class="org-icon-btn org-tip max-lg:!w-10 lg:!w-auto lg:gap-2 lg:px-3 text-xs font-bold hover:!border-tikeo-error hover:!bg-tikeo-error hover:!text-white"
            :aria-label="t('organizerNav.logout')"
            @click="handleLogout"
          >
            <AppIcon name="logout" class="h-[18px] w-[18px]" />
            <span class="hidden lg:inline">{{ t('organizerNav.logout') }}</span>
          </button>
        </div>
      </header>

      <!-- Bandeaux d'alerte : le compte n'est pas (ou plus) actif -->
      <div v-if="organizer?.status === 'pending'" class="flex items-start gap-3 border-b border-yellow-500/30 border-l-4 border-l-yellow-500 bg-yellow-500/10 px-4 py-3 text-xs text-yellow-800 md:px-8 dark:text-yellow-300">
        <AppIcon name="clock" class="mt-0.5 h-4 w-4 shrink-0" />
        <p>{{ t('organizerNav.bannerPending') }}</p>
      </div>
      <div v-else-if="organizer?.status === 'suspended'" class="flex items-start gap-3 border-b border-tikeo-error/30 border-l-4 border-l-tikeo-error bg-tikeo-error/10 px-4 py-3 text-xs text-tikeo-error md:px-8">
        <AppIcon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />
        <p>{{ t('organizerNav.bannerSuspended') }}</p>
      </div>

      <main class="flex-1 pb-24 md:pb-0">
        <slot />
      </main>

      <footer class="border-t border-tikeo-border bg-tikeo-surface px-4 py-3 text-center text-xs text-tikeo-gray-text max-md:mb-20 md:px-8">
        © {{ new Date().getFullYear() }} Tikeo — {{ t('organizerNav.footer') }}
      </footer>
    </div>

    <!-- ============ Barre du bas (mobile) ============ -->
    <DashBottomNav
      :items="bottomItems.map((b) => ({ ...b, active: isActive(b.to) }))"
      :center="{ to: '/organisateur/evenements/nouveau', label: t('organizerNav.createEvent'), icon: 'plus' }"
      :aria-label="t('organizerNav.badge')"
    />
  </div>
</template>
