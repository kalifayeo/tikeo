<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'organizers.view' })
import type { Organizer } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const loading = ref(true)
const organizers = ref<Organizer[]>([])
const errorMessage = ref('')
const togglingId = ref<string | null>(null)

const canApprove = computed(() => authStore.isSuperAdmin || authStore.hasPermission('organizers.approve'))
const canSuspend = computed(() => authStore.isSuperAdmin || authStore.hasPermission('organizers.suspend'))

// organizers.created_at correspond exactement au moment où la demande a été
// envoyée (la ligne est créée au clic sur "Devenir organisateur", cf.
// server/api/account/become-organizer.post.ts) : c'est aussi la date à
// afficher dans le bloc "à approuver" ci-dessous.
function requestedAt(org: Organizer) {
  return new Date(org.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })
}


async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('organizers').select('*').order('created_at', { ascending: false })
    if (error) throw error
    organizers.value = (data as unknown as Organizer[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminOrganizers.errorLoad')
  } finally {
    loading.value = false
  }
}

async function setStatus(org: Organizer, status: string) {
  togglingId.value = org.id
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('organizers').update({ status }).eq('id', org.id)
    if (error) throw error
    org.status = status
    await writeAuditLog({
      action: status === 'approved' ? 'ORGANIZER_APPROVED' : status === 'suspended' ? 'ORGANIZER_SUSPENDED' : 'ORGANIZER_STATUS_CHANGED',
      entityType: 'organizers',
      entityId: org.id,
      metadata: { name: org.name },
    })
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminOrganizers.errorLoad')
  } finally {
    togglingId.value = null
  }
}

onMounted(load)

const search = ref('')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return organizers.value
  return organizers.value.filter((o: any) => [o.name, o.email].some((v) => (v || '').toString().toLowerCase().includes(q)))
})
function statusTone(status: string) {
  if (status === 'approved') return 'success'
  if (status === 'suspended') return 'error'
  if (status === 'pending') return 'warning'
  return 'neutral'
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminOrganizers.title') }}</h1>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <AdminEmpty v-else-if="organizers.length === 0" icon="briefcase" :text="t('adminOrganizers.empty')" />
    <template v-else>
      <div class="admin-toolbar">
        <AdminSearch v-model="search" :placeholder="t('adminOrganizers.search')" />
      </div>
      <AdminEmpty v-if="filtered.length === 0" icon="search" :text="t('adminCommon.noResults')" />
      <ul v-else class="grid gap-3">
        <li v-for="org in filtered" :key="org.id" class="org-panel org-card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div class="flex min-w-0 items-center gap-3">
            <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-tikeo-ink text-sm font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
              <img v-if="org.logo_url" :src="org.logo_url" :alt="org.name" class="h-full w-full object-cover" />
              <template v-else>{{ org.name.slice(0, 2).toUpperCase() }}</template>
            </span>
            <div class="min-w-0">
              <p class="flex flex-wrap items-center gap-2">
                <span class="truncate font-semibold text-tikeo-black">{{ org.name }}</span>
                <StatusPill :tone="statusTone(org.status)">{{ org.status }}</StatusPill>
              </p>
              <p class="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-tikeo-gray-text">
                <span class="inline-flex items-center gap-1"><AppIcon name="mail" class="h-3.5 w-3.5" />{{ org.email || '—' }}</span>
                <span class="inline-flex items-center gap-1"><AppIcon name="star" class="h-3.5 w-3.5" />{{ org.custom_commission_rate != null ? t('adminOrganizers.customRate', { rate: String(org.custom_commission_rate).replace('.', ',') }) : t('adminOrganizers.standardRate') }}</span>
              </p>
              <p class="mt-0.5 text-xs text-tikeo-gray-text">
                <span v-if="org.status === 'pending'">{{ t('adminOrganizers.requestedAt', { date: requestedAt(org) }) }}</span>
                <span v-else>{{ t('adminOrganizers.memberSince', { date: requestedAt(org) }) }}</span>
              </p>
            </div>
          </div>
          <div class="flex shrink-0 gap-2">
            <OrgIconButton v-if="org.status !== 'approved' && canApprove" icon="check-circle" :label="t('adminOrganizers.approve')" :loading="togglingId === org.id" @click="setStatus(org, 'approved')" />
            <OrgIconButton v-if="org.status !== 'suspended' && canSuspend" icon="ban" danger :label="t('adminOrganizers.suspend')" :loading="togglingId === org.id" @click="setStatus(org, 'suspended')" />
          </div>
        </li>
      </ul>
    </template>
  </div>
</template>
