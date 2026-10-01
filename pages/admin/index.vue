<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const loading = ref(true)
const stats = reactive({ users: 0, organizers: 0, events: 0, publishedEvents: 0 })

// RBAC (migration 0021) : le tableau de bord est la page d'atterrissage
// commune à tous les rôles admin, mais chaque carte de statistique/raccourci
// ne s'affiche que si le rôle connecté a le droit de voir la ressource
// correspondante — sinon la RLS renverrait simplement 0, ce qui donnerait
// la fausse impression d'une plateforme vide.
const canSeeUsers = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.view'))
const canSeeOrganizers = computed(() => authStore.isSuperAdmin || authStore.hasPermission('organizers.view'))
const canSeeEvents = computed(() => authStore.isSuperAdmin || authStore.hasPermission('events.view'))

onMounted(async () => {
  try {
    const [usersRes, organizersRes, eventsRes, publishedRes] = await Promise.all([
      canSeeUsers.value ? supabase.from('profiles').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
      canSeeOrganizers.value ? supabase.from('organizers').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
      canSeeEvents.value ? supabase.from('events').select('*', { count: 'exact', head: true }) : Promise.resolve({ count: null }),
      canSeeEvents.value
        ? supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published')
        : Promise.resolve({ count: null }),
    ])
    stats.users = usersRes.count ?? 0
    stats.organizers = organizersRes.count ?? 0
    stats.events = eventsRes.count ?? 0
    stats.publishedEvents = publishedRes.count ?? 0
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminDashboard.title') }}</h1>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div v-if="canSeeUsers" class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.users') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.users }}</p>
      </div>
      <div v-if="canSeeOrganizers" class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.organizers') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.organizers }}</p>
      </div>
      <div v-if="canSeeEvents" class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.events') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.events }}</p>
      </div>
      <div v-if="canSeeEvents" class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.published') }}</p>
        <p class="text-2xl font-bold text-tikeo-success">{{ loading ? '—' : stats.publishedEvents }}</p>
      </div>
    </div>

    <div class="mt-8 grid gap-3 md:grid-cols-3">
      <NuxtLink v-if="canSeeEvents" to="/admin/evenements" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageEvents') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageEventsDesc') }}</p>
      </NuxtLink>
      <NuxtLink v-if="canSeeOrganizers" to="/admin/organisateurs" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageOrganizers') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageOrganizersDesc') }}</p>
      </NuxtLink>
      <NuxtLink v-if="canSeeUsers" to="/admin/utilisateurs" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageUsers') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageUsersDesc') }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
