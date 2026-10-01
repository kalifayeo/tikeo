<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'popups.manage' })

import type { Popup } from '~/types/database'

const { t } = useI18n()
const api = useAdminEngagementTable<Popup>('popups', { column: 'created_at', ascending: false })

const draft = ref<Partial<Popup> | null>(null)
const saving = ref(false)
const preview = ref<Popup | null>(null)
const message = ref('')
const errorMsg = ref('')

// <input type="datetime-local"> travaille en heure locale, sans fuseau.
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

const startsLocal = ref('')
const endsLocal = ref('')

function openForm(p?: Popup) {
  errorMsg.value = ''
  draft.value = p
    ? { ...p, image_url: p.image_url || '', cta_label: p.cta_label || '', cta_url: p.cta_url || '', message: p.message || '' }
    : { title: '', message: '', image_url: '', cta_label: '', cta_url: '', frequency: 'once', audience: 'all', status: 'active' }
  startsLocal.value = toLocalInput(p?.starts_at)
  endsLocal.value = toLocalInput(p?.ends_at)
}

function flash(msg: string) {
  errorMsg.value = ''
  message.value = msg
  setTimeout(() => (message.value = ''), 2500)
}

async function guarded(fn: () => Promise<unknown>, ok?: string) {
  errorMsg.value = ''
  try {
    await fn()
    if (ok) flash(ok)
    return true
  } catch (e: any) {
    errorMsg.value = e?.message || t('adminEngagement.error')
    return false
  }
}

async function save() {
  const d = draft.value
  if (!d || !d.title?.trim()) return
  const starts_at = fromLocalInput(startsLocal.value)
  const ends_at = fromLocalInput(endsLocal.value)
  if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
    errorMsg.value = t('adminEngagement.dateError')
    return
  }
  const url = d.cta_url?.trim() || ''
  if (url && !(url.startsWith('/') && !url.startsWith('//')) && !/^https?:\/\//i.test(url)) {
    errorMsg.value = t('adminEngagement.urlError')
    return
  }
  saving.value = true
  const payload = {
    title: d.title.trim(),
    message: d.message?.trim() || null,
    image_url: d.image_url?.trim() || null,
    cta_label: d.cta_label?.trim() || null,
    cta_url: url || null,
    frequency: d.frequency || 'once',
    audience: d.audience || 'all',
    status: d.status || 'inactive',
    starts_at,
    ends_at,
  }
  const ok = await guarded(() => (d.id ? api.update(d.id, payload) : api.create(payload)), t('adminEngagement.saved'))
  saving.value = false
  if (ok) draft.value = null
}

async function toggle(p: Popup) {
  await guarded(() => api.update(p.id, { status: p.status === 'active' ? 'inactive' : 'active' }))
}
async function republish(p: Popup) {
  await guarded(() => api.update(p.id, { revision: p.revision + 1 }), t('adminEngagement.republished'))
}
async function remove(p: Popup) {
  if (!confirm(t('adminEngagement.deleteConfirm'))) return
  await guarded(() => api.remove(p.id))
}

function liveState(p: Popup): 'inactive' | 'scheduled' | 'expired' | 'live' {
  if (p.status !== 'active') return 'inactive'
  const now = Date.now()
  if (p.starts_at && new Date(p.starts_at).getTime() > now) return 'scheduled'
  if (p.ends_at && new Date(p.ends_at).getTime() <= now) return 'expired'
  return 'live'
}
const stateClass: Record<string, string> = {
  live: 'bg-green-500/15 text-green-700',
  scheduled: 'bg-tikeo-blue/15 text-tikeo-blue',
  expired: 'bg-tikeo-gray-text/15 text-tikeo-gray-text',
  inactive: 'bg-tikeo-gray-text/15 text-tikeo-gray-text',
}
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminEngagement.popupsTitle') }}</h1>
        <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminEngagement.popupsSubtitle') }}</p>
      </div>
      <button type="button" class="btn-primary !py-2 text-xs" @click="openForm()">+ {{ t('adminEngagement.newPopup') }}</button>
    </div>

    <p v-if="errorMsg" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ errorMsg }}</p>
    <p v-if="message" class="mb-4 border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">{{ message }}</p>

    <form v-if="draft" class="mb-6 grid gap-3 border border-tikeo-orange/40 bg-tikeo-orange/5 p-5 sm:grid-cols-2" @submit.prevent="save">
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldTitle') }}</label>
        <input v-model="draft.title" type="text" maxlength="120" required class="input-field w-full" />
      </div>
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldMessage') }}</label>
        <textarea v-model="draft.message" rows="3" maxlength="800" class="input-field w-full" />
      </div>
      <div class="sm:col-span-2">
        <MediaInput :model-value="draft.image_url || ''" folder="home-slides" :label="t('adminEngagement.fieldImage')" @update:model-value="draft!.image_url = $event" />
        <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminEngagement.popupImageHint') }}</p>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldCtaLabel') }}</label>
        <input v-model="draft.cta_label" type="text" maxlength="40" class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldCtaUrl') }}</label>
        <input v-model="draft.cta_url" type="text" maxlength="500" class="input-field w-full" placeholder="/evenements" />
        <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminEngagement.ctaUrlHint') }}</p>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldFrequency') }}</label>
        <select v-model="draft.frequency" class="input-field w-full">
          <option value="once">{{ t('adminEngagement.freq.once') }}</option>
          <option value="session">{{ t('adminEngagement.freq.session') }}</option>
          <option value="always">{{ t('adminEngagement.freq.always') }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldAudience') }}</label>
        <select v-model="draft.audience" class="input-field w-full">
          <option value="all">{{ t('adminEngagement.aud.all') }}</option>
          <option value="visitors">{{ t('adminEngagement.aud.visitors') }}</option>
          <option value="members">{{ t('adminEngagement.aud.members') }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldStart') }}</label>
        <input v-model="startsLocal" type="datetime-local" class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldEnd') }}</label>
        <input v-model="endsLocal" type="datetime-local" class="input-field w-full" />
      </div>
      <div class="sm:col-span-2">
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldStatus') }}</label>
        <select v-model="draft.status" class="input-field w-full sm:w-64">
          <option value="active">{{ t('adminEngagement.active') }}</option>
          <option value="inactive">{{ t('adminEngagement.inactive') }}</option>
        </select>
      </div>
      <div class="flex flex-wrap gap-2 sm:col-span-2">
        <button type="submit" class="btn-primary !py-2 text-xs" :disabled="saving">{{ saving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
        <button type="button" class="btn-secondary !py-2 text-xs" @click="preview = { ...(draft as Popup), id: draft.id || 'preview', revision: 1 }">👁 {{ t('adminEngagement.preview') }}</button>
        <button type="button" class="btn-secondary !py-2 text-xs" @click="draft = null">{{ t('adminEngagement.cancel') }}</button>
      </div>
    </form>

    <p v-if="!api.loading.value && !api.items.value.length" class="border border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">{{ t('adminEngagement.emptyPopups') }}</p>

    <ul class="space-y-3">
      <li v-for="p in api.items.value" :key="p.id" class="flex flex-col gap-3 border border-tikeo-border bg-tikeo-surface p-4 sm:flex-row sm:items-center">
        <span class="flex h-20 w-32 shrink-0 items-center justify-center overflow-hidden bg-tikeo-brand text-3xl">
          <img v-if="p.image_url" :src="p.image_url" alt="" class="h-full w-full object-cover" />
          <template v-else>📣</template>
        </span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-bold text-tikeo-black">{{ p.title }}</p>
            <span class="px-2 py-0.5 text-[10px] font-bold uppercase" :class="stateClass[liveState(p)]">{{ t(`adminEngagement.state.${liveState(p)}`) }}</span>
          </div>
          <p v-if="p.message" class="mt-0.5 line-clamp-2 text-xs text-tikeo-gray-text">{{ p.message }}</p>
          <p class="mt-1 text-[11px] text-tikeo-gray-text">
            {{ t(`adminEngagement.freq.${p.frequency}`) }} · {{ t(`adminEngagement.aud.${p.audience}`) }}
            <template v-if="p.starts_at"> · {{ t('adminEngagement.from') }} {{ fmtDate(p.starts_at) }}</template>
            <template v-if="p.ends_at"> · {{ t('adminEngagement.until') }} {{ fmtDate(p.ends_at) }}</template>
          </p>
        </div>
        <div class="flex shrink-0 flex-wrap items-center gap-1">
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="preview = p">{{ t('adminEngagement.preview') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="toggle(p)">{{ p.status === 'active' ? t('adminEngagement.deactivate') : t('adminEngagement.activate') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" :title="t('adminEngagement.republishHint')" @click="republish(p)">↻ {{ t('adminEngagement.republish') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="openForm(p)">{{ t('adminEngagement.edit') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error" @click="remove(p)">{{ t('adminEngagement.delete') }}</button>
        </div>
      </li>
    </ul>

    <AnnouncementPopup v-if="preview" :popup="preview" @close="preview = null" />
  </div>
</template>
