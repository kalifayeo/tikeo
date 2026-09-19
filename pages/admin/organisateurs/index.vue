<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
import type { Organizer } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const loading = ref(true)
const organizers = ref<Organizer[]>([])
const errorMessage = ref('')

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
  const { error } = await supabase.from('organizers').update({ status }).eq('id', org.id)
  if (!error) org.status = status
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="mb-6 text-xl font-bold text-tikeo-black">{{ t('adminOrganizers.title') }}</h1>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <div v-else-if="organizers.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('adminOrganizers.empty') }}
    </div>
    <div v-else class="divide-y divide-tikeo-border border border-tikeo-border">
      <div v-for="org in organizers" :key="org.id" class="flex items-center justify-between gap-3 p-4">
        <div class="min-w-0">
          <p class="truncate font-semibold text-tikeo-black">{{ org.name }}</p>
          <p class="text-xs text-tikeo-gray-text">{{ org.email || '—' }} · {{ org.status }}</p>
        </div>
        <div class="flex shrink-0 gap-2">
          <button
            v-if="org.status !== 'approved'"
            type="button"
            class="border border-tikeo-border px-2.5 py-1 text-xs hover:border-tikeo-success hover:text-tikeo-success"
            @click="setStatus(org, 'approved')"
          >
            {{ t('adminOrganizers.approve') }}
          </button>
          <button
            v-if="org.status !== 'suspended'"
            type="button"
            class="border border-tikeo-border px-2.5 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error"
            @click="setStatus(org, 'suspended')"
          >
            {{ t('adminOrganizers.suspend') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
