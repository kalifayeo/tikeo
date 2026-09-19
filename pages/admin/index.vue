<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
const { t } = useI18n()
const supabase = useSupabase()
const loading = ref(true)
const stats = reactive({ users: 0, organizers: 0, events: 0, publishedEvents: 0 })

onMounted(async () => {
  try {
    const [{ count: users }, { count: organizers }, { count: events }, { count: publishedEvents }] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('organizers').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }),
      supabase.from('events').select('*', { count: 'exact', head: true }).eq('status', 'published'),
    ])
    stats.users = users ?? 0
    stats.organizers = organizers ?? 0
    stats.events = events ?? 0
    stats.publishedEvents = publishedEvents ?? 0
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminDashboard.title') }}</h1>

    <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.users') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.users }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.organizers') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.organizers }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.events') }}</p>
        <p class="text-2xl font-bold text-tikeo-black">{{ loading ? '—' : stats.events }}</p>
      </div>
      <div class="border border-tikeo-border bg-tikeo-surface p-4">
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.published') }}</p>
        <p class="text-2xl font-bold text-tikeo-success">{{ loading ? '—' : stats.publishedEvents }}</p>
      </div>
    </div>

    <div class="mt-8 grid gap-3 md:grid-cols-3">
      <NuxtLink to="/admin/evenements" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageEvents') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageEventsDesc') }}</p>
      </NuxtLink>
      <NuxtLink to="/admin/organisateurs" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageOrganizers') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageOrganizersDesc') }}</p>
      </NuxtLink>
      <NuxtLink to="/admin/utilisateurs" class="border border-tikeo-border p-4 hover:border-tikeo-orange">
        <p class="font-semibold text-tikeo-black">{{ t('adminDashboard.manageUsers') }}</p>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminDashboard.manageUsersDesc') }}</p>
      </NuxtLink>
    </div>
  </div>
</template>
