<script setup lang="ts">
const { t, locale, locales, setLocale } = useI18n()
const { isAuthenticated, profile, signOut, user } = useAuth()
// Compteurs en direct : mis à jour tout seuls (état partagé + Supabase Realtime).
const { unreadCount } = useMyNotifications()
const { favoritesCount } = useFavorites()

function badgeText(n: number) {
  return n > 99 ? '99+' : String(n)
}
const router = useRouter()
const route = useRoute()

const searchQuery = ref('')
const accountOpen = ref(false) // menu déroulant du compte (desktop)
const drawerOpen = ref(false) // tiroir de navigation (mobile)
const mobileSearchOpen = ref(false)
const mobileSearchInput = ref<HTMLInputElement | null>(null)

// Suggestions de recherche (nom d'événement, ville, organisateur/artiste),
// triées par date la plus proche — voir composables/useEventSearch.ts.
const { results: suggestions, loading: suggestLoading, search: runSuggestSearch } = useEventSearch()
const showSuggestions = ref(false)
let suggestDebounce: ReturnType<typeof setTimeout> | null = null

watch(searchQuery, (val) => {
  if (suggestDebounce) clearTimeout(suggestDebounce)
  const term = val.trim()
  if (!term) {
    showSuggestions.value = false
    return
  }
  suggestDebounce = setTimeout(async () => {
    await runSuggestSearch(term, { sortBy: 'date_asc', limit: 6 })
    showSuggestions.value = true
  }, 250)
})

function focusSuggestions() {
  if (searchQuery.value.trim() && suggestions.value.length > 0) showSuggestions.value = true
}

function submitSearch() {
  showSuggestions.value = false
  mobileSearchOpen.value = false
  router.push({ path: '/recherche', query: searchQuery.value ? { q: searchQuery.value } : {} })
}

function goToSuggestion(slug: string) {
  showSuggestions.value = false
  mobileSearchOpen.value = false
  searchQuery.value = ''
  router.push(`/e/${slug}`)
}

function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value
  if (!mobileSearchOpen.value) showSuggestions.value = false
}
watch(mobileSearchOpen, async (open) => {
  if (!open) return
  await nextTick()
  mobileSearchInput.value?.focus()
})

// Le tiroir et la recherche mobile se referment à chaque navigation.
watch(
  () => route.fullPath,
  () => {
    drawerOpen.value = false
    mobileSearchOpen.value = false
    accountOpen.value = false
    showSuggestions.value = false
  }
)

// Le tiroir bloque le défilement de la page derrière lui.
watch(drawerOpen, (open) => {
  if (import.meta.client) document.body.style.overflow = open ? 'hidden' : ''
})

async function handleLogout() {
  drawerOpen.value = false
  accountOpen.value = false
  await signOut()
}

// --- Langue (segmenté dans le tiroir mobile) ---
const localeList = computed(() => locales.value as Array<{ code: string; name: string }>)
async function chooseLocale(code: string) {
  try {
    await setLocale(code as any)
  } catch (e) {
    console.error('[i18n] Impossible de charger la langue', code, e)
  }
}

const initials = computed(() => {
  const name = profile.value?.full_name?.trim()
  if (name) {
    return name
      .split(/\s+/)
      .map((p) => p[0])
      .slice(0, 2)
      .join('')
      .toUpperCase()
  }
  const email = user.value?.email
  if (email) return email.slice(0, 2).toUpperCase()
  return '??'
})

const firstName = computed(() => profile.value?.full_name?.split(' ')[0] || user.value?.email?.split('@')[0] || '')

const roleLabels = computed<Record<string, string>>(() => ({
  organizer: t('header.organizer'),
  agent: t('header.agentRole'),
  admin: t('header.adminRole'),
  buyer: '',
  visitor: '',
}))
const roleLabel = computed(() => roleLabels.value[profile.value?.role ?? ''] ?? '')

// Le lien « Tableau de bord » pointe toujours vers l'espace acheteur ; l'accès
// à l'administration ou à l'espace organisateur passe par des liens dédiés.
const dashboardPath = '/mon-espace/tableau-de-bord'
const isAdmin = computed(() => profile.value?.role === 'admin')

const accountLinks = computed(() => [
  { to: dashboardPath, label: t('header.dashboard'), icon: 'dashboard' },
  { to: '/mon-espace/mes-billets', label: t('header.myTickets'), icon: 'ticket' },
  { to: '/mon-espace/mes-favoris', label: t('header.favorites'), icon: 'heart', badge: favoritesCount.value },
  { to: '/organisateur/evenements', label: t('header.myEvents'), icon: 'calendar' },
  { to: '/mon-espace/portefeuille', label: t('header.wallet'), icon: 'wallet' },
])
const generalLinks = computed(() => [
  { to: '/evenements', label: t('footer.allEvents'), icon: 'compass' },
  { to: '/organisateur/tarifs', label: t('header.pricing'), icon: 'tag' },
  { to: '/faq', label: t('header.faq'), icon: 'help' },
  { to: '/qui-sommes-nous', label: t('header.about'), icon: 'info' },
  { to: '/partenaires', label: t('partners.navLabel'), icon: 'handshake' },
  { to: '/contact', label: t('header.contact2'), icon: 'mail' },
])
const quickLinks = computed(() => [
  { to: '/mon-espace/mes-billets', label: t('header.myTickets'), icon: 'ticket' },
  { to: '/mon-espace/mes-favoris', label: t('header.favorites'), icon: 'heart', badge: favoritesCount.value },
  { to: '/mon-espace/portefeuille', label: t('header.wallet'), icon: 'wallet' },
  { to: '/mon-espace/notifications', label: t('header.notifications'), icon: 'bell', badge: unreadCount.value },
])

// Liens de navigation directs (desktop large) avec l'état « page active ».
const navLinks = computed(() => [{ to: '/evenements', label: t('nav.explore') }])
function isActive(to: string) {
  return route.path === to || route.path.startsWith(`${to}/`)
}

// Le header se cache pendant qu'on scrolle et réapparaît dès que le scroll
// s'arrête, pour laisser plus de place au contenu sans jamais le perdre de vue.
const headerVisible = ref(true)
const scrolled = ref(false)
let scrollStopTimer: ReturnType<typeof setTimeout> | null = null

function handleScroll() {
  const y = window.scrollY
  scrolled.value = y > 8
  // On ne cache jamais le header si un menu/panneau est ouvert : le masquer en
  // plein milieu d'une interaction serait perturbant.
  if (accountOpen.value || drawerOpen.value || showSuggestions.value || mobileSearchOpen.value) return

  headerVisible.value = y <= 10

  if (scrollStopTimer) clearTimeout(scrollStopTimer)
  scrollStopTimer = setTimeout(() => {
    headerVisible.value = true
  }, 500)
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()
})
onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll)
  if (scrollStopTimer) clearTimeout(scrollStopTimer)
  if (suggestDebounce) clearTimeout(suggestDebounce)
  document.body.style.overflow = ''
})

const iconBtn =
  'relative flex h-10 w-10 shrink-0 items-center justify-center text-tikeo-gray-text transition-colors duration-200 hover:bg-tikeo-surface-alt hover:text-tikeo-black'
</script>

<template>
  <header
    class="sticky top-0 bg-tikeo-surface/95 backdrop-blur transition-[transform,box-shadow] duration-300 ease-out"
    :class="[accountOpen ? 'z-[46]' : 'z-40', headerVisible ? 'translate-y-0' : '-translate-y-full', scrolled ? 'shadow-card' : 'border-b border-tikeo-border']"
  >
    <!-- Filet de marque : orange → bleu, comme le logo -->
    <div class="h-[3px] w-full bg-tikeo-brand" aria-hidden="true" />

    <div class="mx-auto flex h-[3.75rem] max-w-tikeo-container items-center gap-2 px-3 md:h-[4.75rem] md:gap-4 md:px-6">
      <NuxtLink to="/" class="flex min-w-0 shrink-0 items-center" :aria-label="'Tikeo — ' + t('nav.home')">
        <img src="/logo-tikeo.png" alt="Tikeo" width="174" height="56" fetchpriority="high" class="h-9 w-auto object-contain md:h-12" />
      </NuxtLink>

      <!-- ============== RECHERCHE (desktop) ============== -->
      <div class="relative ml-2 hidden max-w-2xl flex-1 md:block lg:ml-4" data-tour="search">
        <form class="relative flex" @submit.prevent="submitSearch">
          <AppIcon name="search" class="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-tikeo-gray-text" />
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('header.searchPlaceholder')"
            class="h-11 w-full border border-tikeo-border bg-tikeo-surface-alt pl-11 pr-14 text-sm text-tikeo-black transition-colors placeholder:text-tikeo-gray-text/70 focus:border-tikeo-ink focus:bg-tikeo-surface focus:outline-none dark:focus:border-[#FF7A00]"
            autocomplete="off"
            @focus="focusSuggestions"
            @keyup.esc="showSuggestions = false"
          />
          <button type="submit" class="absolute right-1 top-1 flex h-9 w-10 items-center justify-center bg-tikeo-ink text-white transition-colors duration-200 hover:bg-[#FF7A00] hover:text-tikeo-ink dark:bg-[#FF7A00] dark:text-tikeo-ink dark:hover:bg-white" :aria-label="t('header.search')">
            <AppIcon name="search" class="h-4 w-4" :stroke="2.2" />
          </button>
        </form>

        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          leave-active-class="transition-all duration-100 ease-in"
          enter-from-class="opacity-0 -translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div v-if="showSuggestions" class="absolute left-0 right-0 top-[3.25rem] z-50 overflow-hidden border border-tikeo-border bg-tikeo-surface shadow-card-hover">
            <SearchSuggestions :suggestions="suggestions" :loading="suggestLoading" @select="goToSuggestion" @all="submitSearch" />
          </div>
        </Transition>

        <Teleport to="body">
          <button v-if="showSuggestions" type="button" class="fixed inset-0 z-30 hidden cursor-default md:block" :aria-label="t('common.close')" @click="showSuggestions = false" />
        </Teleport>
      </div>

      <!-- ============== DESKTOP ============== -->
      <div class="ml-auto hidden items-center gap-1 md:flex lg:gap-1.5">
        <nav class="mr-1 hidden items-center xl:flex" aria-label="Navigation principale">
          <NuxtLink
            v-for="l in navLinks"
            :key="l.to"
            :to="l.to"
            class="relative px-3 py-2 text-sm font-semibold transition-colors"
            :class="isActive(l.to) ? 'text-tikeo-black' : 'text-tikeo-gray-text hover:text-tikeo-black'"
          >
            {{ l.label }}
            <span v-if="isActive(l.to)" class="absolute inset-x-3 -bottom-0.5 h-0.5 bg-[#FF7A00]" />
          </NuxtLink>
        </nav>

        <NuxtLink
          to="/organisateur/tarifs"
          data-tour="pricing"
          class="relative mr-1 hidden px-3 py-2 text-sm font-semibold transition-colors lg:block"
          :class="isActive('/organisateur/tarifs') ? 'text-tikeo-black' : 'text-tikeo-gray-text hover:text-tikeo-black'"
        >
          {{ t('header.pricing') }}
          <span v-if="isActive('/organisateur/tarifs')" class="absolute inset-x-3 -bottom-0.5 h-0.5 bg-[#FF7A00]" />
        </NuxtLink>

        <span class="inline-flex" data-tour="theme"><ThemeToggle compact /></span>

        <NuxtLink to="/organisateur" data-tour="community" :class="[iconBtn, 'hidden xl:flex']" :aria-label="t('header.community')" :title="t('header.community')">
          <AppIcon name="users" class="h-[21px] w-[21px]" />
        </NuxtLink>
        <NuxtLink to="/mon-espace/notifications" data-tour="notifications" :class="iconBtn" :aria-label="t('header.notifications') + (unreadCount > 0 ? ` (${unreadCount})` : '')" :title="t('header.notifications')">
          <AppIcon name="bell" class="h-[21px] w-[21px]" />
          <span v-if="unreadCount > 0" :key="unreadCount" class="badge-pop pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface" aria-hidden="true">{{ badgeText(unreadCount) }}</span>
        </NuxtLink>
        <NuxtLink to="/mon-espace/mes-favoris" data-tour="favorites" :class="iconBtn" :aria-label="t('header.favorites') + (favoritesCount > 0 ? ` (${favoritesCount})` : '')" :title="t('header.favorites')">
          <AppIcon name="heart" class="h-[21px] w-[21px]" />
          <span v-if="favoritesCount > 0" :key="favoritesCount" class="badge-pop pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface" aria-hidden="true">{{ badgeText(favoritesCount) }}</span>
        </NuxtLink>

        <!-- CTA « Publier un événement » : texte complet dès lg, simple « + » sur tablette -->
        <NuxtLink to="/organisateur/evenements/nouveau" data-tour="publish" class="btn-ink ml-1 !px-4 max-lg:!w-11 max-lg:!px-0" :aria-label="t('header.publish')">
          <AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.4" />
          <span class="hidden lg:inline">{{ t('header.publish') }}</span>
        </NuxtLink>

        <!-- Menu compte : se replie quand le curseur le quitte -->
        <div class="relative ml-1" @mouseleave="accountOpen = false">
          <button
            type="button"
            data-tour="account"
            class="flex h-11 items-center gap-2 border border-tikeo-border py-1 pl-1 pr-2.5 transition-colors hover:border-tikeo-ink dark:hover:border-[#FF7A00]"
            :class="accountOpen ? 'border-tikeo-ink dark:border-[#FF7A00]' : ''"
            :aria-expanded="accountOpen"
            aria-haspopup="true"
            @click="accountOpen = !accountOpen"
          >
            <UserAvatar v-if="isAuthenticated" :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-9 w-9" text-class="text-sm" />
            <span v-else class="flex h-9 w-9 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text">
              <AppIcon name="user" class="h-5 w-5" />
            </span>
            <span class="hidden flex-col items-start leading-tight xl:flex">
              <span class="max-w-[7rem] truncate text-sm font-bold text-tikeo-black">{{ isAuthenticated ? firstName || t('header.myAccount') : t('header.myAccount') }}</span>
              <span v-if="roleLabel" class="text-[11px] font-semibold text-tikeo-orange">{{ roleLabel }}</span>
            </span>
            <AppIcon name="chevron-down" class="h-3.5 w-3.5 text-tikeo-gray-text transition-transform duration-200" :class="accountOpen ? 'rotate-180' : ''" :stroke="2.2" />
          </button>

          <Transition
            enter-active-class="transition-all duration-150 ease-out"
            leave-active-class="transition-all duration-100 ease-in"
            enter-from-class="opacity-0 translate-y-1"
            leave-to-class="opacity-0 translate-y-1"
          >
            <div v-if="accountOpen" class="absolute right-0 top-[3.25rem] z-50 flex max-h-[calc(100vh-6.5rem)] w-72 flex-col overflow-hidden border border-tikeo-border bg-tikeo-surface shadow-card-hover">
              <!-- En-tête : membre connecté, ou invitation à se connecter -->
              <div class="shrink-0 bg-tikeo-ink p-4 text-white">
                <template v-if="isAuthenticated">
                  <div class="flex items-center gap-3">
                    <UserAvatar :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-12 w-12" text-class="text-base" />
                    <div class="min-w-0">
                      <p class="truncate text-sm font-bold">{{ profile?.full_name || t('header.myAccount') }}</p>
                      <p class="truncate text-xs text-white/65">{{ user?.email }}</p>
                      <span v-if="roleLabel" class="mt-1 inline-block bg-[#FF7A00] px-1.5 py-0.5 text-[10px] font-bold uppercase text-tikeo-ink">{{ roleLabel }}</span>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <p class="font-display text-base font-extrabold">{{ t('header.welcomeTitle') }}</p>
                  <p class="mt-1 text-xs leading-relaxed text-white/70">{{ t('header.welcomeText') }}</p>
                  <div class="mt-3 flex gap-2">
                    <NuxtLink to="/connexion" class="flex h-10 flex-1 items-center justify-center bg-[#FF7A00] text-sm font-bold text-tikeo-ink transition-colors hover:bg-white" @click="accountOpen = false">{{ t('header.login') }}</NuxtLink>
                    <NuxtLink to="/inscription" class="flex h-10 flex-1 items-center justify-center border border-white/30 text-sm font-bold text-white transition-colors hover:bg-white hover:text-tikeo-ink" @click="accountOpen = false">{{ t('header.register') }}</NuxtLink>
                  </div>
                </template>
              </div>

              <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain py-1.5">
                <template v-if="isAuthenticated">
                  <NuxtLink
                    v-if="isAdmin"
                    to="/admin"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-tikeo-orange transition-colors hover:bg-tikeo-gray-light"
                    @click="accountOpen = false"
                  >
                    <AppIcon name="shield" class="h-[18px] w-[18px]" />
                    {{ t('header.administration') }}
                  </NuxtLink>
                  <NuxtLink
                    v-for="l in accountLinks"
                    :key="l.to"
                    :to="l.to"
                    class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-tikeo-black transition-colors hover:bg-tikeo-gray-light"
                    @click="accountOpen = false"
                  >
                    <AppIcon :name="l.icon" class="h-[18px] w-[18px] text-tikeo-gray-text" />
                    <span class="flex-1">{{ l.label }}</span>
                    <span v-if="l.badge" :key="l.badge" class="badge-pop flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">{{ badgeText(l.badge) }}</span>
                  </NuxtLink>
                  <div class="my-1.5 border-t border-tikeo-border" />
                </template>

                <NuxtLink
                  v-for="l in generalLinks"
                  :key="l.to"
                  :to="l.to"
                  class="flex items-center gap-3 px-4 py-2 text-sm text-tikeo-gray-text transition-colors hover:bg-tikeo-gray-light hover:text-tikeo-black"
                  @click="accountOpen = false"
                >
                  <AppIcon :name="l.icon" class="h-[18px] w-[18px]" />
                  {{ l.label }}
                </NuxtLink>

                <template v-if="isAuthenticated">
                  <div class="my-1.5 border-t border-tikeo-border" />
                  <button type="button" class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-tikeo-error transition-colors hover:bg-tikeo-gray-light" @click="handleLogout">
                    <AppIcon name="logout" class="h-[18px] w-[18px]" />
                    {{ t('header.logout') }}
                  </button>
                </template>
              </div>
            </div>
          </Transition>
          <Teleport to="body">
            <button v-if="accountOpen" type="button" class="fixed inset-0 z-30 hidden cursor-default md:block" :aria-label="t('common.close')" @click="accountOpen = false" />
          </Teleport>
        </div>
      </div>

      <!-- ============== MOBILE ============== -->
      <!-- Logo · recherche · notifications · menu. Thème et langue vivent dans
           le tiroir pour que cette ligne reste aérée sur tous les écrans. -->
      <div class="ml-auto flex items-center gap-0.5 md:hidden">
        <button
          type="button"
          data-tour="search"
          class="flex h-10 w-10 shrink-0 items-center justify-center transition-colors"
          :class="mobileSearchOpen ? 'bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'text-tikeo-black'"
          :aria-label="t('header.search')"
          :aria-expanded="mobileSearchOpen"
          @click="toggleMobileSearch"
        >
          <AppIcon :name="mobileSearchOpen ? 'close' : 'search'" class="h-[22px] w-[22px]" />
        </button>

        <NuxtLink to="/mon-espace/notifications" data-tour="notifications" class="relative flex h-10 w-10 shrink-0 items-center justify-center text-tikeo-black" :aria-label="t('header.notifications') + (unreadCount > 0 ? ` (${unreadCount})` : '')">
          <AppIcon name="bell" class="h-[22px] w-[22px]" />
          <span v-if="unreadCount > 0" :key="unreadCount" class="badge-pop pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface" aria-hidden="true">{{ badgeText(unreadCount) }}</span>
        </NuxtLink>

        <NuxtLink to="/mon-espace/mes-favoris" data-tour="favorites" class="relative flex h-10 w-10 shrink-0 items-center justify-center text-tikeo-black" :aria-label="t('header.favorites') + (favoritesCount > 0 ? ` (${favoritesCount})` : '')">
          <AppIcon name="heart" class="h-[22px] w-[22px]" />
          <span v-if="favoritesCount > 0" :key="favoritesCount" class="badge-pop pointer-events-none absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface" aria-hidden="true">{{ badgeText(favoritesCount) }}</span>
        </NuxtLink>

        <button
          type="button"
          data-tour="account"
          class="ml-1 flex h-10 shrink-0 items-center gap-1.5 border border-tikeo-border pl-1 pr-2 transition-colors active:bg-tikeo-surface-alt"
          :aria-label="t('header.menu')"
          :aria-expanded="drawerOpen"
          @click="drawerOpen = true"
        >
          <UserAvatar v-if="isAuthenticated" :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-8 w-8" text-class="text-xs" />
          <span v-else class="flex h-8 w-8 items-center justify-center bg-tikeo-surface-alt text-tikeo-black"><AppIcon name="user" class="h-[18px] w-[18px]" /></span>
          <AppIcon name="menu" class="h-5 w-5 text-tikeo-black" :stroke="2.2" />
        </button>
      </div>
    </div>

    <!-- Recherche mobile : se déplie sous la ligne principale, suggestions en direct -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out"
      leave-active-class="transition-all duration-150 ease-in"
      enter-from-class="opacity-0 -translate-y-2"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div v-if="mobileSearchOpen" class="max-h-[70vh] overflow-y-auto border-t border-tikeo-border bg-tikeo-surface md:hidden">
        <form class="relative flex px-3 pb-3 pt-2.5" @submit.prevent="submitSearch">
          <AppIcon name="search" class="pointer-events-none absolute left-6 top-[1.4rem] h-[18px] w-[18px] text-tikeo-gray-text" />
          <input
            ref="mobileSearchInput"
            v-model="searchQuery"
            type="search"
            enterkeyhint="search"
            :placeholder="t('header.searchPlaceholder')"
            class="h-12 w-full border border-tikeo-border bg-tikeo-surface-alt pl-11 pr-24 text-base text-tikeo-black placeholder:text-tikeo-gray-text/70 focus:border-tikeo-ink focus:outline-none dark:focus:border-[#FF7A00]"
            autocomplete="off"
            @keyup.esc="mobileSearchOpen = false"
          />
          <button type="submit" class="absolute right-[1.2rem] top-[1.1rem] flex h-10 items-center bg-[#FF7A00] px-4 text-sm font-bold text-tikeo-ink">
            {{ t('header.search') }}
          </button>
        </form>
        <div v-if="searchQuery.trim()" class="border-t border-tikeo-border">
          <SearchSuggestions :suggestions="suggestions" :loading="suggestLoading" @select="goToSuggestion" @all="submitSearch" />
        </div>
      </div>
    </Transition>

    <!-- Tiroir mobile.
         Teleport indispensable : le <header> a une transformation CSS (translate-y
         pour l'effet montre/cache au scroll), ce qui en fait un « containing block »
         pour tout descendant en position fixed. Teleport le sort jusqu'au <body>. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200 ease-out"
        leave-active-class="transition-opacity duration-150 ease-in"
        enter-from-class="opacity-0"
        leave-to-class="opacity-0"
      >
        <div v-if="drawerOpen" class="fixed inset-0 z-[60] bg-tikeo-ink/70 backdrop-blur-[2px] md:hidden" aria-hidden="true" @click="drawerOpen = false" />
      </Transition>

      <Transition
        enter-active-class="transition-transform duration-300 ease-out"
        leave-active-class="transition-transform duration-200 ease-in"
        enter-from-class="translate-x-full"
        leave-to-class="translate-x-full"
      >
        <aside v-if="drawerOpen" class="fixed inset-y-0 right-0 z-[61] flex w-[88vw] max-w-[390px] flex-col bg-tikeo-surface shadow-2xl md:hidden" role="dialog" aria-modal="true" :aria-label="t('header.menu')">
          <!-- Bandeau : identité du visiteur -->
          <div class="relative shrink-0 overflow-hidden bg-tikeo-ink px-5 pb-6 pt-[calc(env(safe-area-inset-top,0px)+1.25rem)] text-white">
            <div class="pointer-events-none absolute inset-y-0 left-0 w-2" style="background-image: radial-gradient(circle, rgb(243 245 249) 2.5px, transparent 3px); background-size: 8px 14px; background-position: -4px 0" aria-hidden="true" />
            <button type="button" class="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] flex h-10 w-10 items-center justify-center bg-white/10 text-white transition-colors active:bg-white active:text-tikeo-ink" :aria-label="t('header.closeMenu')" @click="drawerOpen = false">
              <AppIcon name="close" class="h-5 w-5" :stroke="2.2" />
            </button>

            <template v-if="isAuthenticated">
              <div class="flex items-center gap-3.5 pr-12">
                <UserAvatar :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-16 w-16" text-class="text-xl" />
                <div class="min-w-0">
                  <p class="truncate font-display text-lg font-extrabold leading-tight">{{ profile?.full_name || t('header.myAccount') }}</p>
                  <p class="truncate text-sm text-white/65">{{ user?.email }}</p>
                  <span v-if="roleLabel" class="mt-1.5 inline-block bg-[#FF7A00] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-tikeo-ink">{{ roleLabel }}</span>
                </div>
              </div>
            </template>
            <template v-else>
              <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto bg-white p-1.5" />
              <p class="mt-4 font-display text-2xl font-extrabold leading-tight">{{ t('header.welcomeTitle') }}</p>
              <p class="mt-1.5 max-w-[17rem] text-sm leading-relaxed text-white/70">{{ t('header.welcomeText') }}</p>
              <div class="mt-4 grid grid-cols-2 gap-2.5">
                <NuxtLink to="/connexion" class="flex h-11 items-center justify-center gap-2 bg-[#FF7A00] text-sm font-bold text-tikeo-ink">
                  <AppIcon name="login" class="h-[18px] w-[18px]" :stroke="2" />{{ t('header.login') }}
                </NuxtLink>
                <NuxtLink to="/inscription" class="flex h-11 items-center justify-center gap-2 border border-white/30 text-sm font-bold text-white">
                  <AppIcon name="user-plus" class="h-[18px] w-[18px]" :stroke="2" />{{ t('header.register') }}
                </NuxtLink>
              </div>
            </template>
          </div>

          <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[calc(env(safe-area-inset-bottom,0px)+1.5rem)]">
            <!-- Accès rapide (connecté) -->
            <div v-if="isAuthenticated" class="grid grid-cols-2 gap-2.5 p-4">
              <NuxtLink
                v-for="l in quickLinks"
                :key="l.to"
                :to="l.to"
                class="flex flex-col items-start gap-3 border border-tikeo-border bg-tikeo-surface p-3.5 transition-colors active:border-tikeo-ink active:bg-tikeo-surface-alt"
              >
                <span class="relative flex h-10 w-10 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
                  <AppIcon :name="l.icon" class="h-5 w-5" />
                  <span v-if="l.badge" :key="l.badge" class="badge-pop absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[10px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface">{{ badgeText(l.badge) }}</span>
                </span>
                <span class="text-sm font-bold leading-tight text-tikeo-black">{{ l.label }}</span>
              </NuxtLink>
            </div>

            <!-- Publier -->
            <div class="px-4" :class="isAuthenticated ? '' : 'pt-4'">
              <NuxtLink to="/organisateur/evenements/nouveau" class="flex items-center gap-3.5 bg-[#FF7A00] p-4 text-tikeo-ink active:bg-[#FF9A3D]">
                <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-ink text-white"><AppIcon name="plus" class="h-5 w-5" :stroke="2.4" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block font-display text-base font-extrabold leading-tight">{{ t('header.publish') }}</span>
                  <span class="block text-xs font-medium text-tikeo-ink/75">{{ t('header.publishHint') }}</span>
                </span>
                <AppIcon name="arrow-right" class="h-5 w-5 shrink-0" :stroke="2.2" />
              </NuxtLink>
            </div>

            <!-- Navigation -->
            <nav class="pt-3">
              <p class="px-5 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('header.menuSectionGeneral') }}</p>
              <NuxtLink v-if="isAuthenticated && isAdmin" to="/admin" class="drawer-row !text-tikeo-orange">
                <span class="drawer-icon !bg-tikeo-orange/10 !text-tikeo-orange"><AppIcon name="shield" class="h-5 w-5" /></span>
                <span class="flex-1">{{ t('header.administration') }}</span>
                <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text" :stroke="2.2" />
              </NuxtLink>
              <template v-if="isAuthenticated">
                <NuxtLink :to="dashboardPath" class="drawer-row">
                  <span class="drawer-icon"><AppIcon name="dashboard" class="h-5 w-5" /></span>
                  <span class="flex-1">{{ t('header.dashboard') }}</span>
                  <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text" :stroke="2.2" />
                </NuxtLink>
                <NuxtLink to="/organisateur/evenements" class="drawer-row">
                  <span class="drawer-icon"><AppIcon name="calendar" class="h-5 w-5" /></span>
                  <span class="flex-1">{{ t('header.myEvents') }}</span>
                  <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text" :stroke="2.2" />
                </NuxtLink>
              </template>
              <NuxtLink v-for="l in generalLinks" :key="l.to" :to="l.to" class="drawer-row">
                <span class="drawer-icon"><AppIcon :name="l.icon" class="h-5 w-5" /></span>
                <span class="flex-1">{{ l.label }}</span>
                <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text" :stroke="2.2" />
              </NuxtLink>
            </nav>

            <!-- Préférences : thème + langue -->
            <div class="mx-4 mt-4 space-y-3 border border-tikeo-border p-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-sm font-bold text-tikeo-black">{{ t('header.appearance') }}</p>
                <span class="inline-flex" data-tour="theme"><ThemeToggle /></span>
              </div>
              <div class="border-t border-tikeo-border pt-3">
                <p class="mb-2 text-sm font-bold text-tikeo-black">{{ t('header.languageLabel') }}</p>
                <div class="grid grid-cols-4 gap-1.5" role="group" :aria-label="t('header.languageLabel')" data-tour="language">
                  <button
                    v-for="l in localeList"
                    :key="l.code"
                    type="button"
                    class="h-10 border text-sm font-bold uppercase transition-colors"
                    :class="locale === l.code ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border text-tikeo-gray-text active:bg-tikeo-surface-alt'"
                    :aria-pressed="locale === l.code"
                    :title="l.name"
                    @click="chooseLocale(l.code)"
                  >
                    {{ l.code }}
                  </button>
                </div>
              </div>
            </div>

            <div v-if="isAuthenticated" class="mt-2 px-1">
              <button type="button" class="drawer-row w-full text-left !text-tikeo-error" @click="handleLogout">
                <span class="drawer-icon !bg-tikeo-error/10 !text-tikeo-error"><AppIcon name="logout" class="h-5 w-5" /></span>
                <span class="flex-1">{{ t('header.logout') }}</span>
              </button>
            </div>
          </div>
        </aside>
      </Transition>
    </Teleport>
  </header>
</template>

<style scoped>
/* Petit « pop » à chaque changement de valeur (la clé du <span> change avec le nombre). */
.badge-pop {
  animation: badge-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes badge-pop {
  0% {
    transform: scale(0.4);
  }
  100% {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .badge-pop {
    animation: none;
  }
}
</style>
