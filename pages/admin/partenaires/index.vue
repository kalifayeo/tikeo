<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'partners.manage' })

import type { Partner, PartnerCategory } from '~/types/database'
import { PARTNER_CATEGORIES, PARTNER_CATEGORY_ICONS, safeExternalUrl } from '~/composables/usePartners'

const { t } = useI18n()
const { askConfirm } = useAdminConfirm()
const api = useAdminPartners()

const search = ref('')
const categoryFilter = ref<PartnerCategory | 'all'>('all')
const statusFilter = ref<'all' | 'active' | 'inactive' | 'featured'>('all')

const draft = ref<Partial<Partner> | null>(null)
const saving = ref(false)
const message = ref('')
const errorMsg = ref('')
const busyId = ref<string | null>(null)

// --- Chiffres clés --------------------------------------------------------
const stats = computed(() => [
  { key: 'all', icon: 'handshake', value: api.items.value.length, label: t('adminPartners.statTotal') },
  { key: 'active', icon: 'check-circle', value: api.items.value.filter((p) => p.status === 'active').length, label: t('adminPartners.statActive') },
  { key: 'featured', icon: 'star', value: api.items.value.filter((p) => p.is_featured).length, label: t('adminPartners.statFeatured') },
  { key: 'inactive', icon: 'pause', value: api.items.value.filter((p) => p.status === 'inactive').length, label: t('adminPartners.statInactive') },
])

// Réordonner n'a de sens que sur la liste complète (sans filtre).
const canReorder = computed(() => !search.value.trim() && categoryFilter.value === 'all' && statusFilter.value === 'all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return api.sorted.value.filter((p) => {
    if (categoryFilter.value !== 'all' && p.category !== categoryFilter.value) return false
    if (statusFilter.value === 'active' && p.status !== 'active') return false
    if (statusFilter.value === 'inactive' && p.status !== 'inactive') return false
    if (statusFilter.value === 'featured' && !p.is_featured) return false
    if (q && !`${p.name} ${p.description ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
})

// --- Utilitaires -----------------------------------------------------------
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
    errorMsg.value = e?.message || t('adminPartners.error')
    return false
  }
}

// --- Formulaire (ajout / modification) --------------------------------------
function openForm(p?: Partner) {
  errorMsg.value = ''
  draft.value = p
    ? { ...p, description: p.description || '', logo_url: p.logo_url || '', website_url: p.website_url || '' }
    : { name: '', description: '', logo_url: '', website_url: '', category: 'sponsor', is_featured: false, status: 'active' }
}

async function save() {
  const d = draft.value
  if (!d || !d.name?.trim()) return
  const url = d.website_url?.trim() || ''
  if (url && !/^https?:\/\//i.test(url)) {
    errorMsg.value = t('adminPartners.urlError')
    return
  }
  saving.value = true
  const payload = {
    name: d.name.trim(),
    description: d.description?.trim() || null,
    logo_url: d.logo_url?.trim() || null,
    website_url: url || null,
    category: (d.category || 'other') as PartnerCategory,
    is_featured: !!d.is_featured,
    status: (d.status || 'inactive') as Partner['status'],
  }
  const ok = await guarded(() => (d.id ? api.update(d.id, payload) : api.create(payload)), d.id ? t('adminPartners.updated') : t('adminPartners.created'))
  saving.value = false
  if (ok) draft.value = null
}

// --- Actions rapides sur une ligne ------------------------------------------
async function run(p: Partner, fn: () => Promise<unknown>, ok?: string) {
  busyId.value = p.id
  await guarded(fn, ok)
  busyId.value = null
}
const toggleStatus = (p: Partner) => run(p, () => api.update(p.id, { status: p.status === 'active' ? 'inactive' : 'active' }))
const toggleFeatured = (p: Partner) => run(p, () => api.update(p.id, { is_featured: !p.is_featured }))
const move = (p: Partner, dir: -1 | 1) => run(p, () => api.move(p, dir))

async function remove(p: Partner) {
  const ok = await askConfirm({
    title: t('adminPartners.deleteTitle'),
    message: t('adminPartners.deleteConfirm', { name: p.name }),
    confirmLabel: t('adminPartners.delete'),
  })
  if (!ok) return
  await run(p, () => api.remove(p.id), t('adminPartners.deleted'))
}

const indexInAll = (p: Partner) => api.sorted.value.findIndex((x) => x.id === p.id)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminPartners.title') }}</h1>
        <p class="mt-1 max-w-xl text-sm text-tikeo-gray-text">{{ t('adminPartners.subtitle') }}</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <NuxtLink to="/partenaires" target="_blank" class="acc-btn-ghost !text-[13px]"><AppIcon name="external-link" class="h-[18px] w-[18px]" />{{ t('adminPartners.viewPublic') }}</NuxtLink>
        <button type="button" class="btn-ink !h-10 !px-4 !text-[13px]" @click="openForm()"><AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.2" />{{ t('adminPartners.add') }}</button>
      </div>
    </div>

    <p v-if="errorMsg && !draft" class="acc-alert-error mb-4">{{ errorMsg }}</p>
    <p v-if="message" class="acc-alert-success mb-4">{{ message }}</p>

    <!-- Cartes-filtres -->
    <div class="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
      <button
        v-for="s in stats"
        :key="s.key"
        type="button"
        class="org-panel org-card-hover flex items-center gap-3 p-3 text-left"
        :class="statusFilter === s.key ? '!border-tikeo-ink dark:!border-[#FF7A00]' : ''"
        :aria-pressed="statusFilter === s.key"
        @click="statusFilter = s.key as any"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon :name="s.icon" class="h-5 w-5" /></span>
        <span class="min-w-0">
          <span class="block font-display text-2xl font-extrabold leading-none text-tikeo-black">{{ s.value }}</span>
          <span class="mt-1 block truncate text-[11px] font-semibold text-tikeo-gray-text">{{ s.label }}</span>
        </span>
      </button>
    </div>

    <!-- Recherche + catégorie -->
    <div class="mb-5 flex flex-col gap-2 sm:flex-row">
      <AdminSearch v-model="search" :placeholder="t('adminPartners.search')" class="sm:flex-1" />
      <select v-model="categoryFilter" class="input-field sm:w-56" :aria-label="t('adminPartners.fieldCategory')">
        <option value="all">{{ t('partners.all') }}</option>
        <option v-for="c in PARTNER_CATEGORIES" :key="c" :value="c">{{ t(`partners.categories.${c}`) }}</option>
      </select>
    </div>

    <!-- Liste -->
    <div v-if="api.loading.value" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-24 animate-pulse bg-tikeo-border" />
    </div>
    <AdminEmpty v-else-if="!api.items.value.length" icon="handshake" :text="t('adminPartners.empty')">
      <button type="button" class="btn-ink !h-10 !px-4 !text-[13px]" @click="openForm()"><AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.2" />{{ t('adminPartners.addFirst') }}</button>
    </AdminEmpty>
    <AdminEmpty v-else-if="!filtered.length" icon="search" :text="t('adminPartners.noResult')" />

    <ul v-else class="space-y-3">
      <li v-for="p in filtered" :key="p.id" class="org-panel org-card-hover flex flex-col gap-3 p-4 sm:flex-row sm:items-center" :class="p.status === 'inactive' ? 'opacity-70' : ''">
        <span class="block h-20 w-28 shrink-0 border border-tikeo-border"><PartnerLogo :partner="p" /></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <p class="truncate text-sm font-bold text-tikeo-black">{{ p.name }}</p>
            <StatusPill :tone="p.status === 'active' ? 'success' : 'neutral'">{{ p.status === 'active' ? t('adminPartners.active') : t('adminPartners.inactive') }}</StatusPill>
            <span v-if="p.is_featured" class="acc-tag bg-[#FF7A00]/15 text-tikeo-orange"><AppIcon name="star" class="mr-1 h-3 w-3" :stroke="2.4" />{{ t('partners.featuredBadge') }}</span>
          </div>
          <p class="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-tikeo-gray-text">
            <AppIcon :name="PARTNER_CATEGORY_ICONS[p.category]" class="h-3.5 w-3.5" />{{ t(`partners.categories.${p.category}`) }}
            <template v-if="safeExternalUrl(p.website_url)"> · <span class="truncate">{{ safeExternalUrl(p.website_url).replace(/^https?:\/\//i, '') }}</span></template>
          </p>
          <p v-if="p.description" class="mt-1 line-clamp-2 text-xs text-tikeo-gray-text">{{ p.description }}</p>
        </div>

        <div class="flex shrink-0 flex-wrap items-center gap-1.5">
          <template v-if="canReorder">
            <OrgIconButton icon="arrow-up" :label="t('adminPartners.moveUp')" :disabled="indexInAll(p) === 0" :loading="busyId === p.id" @click="move(p, -1)" />
            <OrgIconButton icon="arrow-down" :label="t('adminPartners.moveDown')" :disabled="indexInAll(p) === api.sorted.value.length - 1" :loading="busyId === p.id" @click="move(p, 1)" />
          </template>
          <a v-if="safeExternalUrl(p.website_url)" :href="safeExternalUrl(p.website_url)" target="_blank" rel="noopener noreferrer nofollow" class="org-icon-btn org-tip" :data-tip="t('adminPartners.openSite')" :aria-label="t('adminPartners.openSite')"><AppIcon name="external-link" class="h-[18px] w-[18px]" /></a>
          <OrgIconButton icon="star" :label="p.is_featured ? t('adminPartners.unfeature') : t('adminPartners.feature')" :class="p.is_featured ? '!border-[#FF7A00] !text-tikeo-orange' : ''" @click="toggleFeatured(p)" />
          <OrgIconButton :icon="p.status === 'active' ? 'pause' : 'play'" :label="p.status === 'active' ? t('adminPartners.deactivate') : t('adminPartners.activate')" @click="toggleStatus(p)" />
          <OrgIconButton icon="edit" :label="t('adminPartners.edit')" @click="openForm(p)" />
          <OrgIconButton icon="trash" danger :label="t('adminPartners.delete')" @click="remove(p)" />
        </div>
      </li>
    </ul>

    <!-- Fenêtre d'ajout / modification -->
    <AdminModal :open="!!draft" @close="draft = null">
      <template #header>
        <p class="flex items-center gap-2 font-display text-lg font-extrabold text-tikeo-black">
          <span class="flex h-9 w-9 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon :name="draft?.id ? 'edit' : 'plus'" class="h-5 w-5" /></span>
          {{ draft?.id ? t('adminPartners.editTitle') : t('adminPartners.newTitle') }}
        </p>
      </template>

      <form v-if="draft" id="partner-form" class="grid gap-4 sm:grid-cols-2" @submit.prevent="save">
        <p v-if="errorMsg" class="acc-alert-error sm:col-span-2">{{ errorMsg }}</p>

        <div class="sm:col-span-2">
          <MediaInput :model-value="draft.logo_url || ''" folder="partner-logos" compact :label="t('adminPartners.fieldLogo')" @update:model-value="draft!.logo_url = $event" />
          <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminPartners.logoHint') }}</p>
        </div>

        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text" for="p-name">{{ t('adminPartners.fieldName') }} *</label>
          <input id="p-name" v-model="draft.name" type="text" maxlength="80" required class="input-field w-full" />
        </div>

        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text" for="p-cat">{{ t('adminPartners.fieldCategory') }}</label>
          <select id="p-cat" v-model="draft.category" class="input-field w-full">
            <option v-for="c in PARTNER_CATEGORIES" :key="c" :value="c">{{ t(`partners.categories.${c}`) }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text" for="p-url">{{ t('adminPartners.fieldUrl') }}</label>
          <input id="p-url" v-model="draft.website_url" type="url" maxlength="300" class="input-field w-full" placeholder="https://" />
        </div>

        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text" for="p-desc">{{ t('adminPartners.fieldDescription') }}</label>
          <textarea id="p-desc" v-model="draft.description" rows="3" maxlength="300" class="input-field w-full" />
          <p class="mt-1 text-right text-[11px] text-tikeo-gray-text">{{ (draft.description || '').length }}/300</p>
        </div>

        <label class="flex items-center justify-between gap-3 border border-tikeo-border p-3">
          <span>
            <span class="flex items-center gap-1.5 text-sm font-bold text-tikeo-black"><AppIcon name="star" class="h-4 w-4 text-tikeo-orange" />{{ t('adminPartners.fieldFeatured') }}</span>
            <span class="mt-0.5 block text-[11px] text-tikeo-gray-text">{{ t('adminPartners.featuredHint') }}</span>
          </span>
          <ToggleSwitch :model-value="!!draft.is_featured" :aria-label="t('adminPartners.fieldFeatured')" @update:model-value="draft!.is_featured = $event" />
        </label>
        <label class="flex items-center justify-between gap-3 border border-tikeo-border p-3">
          <span>
            <span class="flex items-center gap-1.5 text-sm font-bold text-tikeo-black"><AppIcon name="eye" class="h-4 w-4 text-tikeo-orange" />{{ t('adminPartners.fieldVisible') }}</span>
            <span class="mt-0.5 block text-[11px] text-tikeo-gray-text">{{ t('adminPartners.visibleHint') }}</span>
          </span>
          <ToggleSwitch :model-value="draft.status === 'active'" :aria-label="t('adminPartners.fieldVisible')" @update:model-value="draft!.status = $event ? 'active' : 'inactive'" />
        </label>
      </form>

      <template #footer>
        <div class="flex flex-wrap justify-end gap-2">
          <button type="button" class="acc-btn-ghost !text-[13px]" @click="draft = null"><AppIcon name="close" class="h-[18px] w-[18px]" />{{ t('adminPartners.cancel') }}</button>
          <button type="submit" form="partner-form" class="btn-ink !h-10 !px-4 !text-[13px]" :disabled="saving || !draft?.name?.trim()"><AppIcon name="save" class="h-[18px] w-[18px]" />{{ saving ? t('adminPartners.saving') : t('adminPartners.save') }}</button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
