<script setup lang="ts">
const { t } = useI18n()
const { profile, user, signOut } = useAuth()
const authStore = useAuthStore()
const supabase = useSupabase()
const router = useRouter()
const route = useRoute()
const sidebarOpen = ref(false)
// Menu latéral masquable sur grand écran (mémorisé, Ctrl+B) : composables/useSidebarCollapse.ts
const { collapsed: sidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapse('admin')
const { confirmState, answer: answerConfirm } = useAdminConfirm()
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
    can('onboarding.manage') && { to: '/admin/introduction', label: t('adminNav.introduction'), icon: 'sparkles' },
    can('popups.manage') && { to: '/admin/popups', label: t('adminNav.popups'), icon: 'megaphone' },
    can('partners.manage') && { to: '/admin/partenaires', label: t('adminNav.partners'), icon: 'handshake' },
    can('users.view') && { to: '/admin/utilisateurs', label: t('adminNav.users'), icon: 'users' },
    can('organizers.view') && { to: '/admin/organisateurs', label: t('adminNav.organizers'), icon: 'briefcase' },
    can('events.view') && { to: '/admin/evenements', label: t('adminNav.events'), icon: 'calendar' },
    can('moderation.manage') && { to: '/admin/categories', label: t('adminNav.categories'), icon: 'tag' },
    can('moderation.manage') && { to: '/admin/avis', label: t('reviewsModeration.title'), icon: 'star' },
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

  // « Sécurité » (double authentification) est visible par TOUT admin : c'est un
  // réglage personnel, pas une permission — chaque admin protège son compte.
  const adminItems: NavItem[] = []
  if (can('admin.manage_admins', 'admin.manage_permissions')) {
    adminItems.push({ to: '/admin/administrateurs', label: t('adminNav.administrators'), icon: 'shield' })
  }
  if (can('audit.view')) adminItems.push({ to: '/admin/journal', label: t('auditLog.title'), icon: 'clock' })
  if (can('settings.manage')) adminItems.push({ to: '/admin/maintenance', label: t('adminNav.maintenance'), icon: 'wrench' })
  adminItems.push({ to: '/admin/securite', label: t('adminNav.security'), icon: 'lock' })
  groups.push({ label: t('adminNav.administration'), items: adminItems })

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

// Aperçu du site pendant une maintenance (voir server/middleware/maintenance.ts) :
// posé tant qu'un admin est connecté, retiré à la déconnexion.
const maintBypass = useCookie('tikeo_maint_bypass', { sameSite: 'lax', path: '/', maxAge: 60 * 60 * 8, secure: !import.meta.dev })
onMounted(() => {
  maintBypass.value = '1'
})

async function handleLogout() {
  maintBypass.value = null
  await signOut()
  router.push('/connexion')
}

// Titre du bandeau : l'entrée de menu correspondant exactement à la page.
// Sur une sous-page (ex. statistiques d'un événement) il n'y a pas de bandeau :
// la page garde son propre titre.
const heroItem = computed(() => {
  for (const g of navGroups.value) {
    const hit = g.items.find((i) => i.to === route.path || (i.to === '/admin' && route.path === '/admin/'))
    if (hit) return hit
  }
  return null
})

// Barre du bas (mobile) : jusqu'à 3 accès rapides autorisés pour ce rôle + « Menu » (ouvre le tiroir).
const bottomItems = computed(() => {
  const all = navGroups.value.flatMap((g) => g.items)
  const preferred = ['/admin', '/admin/messages', '/admin/evenements', '/admin/demandes', '/admin/commandes', '/admin/utilisateurs']
  const quick = preferred
    .map((to) => all.find((i) => i.to === to))
    .filter(Boolean)
    .slice(0, 3) as typeof all
  return [
    ...quick.map((i) => ({ to: i.to, label: i.label, icon: i.icon, active: isActive(i.to), badge: i.badge?.value || null })),
    { label: t('adminNav.menu'), icon: 'menu', action: true, active: sidebarOpen.value },
  ]
})

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
      <NuxtLink to="/admin" class="group relative flex items-center gap-2.5 border-b border-tikeo-border px-5 py-4">
        <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto transition-transform duration-300 group-hover:scale-105" />
        <span class="bg-tikeo-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ t('adminNav.badge') }}</span>
      </NuxtLink>

      <nav class="flex-1 overflow-y-auto px-3 py-4">
        <div v-for="group in navGroups" :key="group.label" class="mb-5">
          <p class="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">
            <span class="h-[3px] w-4 bg-[#FF7A00]" aria-hidden="true" />{{ group.label }}
          </p>
          <ul class="space-y-1">
            <li v-for="item in group.items" :key="item.to">
              <NuxtLink
                :to="item.to"
                :aria-current="isActive(item.to) ? 'page' : undefined"
                class="group relative flex h-10 items-center gap-3 border px-3 text-sm font-semibold transition-all duration-200"
                :class="
                  isActive(item.to)
                    ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
                    : 'border-transparent text-tikeo-black hover:translate-x-1 hover:border-tikeo-border hover:bg-tikeo-surface-alt'
                "
              >
                <AppIcon :name="item.icon" class="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:scale-110" />
                <span class="flex-1 truncate">{{ item.label }}</span>
                <span v-if="item.badge && item.badge.value > 0" class="flex h-5 min-w-5 items-center justify-center bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">{{ item.badge.value }}</span>
              </NuxtLink>
            </li>
          </ul>
        </div>
      </nav>

      <div class="border-t border-tikeo-border p-4">
        <NuxtLink to="/" class="group flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-tikeo-gray-text transition-colors hover:text-tikeo-orange">
          <AppIcon name="arrow-left" class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />
          {{ t('adminNav.backToSite').replace('← ', '') }}
        </NuxtLink>
      </div>
      </div>
    </aside>

    <!-- ============ Tiroir (mobile) ============ -->
    <Transition name="org-fade">
      <button v-if="sidebarOpen" type="button" class="fixed inset-0 z-40 bg-tikeo-ink/60 backdrop-blur-sm md:hidden" :aria-label="t('adminNav.closeMenu')" @click="sidebarOpen = false" />
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
          <button type="button" class="org-icon-btn !h-9 !w-9" :aria-label="t('adminNav.closeMenu')" @click="sidebarOpen = false"><AppIcon name="close" class="h-5 w-5" /></button>
        </div>
        <div class="flex items-center gap-3 border-b border-tikeo-border bg-tikeo-surface-alt px-5 py-4">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink text-sm font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ initials }}</span>
          <div class="min-w-0">
            <p class="truncate text-sm font-bold text-tikeo-black">{{ profile?.full_name || user?.email }}</p>
            <p class="truncate text-xs text-tikeo-gray-text">{{ t('adminNav.badge') }}</p>
          </div>
        </div>
        <nav class="flex-1 overflow-y-auto px-3 py-4">
          <div v-for="group in navGroups" :key="group.label" class="mb-5">
            <p class="mb-2 flex items-center gap-2 px-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">
              <span class="h-[3px] w-4 bg-[#FF7A00]" aria-hidden="true" />{{ group.label }}
            </p>
            <ul class="space-y-1">
              <li v-for="item in group.items" :key="item.to">
                <NuxtLink
                  :to="item.to"
                  class="flex h-12 items-center gap-3 border px-3 text-[15px] font-semibold transition-colors"
                  :class="isActive(item.to) ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-transparent text-tikeo-black active:bg-tikeo-surface-alt'"
                >
                  <AppIcon :name="item.icon" class="h-5 w-5 shrink-0" />
                  <span class="flex-1 truncate">{{ item.label }}</span>
                  <span v-if="item.badge && item.badge.value > 0" class="flex h-5 min-w-5 items-center justify-center bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">{{ item.badge.value }}</span>
                </NuxtLink>
              </li>
            </ul>
          </div>
        </nav>
        <div class="space-y-1 border-t border-tikeo-border p-3">
          <NuxtLink to="/" class="drawer-row !px-3">
            <span class="drawer-icon"><AppIcon name="home" class="h-5 w-5" /></span>
            <span class="flex-1">{{ t('adminNav.backToSite').replace('← ', '') }}</span>
          </NuxtLink>
          <button type="button" class="drawer-row w-full !px-3 text-left" @click="handleLogout">
            <span class="drawer-icon !bg-tikeo-error/10 !text-tikeo-error"><AppIcon name="logout" class="h-5 w-5" /></span>
            <span class="flex-1">{{ t('adminNav.logout') }}</span>
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
            :aria-label="sidebarCollapsed ? t('adminNav.showSidebar') : t('adminNav.hideSidebar')"
            :title="(sidebarCollapsed ? t('adminNav.showSidebar') : t('adminNav.hideSidebar')) + ' (Ctrl+B)'"
            :aria-pressed="sidebarCollapsed"
            @click="toggleSidebar"
          >
            <AppIcon :name="sidebarCollapsed ? 'menu' : 'chevron-left'" class="h-5 w-5" :stroke="2.2" />
          </button>
          <button type="button" class="org-icon-btn !border-tikeo-ink !bg-tikeo-ink !text-white md:hidden dark:!border-[#FF7A00] dark:!bg-[#FF7A00] dark:!text-tikeo-ink" :aria-label="t('adminNav.openMenu')" @click="sidebarOpen = true"><AppIcon name="menu" class="h-5 w-5" /></button>
          <NuxtLink to="/admin" class="flex min-w-0 items-center gap-2" :class="sidebarCollapsed ? '' : 'md:hidden'" aria-label="Tikeo">
            <img src="/logo-tikeo.png" alt="Tikeo" class="h-8 w-auto" />
            <span class="hidden bg-tikeo-ink px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white min-[430px]:inline-block dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ t('adminNav.badge') }}</span>
          </NuxtLink>
          <p class="hidden truncate font-display text-base font-extrabold tracking-tight text-tikeo-black md:block">{{ t('adminNav.headerTitle') }}</p>
        </div>
        <div class="flex items-center gap-2 md:gap-2.5">
          <span class="hidden max-w-[14rem] truncate text-sm font-semibold text-tikeo-gray-text lg:inline">{{ profile?.full_name || user?.email }}</span>
          <ThemeToggle compact boxed />
          <LanguageSwitcher compact boxed />
          <span class="hidden h-9 w-9 items-center justify-center bg-tikeo-ink text-xs font-bold text-white sm:flex dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ initials }}</span>
          <button
            type="button"
            class="org-icon-btn max-lg:!w-10 lg:!w-auto lg:gap-2 lg:px-3 text-xs font-bold hover:!border-tikeo-error hover:!bg-tikeo-error hover:!text-white"
            :aria-label="t('adminNav.logout')"
            @click="handleLogout"
          >
            <AppIcon name="logout" class="h-[18px] w-[18px]" />
            <span class="hidden lg:inline">{{ t('adminNav.logout') }}</span>
          </button>
        </div>
      </header>

      <!-- Bandeau de page : titre de la rubrique ouverte -->
      <section v-if="heroItem" :key="heroItem.to" class="relative isolate overflow-hidden bg-tikeo-ink text-white">
        <div class="org-line absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <div class="pointer-events-none absolute inset-y-0 left-0 hidden w-3 lg:block" style="background-image: radial-gradient(circle, rgb(243 245 249) 3px, transparent 3.5px); background-size: 12px 18px; background-position: -6px 0" aria-hidden="true" />
        <div class="pointer-events-none absolute -right-24 -top-24 -z-10 h-64 w-64 rounded-full bg-[#FF7A00]/15 blur-3xl" aria-hidden="true" />
        <div class="mx-auto max-w-[76rem] px-4 py-6 md:px-8 md:py-8">
          <p class="org-rise flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />{{ t('adminNav.badge') }}
          </p>
          <p class="org-rise mt-2 flex items-center gap-3 font-display text-[1.6rem] font-extrabold leading-tight tracking-tight sm:text-3xl md:text-4xl" style="--i: 1" role="presentation">
            <span class="hidden h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink sm:flex"><AppIcon :name="heroItem.icon" class="h-6 w-6" :stroke="2" /></span>
            <span class="min-w-0 break-words">{{ heroItem.label }}</span>
          </p>
        </div>
      </section>

      <main class="admin-main flex-1 max-md:pb-24" :class="heroItem ? 'has-hero' : ''">
        <slot />
      </main>

      <ConfirmDeleteModal :open="confirmState.open" :title="confirmState.title" :message="confirmState.message" :confirm-label="confirmState.confirmLabel" @confirm="answerConfirm(true)" @cancel="answerConfirm(false)" />

      <footer class="border-t border-tikeo-border bg-tikeo-surface px-4 py-3 text-center text-xs text-tikeo-gray-text max-md:mb-20 md:px-8">
        © {{ new Date().getFullYear() }} Tikeo — {{ t('adminNav.footer') }}
      </footer>
    </div>

    <!-- ============ Barre du bas (mobile) ============ -->
    <DashBottomNav :items="bottomItems" :aria-label="t('adminNav.badge')" @action="sidebarOpen = true" />
  </div>
</template>
