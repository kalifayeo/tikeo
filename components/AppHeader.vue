<script setup lang="ts">
const { t } = useI18n()
const { isAuthenticated, profile, signOut, user } = useAuth()
const router = useRouter()

const searchQuery = ref('')
const menuOpen = ref(false)
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

function suggestionDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
}
// Partagé avec MobileFiltersDrawer.vue : ce bouton n'ouvrait rien auparavant.
// Sur la page d'accueil, il ouvre le tiroir de filtres ; ailleurs, on
// redirige d'abord vers l'accueil où se trouvent les filtres.
const mobileFiltersOpen = useState('tikeo-mobile-filters-open', () => false)
const route = useRoute()

function openMobileFilters() {
  if (route.path === '/') {
    mobileFiltersOpen.value = true
  } else {
    router.push('/').then(() => {
      mobileFiltersOpen.value = true
    })
  }
}

async function toggleMobileSearch() {
  mobileSearchOpen.value = !mobileSearchOpen.value
  if (mobileSearchOpen.value) {
    await nextTick()
    mobileSearchInput.value?.focus()
  }
}

async function handleLogout() {
  menuOpen.value = false
  await signOut()
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
const roleLabel = computed(() => roleLabels[profile.value?.role ?? ''] ?? '')

const dashboardPath = computed(() => {
  switch (profile.value?.role) {
    case 'organizer':
      return '/organisateur/dashboard'
    case 'admin':
      // La page d'administration vit sur /admin (pages/admin/index.vue) :
      // il n'existe pas de /admin/dashboard, d'où le retour systématique
      // à l'accueil quand ce lien était utilisé.
      return '/admin'
    case 'agent':
      return '/organisateur/evenements'
    default:
      return '/mon-espace/tableau-de-bord'
  }
})

const isAdmin = computed(() => profile.value?.role === 'admin')

// Le header se cache pendant qu'on scrolle (dans les deux sens) et
// réapparaît dès que le scroll s'arrête, pour laisser plus de place au
// contenu sans jamais le perdre complètement de vue.
const headerVisible = ref(true)
let scrollStopTimer: ReturnType<typeof setTimeout> | null = null

function handleScroll() {
  // On ne cache jamais le header si un menu/panneau est ouvert : le
  // masquer en plein milieu d'une interaction serait perturbant.
  if (menuOpen.value || showSuggestions.value || mobileSearchOpen.value) return

  const y = window.scrollY
  // Toujours visible tout en haut de page, pour ne pas le cacher inutilement
  // dès le premier pixel de scroll.
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
</script>

<template>
  <header
    class="sticky top-0 z-40 border-b border-tikeo-border bg-tikeo-surface/95 backdrop-blur transition-transform duration-300 ease-out"
    :class="headerVisible ? 'translate-y-0' : '-translate-y-full'"
  >
    <!-- Ligne principale -->
    <div class="mx-auto flex max-w-tikeo-container items-center gap-4 px-4 py-2.5 md:px-6 md:py-3">
      <NuxtLink to="/" class="flex shrink-0 items-center">
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-11 w-auto md:h-14" />
      </NuxtLink>

      <!-- Barre de recherche : visible en permanence sur desktop -->
      <div class="relative hidden flex-1 max-w-xl md:block">
        <form class="relative flex" @submit.prevent="submitSearch">
          <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
          <input
            v-model="searchQuery"
            type="search"
            :placeholder="t('header.searchPlaceholder')"
            class="input-field pl-10 pr-12"
            autocomplete="off"
            @focus="focusSuggestions"
            @keyup.esc="showSuggestions = false"
          />
          <button type="submit" class="absolute right-1.5 top-1/2 flex h-7 w-9 -translate-y-1/2 items-center justify-center bg-tikeo-orange text-white hover:bg-tikeo-orange-dark transition-colors duration-200" :aria-label="t('header.search')">
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
          </button>
        </form>

        <!-- Suggestions : par nom d'événement, ville ou organisateur/artiste, triées par date -->
        <Transition
          enter-active-class="transition-all duration-150 ease-out"
          leave-active-class="transition-all duration-100 ease-in"
          enter-from-class="opacity-0 -translate-y-1"
          leave-to-class="opacity-0 -translate-y-1"
        >
          <div
            v-if="showSuggestions"
            class="absolute left-0 right-0 top-11 z-50 overflow-hidden border border-tikeo-border bg-tikeo-surface shadow-card-hover"
          >
            <div v-if="suggestLoading" class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.searching') }}</div>
            <template v-else-if="suggestions.length > 0">
              <button
                v-for="s in suggestions"
                :key="s.id"
                type="button"
                class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-tikeo-gray-light"
                @click="goToSuggestion(s.slug)"
              >
                <img :src="s.coverImage" :alt="s.title" class="h-10 w-10 shrink-0 object-cover" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-tikeo-black">{{ s.title }}</span>
                  <span class="block truncate text-xs text-tikeo-gray-text">{{ suggestionDate(s.startDate) }} · {{ s.city }}<span v-if="s.organizerName"> · {{ s.organizerName }}</span></span>
                </span>
              </button>
              <button
                type="button"
                class="block w-full border-t border-tikeo-border px-3.5 py-2.5 text-center text-xs font-semibold text-tikeo-orange hover:bg-tikeo-gray-light"
                @click="submitSearch"
              >
                {{ t('search.seeAllResults') }}
              </button>
            </template>
            <div v-else class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.noSuggestion') }}</div>
          </div>
        </Transition>

        <Teleport to="body">
          <button v-if="showSuggestions" type="button" class="fixed inset-0 z-40 cursor-default" :aria-label="t('common.close')" @click="showSuggestions = false" />
        </Teleport>
      </div>

      <!-- ============== DESKTOP ============== -->
      <div class="ml-auto hidden items-center gap-2.5 md:flex">
        <ThemeToggle />
        <LanguageSwitcher />

        <!-- CTA "Publier un événement", visible que l'on soit connecté ou non -->
        <NuxtLink to="/organisateur/evenements/nouveau" class="btn-primary !px-4">
          {{ t('header.publish') }}
        </NuxtLink>

        <!-- Icônes toujours visibles (communauté / notifications / favoris), comme Tikerama -->
        <NuxtLink to="/organisateur" class="p-2 text-tikeo-gray-text hover:text-tikeo-orange" :aria-label="t('header.community')" :title="t('header.community')">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-1a4 4 0 00-3-3.87M9 20H4v-1a4 4 0 013-3.87m5-3.13a4 4 0 100-8 4 4 0 000 8zm6 0a3 3 0 100-6M3 8a3 3 0 100-6" />
          </svg>
        </NuxtLink>
        <NuxtLink to="/mon-espace/notifications" class="p-2 text-tikeo-gray-text hover:text-tikeo-orange" :aria-label="t('header.notifications')" :title="t('header.notifications')">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </NuxtLink>
        <NuxtLink to="/mon-espace/mes-favoris" class="p-2 text-tikeo-gray-text hover:text-tikeo-orange" :aria-label="t('header.favorites')" :title="t('header.favorites')">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" />
          </svg>
        </NuxtLink>

        <!-- Menu unique (compte + navigation secondaire), comme sur Tikerama -->
        <!-- @mouseleave : le menu se replie tout seul quand le curseur le quitte (desktop only, cf. hidden md:flex ci-dessus) -->
        <div class="relative" @mouseleave="menuOpen = false">
          <button
            type="button"
            class="flex items-center gap-2 border border-transparent py-1 pl-1 pr-3 hover:border-tikeo-border"
            :aria-expanded="menuOpen"
            aria-haspopup="true"
            @click="menuOpen = !menuOpen"
          >
            <UserAvatar v-if="isAuthenticated" :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-9 w-9" text-class="text-sm" />
            <span v-else class="flex h-9 w-9 items-center justify-center border border-tikeo-border text-tikeo-gray-text">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a7 7 0 0114 0v1" />
              </svg>
            </span>
            <span class="hidden flex-col items-start leading-tight lg:flex">
              <span class="text-sm font-semibold text-tikeo-black">{{ isAuthenticated ? (firstName || t('header.myAccount')) : t('header.myAccount') }}</span>
              <span v-if="roleLabel" class="text-[11px] font-medium text-tikeo-orange">{{ roleLabel }}</span>
            </span>
            <svg class="hidden h-3.5 w-3.5 text-tikeo-gray-text lg:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div
            v-if="menuOpen"
            class="absolute right-0 top-12 z-50 w-64 overflow-hidden border border-tikeo-border bg-tikeo-surface py-1 shadow-card-hover"
          >
            <template v-if="isAuthenticated">
              <div class="border-b border-tikeo-border px-3.5 py-2.5">
                <p class="truncate text-sm font-semibold text-tikeo-black">{{ profile?.full_name || t('header.myAccount') }}</p>
                <p class="truncate text-xs text-tikeo-gray-text">{{ user?.email }}</p>
              </div>
              <NuxtLink :to="dashboardPath" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
                {{ t('header.dashboard') }}
              </NuxtLink>
              <NuxtLink
                v-if="isAdmin"
                to="/admin"
                class="block px-3.5 py-2 text-sm font-semibold text-tikeo-orange hover:bg-tikeo-gray-light"
                @click="menuOpen = false"
              >
                {{ t('header.administration') }}
              </NuxtLink>
              <NuxtLink to="/mon-espace/mes-billets" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
                {{ t('header.myTickets') }}
              </NuxtLink>
              <NuxtLink to="/organisateur/evenements" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
                {{ t('header.myEvents') }}
              </NuxtLink>
              <NuxtLink to="/mon-espace/portefeuille" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
                {{ t('header.wallet') }}
              </NuxtLink>
              <div class="my-1 border-t border-tikeo-border" />
            </template>
            <template v-else>
              <NuxtLink to="/connexion" class="block px-3.5 py-2 text-sm font-semibold text-tikeo-black hover:bg-tikeo-gray-light" @click="menuOpen = false">
                {{ t('header.login') }}
              </NuxtLink>
              <NuxtLink to="/inscription" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
                {{ t('header.register') }}
              </NuxtLink>
              <div class="my-1 border-t border-tikeo-border" />
            </template>

            <NuxtLink to="/organisateur/tarifs" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
              {{ t('header.pricing') }}
            </NuxtLink>
            <NuxtLink to="/faq" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
              {{ t('header.faq') }}
            </NuxtLink>
            <NuxtLink to="/qui-sommes-nous" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
              {{ t('header.about') }}
            </NuxtLink>
            <NuxtLink to="/contact" class="block px-3.5 py-2 text-sm text-tikeo-gray-text hover:bg-tikeo-gray-light hover:text-tikeo-black" @click="menuOpen = false">
              {{ t('header.contact2') }}
            </NuxtLink>

            <template v-if="isAuthenticated">
              <div class="my-1 border-t border-tikeo-border" />
              <button type="button" class="block w-full px-3.5 py-2 text-left text-sm text-tikeo-error hover:bg-tikeo-gray-light" @click="handleLogout">
                {{ t('header.logout') }}
              </button>
            </template>
          </div>
          <Teleport to="body">
            <button v-if="menuOpen" type="button" class="fixed inset-0 z-40 cursor-default" :aria-label="t('common.close')" @click="menuOpen = false" />
          </Teleport>
        </div>
      </div>

      <!-- ============== MOBILE ============== -->
      <div class="ml-auto flex items-center gap-1.5 md:hidden">
        <button
          type="button"
          class="p-2 text-tikeo-gray-text transition"
          :class="mobileSearchOpen ? 'text-tikeo-orange' : ''"
          :aria-pressed="mobileSearchOpen"
          :aria-label="t('header.search')"
          @click="toggleMobileSearch"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
          </svg>
        </button>

        <NuxtLink to="/mon-espace/notifications" class="p-2 text-tikeo-gray-text" :aria-label="t('header.notifications')">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 17h5l-1.4-1.4A2 2 0 0118 14.2V11a6 6 0 10-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
        </NuxtLink>

        <button type="button" class="flex h-9 w-9 items-center justify-center" @click="menuOpen = !menuOpen">
          <UserAvatar v-if="isAuthenticated" :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-9 w-9" text-class="text-xs" />
          <svg v-else class="h-5 w-5 text-tikeo-gray-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM3 21v-1a7 7 0 0114 0v1" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Menu mobile (même structure que le menu desktop, avec un style plus lisible) -->
    <!-- Teleport indispensable : le <header> a une transformation CSS
         (translate-y pour l'effet montre/cache au scroll), ce qui en fait
         malgré lui un nouveau "containing block" pour tout descendant en
         position fixed — le menu se retrouvait donc coincé dans la petite
         boîte du header au lieu de couvrir l'écran. Teleport le sort
         entièrement de cette hiérarchie, jusqu'au <body>, où position:fixed
         se comporte enfin par rapport à l'écran entier comme attendu. -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-150 ease-out"
        leave-active-class="transition-all duration-100 ease-in"
        enter-from-class="opacity-0 -translate-y-1"
        leave-to-class="opacity-0 -translate-y-1"
      >
        <div
          v-if="menuOpen"
          class="fixed inset-x-0 top-16 bottom-0 z-50 overflow-y-auto overscroll-contain border-t border-tikeo-border bg-tikeo-surface pb-24 shadow-card-hover md:hidden"
        >
        <div v-if="isAuthenticated" class="flex items-center gap-3 bg-tikeo-surface-alt px-4 py-5">
          <UserAvatar :avatar-url="profile?.avatar_url" :initials="initials" size-class="h-14 w-14" text-class="text-lg" />
          <div class="min-w-0">
            <p class="truncate text-base font-bold text-tikeo-black">{{ profile?.full_name || t('header.myAccount') }}</p>
            <p class="truncate text-sm text-tikeo-gray-text">{{ user?.email }}</p>
          </div>
        </div>

        <nav class="pb-2">
          <template v-if="isAuthenticated">
            <p class="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('header.menuSectionAccount') }}</p>

            <NuxtLink :to="dashboardPath" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" /></svg>
              </span>
              <span class="flex-1">{{ t('header.dashboard') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
            <NuxtLink v-if="isAdmin" to="/admin" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon !bg-tikeo-orange/10 !text-tikeo-orange">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M9 3v18M3 8l6-5 6 5M15 21h6M18 21v-9m-3 3l3-3 3 3" /></svg>
              </span>
              <span class="flex-1 font-semibold text-tikeo-orange">{{ t('header.administration') }}</span>
              <span class="mobile-menu-chevron !text-tikeo-orange/50" />
            </NuxtLink>
            <NuxtLink to="/mon-espace/mes-billets" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M4 8a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 000 4v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2a2 2 0 000-4V8z" /></svg>
              </span>
              <span class="flex-1">{{ t('header.myTickets') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
            <NuxtLink to="/mon-espace/mes-favoris" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 21s-7.5-4.6-10-9.1C.5 8.6 2.3 5 6 5c2 0 3.4 1.1 4 2.2C10.6 6.1 12 5 14 5c3.7 0 5.5 3.6 4 6.9-2.5 4.5-10 9.1-10 9.1z" /></svg>
              </span>
              <span class="flex-1">{{ t('header.favorites') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
            <NuxtLink to="/organisateur/evenements" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3M16 7V3M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z" /></svg>
              </span>
              <span class="flex-1">{{ t('header.myEvents') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
            <NuxtLink to="/mon-espace/portefeuille" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M3 7a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V7zM3 10h18M16 15h2" /></svg>
              </span>
              <span class="flex-1">{{ t('header.wallet') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
          </template>
          <template v-else>
            <p class="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('header.menuSectionAccount') }}</p>
            <NuxtLink to="/connexion" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M11 16l-4-4m0 0l4-4m-4 4h12M13 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /></svg>
              </span>
              <span class="flex-1 font-semibold">{{ t('header.login') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
            <NuxtLink to="/inscription" class="mobile-menu-row" @click="menuOpen = false">
              <span class="mobile-menu-icon">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM20 8v6M23 11h-6" /></svg>
              </span>
              <span class="flex-1">{{ t('header.register') }}</span>
              <span class="mobile-menu-chevron" />
            </NuxtLink>
          </template>

          <p class="px-4 pb-1.5 pt-4 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('header.menuSectionGeneral') }}</p>
          <NuxtLink to="/organisateur/evenements/nouveau" class="mobile-menu-row" @click="menuOpen = false">
            <span class="mobile-menu-icon !bg-tikeo-orange/10 !text-tikeo-orange">
              <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" /></svg>
            </span>
            <span class="flex-1 font-semibold">{{ t('header.publish') }}</span>
            <span class="mobile-menu-chevron" />
          </NuxtLink>
          <NuxtLink to="/organisateur/tarifs" class="mobile-menu-row !py-3 text-tikeo-gray-text" @click="menuOpen = false">
            <span class="flex-1">{{ t('header.pricing') }}</span>
            <span class="mobile-menu-chevron" />
          </NuxtLink>
          <NuxtLink to="/faq" class="mobile-menu-row !py-3 text-tikeo-gray-text" @click="menuOpen = false">
            <span class="flex-1">{{ t('header.faq') }}</span>
            <span class="mobile-menu-chevron" />
          </NuxtLink>
          <NuxtLink to="/qui-sommes-nous" class="mobile-menu-row !py-3 text-tikeo-gray-text" @click="menuOpen = false">
            <span class="flex-1">{{ t('header.about') }}</span>
            <span class="mobile-menu-chevron" />
          </NuxtLink>
          <NuxtLink to="/contact" class="mobile-menu-row !py-3 text-tikeo-gray-text" @click="menuOpen = false">
            <span class="flex-1">{{ t('header.contact2') }}</span>
            <span class="mobile-menu-chevron" />
          </NuxtLink>

          <template v-if="isAuthenticated">
            <div class="mx-4 my-3 border-t border-tikeo-border" />
            <button type="button" class="mobile-menu-row w-full text-left text-tikeo-error" @click="handleLogout">
              <span class="mobile-menu-icon !bg-tikeo-error/10 !text-tikeo-error">
                <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 5v1a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h5a2 2 0 012 2v1" /></svg>
              </span>
              <span class="flex-1 font-semibold">{{ t('header.logout') }}</span>
            </button>
          </template>
        </nav>
      </div>
      </Transition>
    </Teleport>

    <!-- Recherche mobile : repliée par défaut, s'ouvre au clic sur l'icône recherche -->
    <Transition
      enter-active-class="transition-all duration-200 ease-out overflow-hidden"
      leave-active-class="transition-all duration-150 ease-in overflow-hidden"
      enter-from-class="opacity-0 -translate-y-1 max-h-0"
      enter-to-class="opacity-100 translate-y-0 max-h-20"
      leave-from-class="opacity-100 translate-y-0 max-h-20"
      leave-to-class="opacity-0 -translate-y-1 max-h-0"
    >
      <div v-if="mobileSearchOpen" class="flex items-center gap-2 border-t border-tikeo-border px-4 py-2.5 md:hidden">
        <div class="relative flex-1">
          <form class="relative flex" @submit.prevent="submitSearch">
            <svg class="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
            </svg>
            <input
              ref="mobileSearchInput"
              v-model="searchQuery"
              type="search"
              :placeholder="t('header.searchPlaceholder')"
              class="input-field pl-10 pr-12"
              autocomplete="off"
              @focus="focusSuggestions"
              @keyup.esc="mobileSearchOpen = false"
            />
            <button type="submit" class="absolute right-1.5 top-1/2 flex h-7 w-9 -translate-y-1/2 items-center justify-center bg-tikeo-orange text-white" :aria-label="t('header.search')">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z" />
              </svg>
            </button>
          </form>

          <div
            v-if="showSuggestions"
            class="absolute left-0 right-0 top-11 z-50 overflow-hidden border border-tikeo-border bg-tikeo-surface shadow-card-hover"
          >
            <div v-if="suggestLoading" class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.searching') }}</div>
            <template v-else-if="suggestions.length > 0">
              <button
                v-for="s in suggestions"
                :key="s.id"
                type="button"
                class="flex w-full items-center gap-3 px-3.5 py-2.5 text-left hover:bg-tikeo-gray-light"
                @click="goToSuggestion(s.slug)"
              >
                <img :src="s.coverImage" :alt="s.title" class="h-10 w-10 shrink-0 object-cover" />
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-tikeo-black">{{ s.title }}</span>
                  <span class="block truncate text-xs text-tikeo-gray-text">{{ suggestionDate(s.startDate) }} · {{ s.city }}</span>
                </span>
              </button>
              <button
                type="button"
                class="block w-full border-t border-tikeo-border px-3.5 py-2.5 text-center text-xs font-semibold text-tikeo-orange hover:bg-tikeo-gray-light"
                @click="submitSearch"
              >
                {{ t('search.seeAllResults') }}
              </button>
            </template>
            <div v-else class="p-4 text-center text-xs text-tikeo-gray-text">{{ t('search.noSuggestion') }}</div>
          </div>
          <Teleport to="body">
            <button v-if="showSuggestions" type="button" class="fixed inset-0 z-40 cursor-default" :aria-label="t('common.close')" @click="showSuggestions = false" />
          </Teleport>
        </div>
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-gray-text"
          :aria-label="t('header.filters')"
          @click="openMobileFilters"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 6h16M7 12h10M10 18h4" />
          </svg>
        </button>
        <ThemeToggle class="!h-10" />
        <LanguageSwitcher />
      </div>
    </Transition>
  </header>
</template>
