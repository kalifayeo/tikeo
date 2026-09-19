<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })

interface ContactMessage {
  id: string
  full_name: string
  email: string
  subject: string
  message: string
  status: 'new' | 'read' | 'archived'
  created_at: string
}

const { t } = useI18n()
const supabase = useSupabase()

const loading = ref(true)
const messages = ref<ContactMessage[]>([])
const errorMessage = ref('')
const statusFilter = ref<'all' | ContactMessage['status']>('all')
const search = ref('')
const expandedId = ref<string | null>(null)
const updatingId = ref<string | null>(null)

const statusLabels = computed<Record<ContactMessage['status'], string>>(() => ({
  new: t('adminMessages.statusNew'),
  read: t('adminMessages.statusRead'),
  archived: t('adminMessages.statusArchived'),
}))
const statusClass: Record<ContactMessage['status'], string> = {
  new: 'bg-tikeo-orange/10 text-tikeo-orange',
  read: 'bg-tikeo-blue/10 text-tikeo-blue',
  archived: 'bg-tikeo-gray-light text-tikeo-gray-text',
}

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    messages.value = (data as unknown as ContactMessage[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminMessages.loadError')
  } finally {
    loading.value = false
  }
}

const filtered = computed(() => {
  let list = messages.value
  if (statusFilter.value !== 'all') list = list.filter((m) => m.status === statusFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) {
    list = list.filter((m) => [m.full_name, m.email, m.subject].some((v) => v.toLowerCase().includes(term)))
  }
  return list
})

function toggleExpand(m: ContactMessage) {
  expandedId.value = expandedId.value === m.id ? null : m.id
  if (m.status === 'new') updateStatus(m, 'read')
}

async function updateStatus(m: ContactMessage, status: ContactMessage['status']) {
  updatingId.value = m.id
  try {
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', m.id)
    if (error) throw error
    m.status = status
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminMessages.updateError')
  } finally {
    updatingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 md:px-6">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('adminMessages.title') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('adminMessages.subtitle') }}</p>

    <div class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <input v-model="search" type="text" :placeholder="t('adminMessages.searchPlaceholder')" class="input-field w-full sm:max-w-xs" />
      <select v-model="statusFilter" class="input-field w-full sm:w-auto">
        <option value="all">{{ t('adminMessages.filterAll') }}</option>
        <option v-for="(label, key) in statusLabels" :key="key" :value="key">{{ label }}</option>
      </select>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else-if="filtered.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminMessages.empty') }}
    </div>

    <div v-else class="divide-y divide-tikeo-border border border-tikeo-border">
      <div v-for="m in filtered" :key="m.id" class="p-4">
        <button type="button" class="flex w-full flex-col gap-2 text-left sm:flex-row sm:items-center sm:justify-between" @click="toggleExpand(m)">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <p class="font-semibold text-tikeo-black">{{ m.full_name }}</p>
              <span class="px-2 py-0.5 text-[11px] font-semibold" :class="statusClass[m.status]">{{ statusLabels[m.status] }}</span>
            </div>
            <p class="truncate text-sm text-tikeo-gray-text">{{ m.subject }}</p>
          </div>
          <p class="shrink-0 text-xs text-tikeo-gray-text">{{ new Date(m.created_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) }}</p>
        </button>

        <div v-if="expandedId === m.id" class="mt-3 space-y-3 border-t border-tikeo-border pt-3">
          <p class="text-sm text-tikeo-black">
            <a :href="`mailto:${m.email}`" class="font-medium text-tikeo-orange hover:underline">{{ m.email }}</a>
          </p>
          <p class="whitespace-pre-wrap text-sm text-tikeo-black">{{ m.message }}</p>
          <div class="flex flex-wrap gap-2">
            <a :href="`mailto:${m.email}?subject=${encodeURIComponent('Re: ' + m.subject)}`" class="btn-secondary !py-1.5 !text-xs">
              {{ t('adminMessages.reply') }}
            </a>
            <button
              v-if="m.status !== 'archived'"
              type="button"
              class="border border-tikeo-border px-3 py-1.5 text-xs font-semibold text-tikeo-gray-text hover:border-tikeo-orange hover:text-tikeo-orange"
              :disabled="updatingId === m.id"
              @click.stop="updateStatus(m, 'archived')"
            >
              {{ t('adminMessages.archive') }}
            </button>
            <button
              v-else
              type="button"
              class="border border-tikeo-border px-3 py-1.5 text-xs font-semibold text-tikeo-gray-text hover:border-tikeo-orange hover:text-tikeo-orange"
              :disabled="updatingId === m.id"
              @click.stop="updateStatus(m, 'read')"
            >
              {{ t('adminMessages.unarchive') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
