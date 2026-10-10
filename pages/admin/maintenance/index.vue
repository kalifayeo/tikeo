<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'settings.manage' })

import type { MaintenanceKind, MaintenanceState } from '~/utils/maintenance'

const { t, locale } = useI18n()
const { askConfirm } = useAdminConfirm()
const supabase = useSupabase()

const TITLE_MAX = 120
const MESSAGE_MAX = 600

const loading = ref(true)
const saving = ref(false)
const savedMsg = ref('')
const errorMsg = ref('')
const saved = ref<MaintenanceState | null>(null)

const form = reactive({
  enabled: false,
  kind: 'planned' as MaintenanceKind,
  title: '',
  message: '',
  endsAtLocal: '',
})

// <input type="datetime-local"> travaille en heure locale, sans fuseau.
function toLocalInput(iso?: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function applyState(s: MaintenanceState) {
  saved.value = s
  form.enabled = s.enabled
  form.kind = s.kind
  form.title = s.title || ''
  form.message = s.message || ''
  form.endsAtLocal = toLocalInput(s.endsAt)
}

async function load() {
  loading.value = true
  errorMsg.value = ''
  try {
    applyState(await $fetch<MaintenanceState>('/api/maintenance'))
  } catch {
    errorMsg.value = t('adminMaintenance.errorLoad')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const dirty = computed(() => {
  const s = saved.value
  if (!s) return false
  return (
    form.enabled !== s.enabled ||
    form.kind !== s.kind ||
    form.title.trim() !== (s.title || '') ||
    form.message.trim() !== (s.message || '') ||
    form.endsAtLocal !== toLocalInput(s.endsAt)
  )
})

const lastUpdate = computed(() => {
  if (!saved.value?.updatedAt) return ''
  try {
    return new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(saved.value.updatedAt))
  } catch {
    return ''
  }
})

async function save() {
  errorMsg.value = ''
  savedMsg.value = ''

  // Fermer le site est un acte lourd : confirmation explicite à l'activation.
  if (form.enabled && !saved.value?.enabled && !(await askConfirm({ message: t('adminMaintenance.confirmEnable') }))) return

  saving.value = true
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error(t('adminMaintenance.sessionExpired'))

    const { csrfHeader } = useCsrf()
    const res = await $fetch<{ maintenance: MaintenanceState }>('/api/admin/maintenance', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
      body: {
        enabled: form.enabled,
        kind: form.kind,
        title: form.title,
        message: form.message,
        endsAt: form.endsAtLocal ? new Date(form.endsAtLocal).toISOString() : null,
      },
    })
    applyState(res.maintenance)
    // Prochaine navigation : l'état est relu tout de suite côté navigateur.
    useState<MaintenanceState | null>('tikeo-maintenance').value = null
    savedMsg.value = t('adminMaintenance.saved')
    setTimeout(() => (savedMsg.value = ''), 3500)
  } catch (e: any) {
    errorMsg.value = e?.data?.statusMessage || e?.message || t('adminMaintenance.errorSave')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 md:px-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black md:text-2xl">{{ t('adminMaintenance.title') }}</h1>
        <p class="mt-1 max-w-2xl text-sm text-tikeo-gray-text">{{ t('adminMaintenance.subtitle') }}</p>
      </div>
      <span
        v-if="saved"
        class="inline-flex items-center gap-2 border px-3 py-1.5 text-xs font-bold uppercase tracking-wide"
        :class="saved.enabled ? 'border-tikeo-error/40 bg-tikeo-error/10 text-tikeo-error' : 'border-tikeo-success/40 bg-tikeo-success/10 text-tikeo-success'"
      >
        <span class="h-2 w-2 rounded-full" :class="saved.enabled ? 'bg-tikeo-error' : 'bg-tikeo-success'" />
        {{ saved.enabled ? t('adminMaintenance.statusOn') : t('adminMaintenance.statusOff') }}
      </span>
    </div>

    <div v-if="loading" class="flex justify-center py-16"><TikeoSpinner :size="32" /></div>

    <div v-else class="mt-6 grid gap-6 lg:grid-cols-2">
      <!-- Réglages -->
      <form class="space-y-5 border border-tikeo-border bg-tikeo-surface p-5" @submit.prevent="save">
        <div class="flex items-start justify-between gap-4">
          <div>
            <p class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.enableLabel') }}</p>
            <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminMaintenance.enableHint') }}</p>
          </div>
          <ToggleSwitch v-model="form.enabled" :aria-label="t('adminMaintenance.enableLabel')" />
        </div>

        <fieldset>
          <legend class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.kindLabel') }}</legend>
          <div class="mt-2 grid gap-2 sm:grid-cols-2">
            <label
              v-for="k in (['planned', 'emergency'] as const)"
              :key="k"
              class="flex cursor-pointer items-start gap-2 border p-3 text-sm"
              :class="form.kind === k ? 'border-tikeo-orange bg-tikeo-orange/10' : 'border-tikeo-border'"
            >
              <input v-model="form.kind" type="radio" name="kind" :value="k" class="mt-1 accent-[#FF7A00]" />
              <span>
                <span class="block font-semibold text-tikeo-black">{{ t(k === 'planned' ? 'adminMaintenance.kindPlanned' : 'adminMaintenance.kindEmergency') }}</span>
                <span class="block text-xs text-tikeo-gray-text">{{ t(k === 'planned' ? 'adminMaintenance.kindPlannedHint' : 'adminMaintenance.kindEmergencyHint') }}</span>
              </span>
            </label>
          </div>
        </fieldset>

        <div>
          <label for="m-title" class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.titleLabel') }}</label>
          <input id="m-title" v-model="form.title" type="text" class="input-field mt-1.5" :maxlength="TITLE_MAX" :placeholder="t('adminMaintenance.titlePlaceholder')" />
        </div>

        <div>
          <label for="m-message" class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.messageLabel') }}</label>
          <textarea id="m-message" v-model="form.message" rows="4" class="input-field mt-1.5 resize-y" :maxlength="MESSAGE_MAX" :placeholder="t('adminMaintenance.messagePlaceholder')" />
          <p class="mt-1 text-right text-[11px] text-tikeo-gray-text">{{ form.message.length }}/{{ MESSAGE_MAX }}</p>
        </div>

        <div>
          <label for="m-ends" class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.endsAtLabel') }}</label>
          <input id="m-ends" v-model="form.endsAtLocal" type="datetime-local" class="input-field mt-1.5" />
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminMaintenance.endsAtHint') }}</p>
        </div>

        <p v-if="errorMsg" class="acc-alert-error" role="alert">{{ errorMsg }}</p>
        <p v-if="savedMsg" class="acc-alert-success" role="status">{{ savedMsg }}</p>

        <div class="flex flex-wrap items-center gap-3">
          <button type="submit" class="btn-ink disabled:opacity-60" :disabled="saving || !dirty">
            <TikeoSpinner v-if="saving" :size="16" class="!text-current" /><AppIcon v-else name="save" class="h-[18px] w-[18px]" />
            {{ saving ? t('adminMaintenance.saving') : t('adminMaintenance.save') }}
          </button>
          <span v-if="lastUpdate" class="text-xs text-tikeo-gray-text">{{ t('adminMaintenance.lastUpdate', { date: lastUpdate }) }}</span>
        </div>
      </form>

      <!-- Aperçu + effets -->
      <div class="space-y-6">
        <div class="org-panel">
          <p class="border-b border-tikeo-border bg-tikeo-surface-alt px-4 py-2 text-xs font-bold uppercase tracking-wide text-tikeo-gray-text">
            {{ t('adminMaintenance.previewTitle') }}
          </p>
          <MaintenanceNotice
            preview
            :kind="form.kind"
            :title="form.title"
            :message="form.message"
            :ends-at="form.endsAtLocal ? new Date(form.endsAtLocal).toISOString() : null"
          />
        </div>

        <div class="border border-tikeo-border bg-tikeo-surface p-5">
          <p class="text-sm font-semibold text-tikeo-black">{{ t('adminMaintenance.effectsTitle') }}</p>
          <ul class="mt-3 space-y-2 text-sm text-tikeo-gray-text">
            <li>• {{ t('adminMaintenance.effectPages') }}</li>
            <li>• {{ t('adminMaintenance.effectOrders') }}</li>
            <li>• {{ t('adminMaintenance.effectOpen') }}</li>
            <li>• {{ t('adminMaintenance.effectPreview') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
