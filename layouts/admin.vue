<script setup lang="ts">
const { t } = useI18n()
const { profile, user, signOut } = useAuth()
const authStore = useAuthStore()
const supabase = useSupabase()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
const pendingRequestsCount = ref(0)
const unreadMessagesCount = ref(0)

async function loadPendingRequestsCount() {
  if (!authStore.isSuperAdmin && !authStore.hasPermission('events.validate')) return
  const { count } = await supabase.from('event_edit_requests').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  pendingRequestsCount.value = count || 0
}
async function loadUnreadMessagesCount() {
  if (!authStore.isSuperAdmin && !authStore.hasPermission('support.view')) return
  const { count } = await supabase.from('contact_messages').select('id', { count: 'exact', head: true }).eq('status', 'new')
  unreadMessagesCount.value = count || 0
}
onMounted(loadPendingRequestsCount)
onMounted(loadUnreadMessagesCount)

// ------------------------------------------------------------
// RBAC (migration 0021) : le menu n'affiche que les sections que le rôle
// administrateur connecté est autorisé à ouvrir. Un Super Admin voit tout ;
// un Admin Finance ne voit par exemple ni "Utilisateurs" ni "Événements".
// Ce filtrage est un confort — la RLS empêche de toute façon toute donnée
// de fuiter si quelqu'un forçait l'URL directement.
// ------------------------------------------------------------
function can(...permissions: string[]) {
  return authStore.isSuperAdmin || permissions.some((p) => authStore.hasPermission(p as any))
}

const navGroups = computed(() => {
  type NavItem = { to: string; label: string; icon: string; badge?: typeof pendingRequestsCount }

  const managementItems = [
    can('marketing.manage') && { to: '/admin/accueil', label: t('adminNav.homeBanner'), icon: 'image' },
    can('users.view') && { to: '/admin/utilisateurs', label: t('adminNav.users'), icon: 'users' },
    can('organizers.view') && { to: '/admin/organisateurs', label: t('adminNav.organizers'), icon: 'briefcase' },
    can('events.view') && { to: '/admin/evenements', label: t('adminNav.events'), icon: 'calendar' },
    can('moderation.manage') && { to: '/admin/categories', label: t('adminNav.categories'), icon: 'tag' },
    can('events.validate') && { to: '/admin/demandes', label: t('adminNav.editRequests'), icon: 'edit', badge: pendingRequestsCount },
    can('support.view') && { to: '/admin/messages', label: t('adminNav.contactMessages'), icon: 'mail', badge: unreadMessagesCount },
    can('tickets.view') && { to: '/admin/billets', label: t('adminNav.tickets'), icon: 'ticket' },
    can('orders.view') && { to: '/admin/commandes', label: t('adminNav.orders'), icon: 'clipboard' },
    can('payments.view') && { to: '/admin/paiements', label: t('adminNav.payments'), icon: 'card' },
  ].filter(Boolean) as NavItem[]

  const groups: Array<{ label: string; items: NavItem[] }> = [
    {
      label: t('adminNav.overview'),
      items: [{ to: '/admin', label: t('adminNav.dashboard'), icon: 'grid' }],
    },
  ]

  if (managementItems.length) {
    groups.push({ label: t('adminNav.management'), items: managementItems })
  }

  if (can('admin.manage_admins', 'admin.manage_permissions')) {
    groups.push({
      label: t('adminNav.administration'),
      items: [{ to: '/admin/administrateurs', label: t('adminNav.administrators'), icon: 'shield' }],
    })
  }

  return groups
})

const initials = computed(() => {
  const name = profile.value?.full_name?.trim()
  if (name) return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase()
  return user.value?.email?.slice(0, 2).toUpperCase() || 'AD'
})

function isActive(to: string) {
  return to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)
}

async function handleLogout() {
  await signOut()
  router.push('/connexion')
}

// Même comportement que le header public (components/AppHeader.vue) :
// le header admin se cache pendant qu'on scrolle et réapparaît dès que
// le scroll s'arrête, pour laisser plus d'espace aux tableaux/listes
// souvent longs de ce back-office.
const headerVisible = ref(true)
let scrollStopTimer: ReturnType<typeof setTimeout> | null = null

function handleScroll() {
  if (sidebarOpen.value) return
  const y = window.scrollY
  headerVisible.value = y <= 10
  if (scrollStopTimer) clearTimeout(scrollStopTimer)
  scrollStopTimer = setTimeout(() => {
    headerVisible.value = true
  }, 500)
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
})
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollStopTimer) clearTimeout(scrollStopTimer)
})

const icons: Record<string, string> = {
  grid: 'M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z',
  users: 'M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m5-3.13a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6M3 8a3 3 0 100-6',
  briefcase: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM8 5V3h8v2',
  calendar: 'M8 7V3M16 7V3M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z',
  ticket: 'M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z',
  clipboard: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  card: 'M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M16 15h2',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.5-9.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z',
  tag: 'M20.59 13.41L11 3.83A2 2 0 009.59 3.24L4 3a1 1 0 00-1 1l.24 5.59a2 2 0 00.58 1.41l9.58 9.58a2 2 0 002.83 0l4.36-4.36a2 2 0 000-2.83zM7 7h.01',
  image: 'M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM8 11a2 2 0 100-4 2 2 0 000 4zm-5 8l6-6 4 4 5-5 5 5',
  mail: 'M4 6h16a1 1 0 011 1v10a1 1 0 01-1 1H4a1 1 0 01-1-1V7a1 1 0 011-1zm0 0l8 7 8-7',
  shield: 'M12 3l7 3v6c0 4.5-3 8-7 9-4-1-7-4.5-7-9V6l7-3z',
}
</script>

<template>
  <div class="flex min-h-screen bg-tikeo-gray-light">
    <!-- Sidebar (desktop) -->
    <aside class="hidden w-60 shrink-0 flex-col border-r border-tikeo-border bg-tikeo-surface md:flex">
      <NuxtLink to="/admin" class="flex items-center gap-2 border-b border-tikeo-border px-5 py-4">
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
        <span class="text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">{{ t('adminNav.badge') }}</span>
      </NuxtLink>
      <nav class="flex-1 overflow-y-auto py-3">
        <div v-for="group in navGroups" :key="group.label" class="mb-4">
          <p class="px-5 pb-1.5 text-[11px] font-bold uppercase tracking-wide text-tikeo-gray-text">{{ group.label }}</p>
          <NuxtLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="flex items-center gap-3 px-5 py-2.5 text-sm font-medium"
            :class="isActive(item.to) ? 'border-l-2 border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-l-2 border-transparent text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black'"
          >
            <svg class="h-4.5 w-4.5 h-[18px] w-[18px] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="icons[item.icon]" />
            </svg>
            {{ item.label }}
            <span v-if="item.badge && item.badge.value > 0" class="ml-auto flex h-5 min-w-5 items-center justify-center bg-tikeo-orange px-1 text-[11px] font-bold text-white">
              {{ item.badge.value }}
            </span>
          </NuxtLink>
        </div>
      </nav>
      <div class="border-t border-tikeo-border p-4">
        <NuxtLink to="/" class="text-xs font-medium text-tikeo-gray-text hover:text-tikeo-orange">{{ t('adminNav.backToSite') }}</NuxtLink>
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
          <button type="button" class="p-1 text-tikeo-gray-text" :aria-label="t('adminNav.closeMenu')" @click="sidebarOpen = false">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <nav class="flex-1 overflow-y-auto py-3">
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
              <span v-if="item.badge && item.badge.value > 0" class="ml-auto flex h-5 min-w-5 items-center justify-center bg-tikeo-orange px-1 text-[11px] font-bold text-white">
                {{ item.badge.value }}
              </span>
            </NuxtLink>
          </div>
        </nav>
        <div class="border-t border-tikeo-border p-4">
          <NuxtLink to="/" class="flex items-center gap-2 text-xs font-medium text-tikeo-gray-text hover:text-tikeo-orange" @click="sidebarOpen = false">
            <svg class="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
            {{ t('adminNav.backToSite') }}
          </NuxtLink>
        </div>
      </aside>
    </Transition>
    <button v-if="sidebarOpen" type="button" class="fixed inset-0 z-40 bg-black/40 md:hidden" :aria-label="t('adminNav.closeMenu')" @click="sidebarOpen = false" />

    <!-- Colonne principale -->
    <div class="flex min-w-0 flex-1 flex-col">
      <header
        class="sticky top-0 z-30 flex items-center justify-between border-b border-tikeo-border bg-tikeo-surface px-4 py-3 transition-transform duration-300 ease-out md:px-6"
        :class="headerVisible ? 'translate-y-0' : '-translate-y-full'"
      >
        <button type="button" class="p-1.5 text-tikeo-gray-text md:hidden" :aria-label="t('adminNav.openMenu')" @click="sidebarOpen = true">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <p class="hidden text-sm font-semibold text-tikeo-black md:block">{{ t('adminNav.headerTitle') }}</p>
        <div class="flex items-center gap-2.5">
          <span class="hidden text-sm text-tikeo-gray-text sm:inline">{{ profile?.full_name || user?.email }}</span>
          <ThemeToggle />
          <LanguageSwitcher />
          <span class="flex h-8 w-8 items-center justify-center bg-tikeo-brand text-xs font-bold text-white">{{ initials }}</span>
          <button type="button" class="border border-tikeo-border px-2.5 py-1.5 text-xs font-semibold text-tikeo-gray-text hover:border-tikeo-error hover:text-tikeo-error" @click="handleLogout">
            {{ t('adminNav.logout') }}
          </button>
        </div>
      </header>

      <main class="flex-1">
        <slot />
      </main>

      <footer class="border-t border-tikeo-border bg-tikeo-surface px-4 py-3 text-center text-xs text-tikeo-gray-text md:px-6">
        © {{ new Date().getFullYear() }} Tikeo — {{ t('adminNav.footer') }}
      </footer>
    </div>
  </div>
</template>
