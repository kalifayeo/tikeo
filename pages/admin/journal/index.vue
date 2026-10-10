<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'audit.view' })

const { t, te, locale } = useI18n()
const { rows, loading, error, filters, hasMore, load, nextPage, applyFilters, resetFilters } = useAuditLogs()

// ------------------------------------------------------------
// Filtres : les champs date du navigateur donnent « AAAA-MM-JJ » ; on les
// convertit en bornes de journée complètes (sinon « jusqu'au 12 » excluait
// tout ce qui s'est passé le 12).
// ------------------------------------------------------------
const form = reactive({ action: '', entityType: '', from: '', to: '' })
const entityKeys = ['profiles', 'events', 'orders', 'admin_roles', 'onboarding_slides', 'tour_steps', 'popups']

function pushFilters() {
  filters.action = form.action || undefined
  filters.entityType = form.entityType || undefined
  filters.dateFrom = form.from ? new Date(`${form.from}T00:00:00`).toISOString() : undefined
  filters.dateTo = form.to ? new Date(`${form.to}T23:59:59.999`).toISOString() : undefined
}

async function submit() {
  pushFilters()
  await applyFilters()
}

async function clearAll() {
  Object.assign(form, { action: '', entityType: '', from: '', to: '' })
  await resetFilters()
}

const hasActiveFilters = computed(() => !!(form.action || form.entityType || form.from || form.to))

// Recherche au fil de la frappe (anti-rebond 350 ms) : la liste réagit sans bouton.
let debounce: ReturnType<typeof setTimeout> | null = null
watch(
  () => form.action,
  () => {
    if (debounce) clearTimeout(debounce)
    debounce = setTimeout(submit, 350)
  }
)
watch(() => [form.entityType, form.from, form.to], submit)

// Rafraîchissement automatique toutes les 30 s tant que l'onglet est visible.
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (document.visibilityState === 'visible' && !loading.value && rows.value.length <= 30) load(true)
  }, 30000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (debounce) clearTimeout(debounce)
})

// ------------------------------------------------------------
// Présentation
// ------------------------------------------------------------
function actionLabel(code: string) {
  const key = `auditLog.actions.${code}`
  if (te(key)) return t(key)
  // Code inconnu : « USER_DELETED » -> « User deleted »
  const words = code.toLowerCase().replace(/_/g, ' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

function entityLabel(type: string) {
  const key = `auditLog.entities.${type}`
  return te(key) ? t(key) : type
}

function actionIcon(code: string) {
  if (code.includes('MFA')) return 'shield-check'
  if (code.includes('PERMISSION') || code.includes('ROLE')) return 'key'
  if (code.includes('SUSPEND')) return 'ban'
  if (code.includes('REACTIVATED')) return 'user-check'
  if (code.includes('DELETE')) return 'trash'
  if (code.includes('CREATED')) return 'plus'
  if (code.includes('PAYMENT') || code.includes('ORDER')) return 'card'
  if (code.includes('EVENT')) return 'calendar'
  if (code.includes('USER')) return 'user'
  if (code.includes('CONTENT') || code.includes('UPDATED')) return 'edit'
  return 'activity'
}

function actionTone(code: string): 'success' | 'warning' | 'error' | 'info' | 'neutral' {
  if (code.includes('DELETE') || code.includes('SUSPEND') || code.includes('REJECT') || code.includes('DISABLED') || code.includes('CANCEL')) return 'error'
  if (code.includes('CREATED') || code.includes('APPROVED') || code.includes('REACTIVATED') || code.includes('ENABLED') || code.includes('CONFIRMED') || code.includes('PUBLISHED')) return 'success'
  if (code.includes('ROLE') || code.includes('PERMISSION') || code.includes('CHANGED') || code.includes('UPDATED')) return 'warning'
  return 'info'
}

function actorName(r: { adminName: string | null; adminEmail: string | null; user_id: string | null }) {
  if (!r.user_id) return t('auditLog.system')
  return r.adminName || r.adminEmail || r.user_id.slice(0, 8)
}

function initials(name: string) {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase() || '·'
}

const bcp47 = computed(() => (locale.value === 'en' ? 'en-GB' : locale.value === 'es' ? 'es-ES' : locale.value === 'pt' ? 'pt-PT' : 'fr-FR'))

function formatDate(d: string) {
  return new Date(d).toLocaleString(bcp47.value, { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function relative(d: string) {
  const diff = Math.round((new Date(d).getTime() - Date.now()) / 1000)
  const abs = Math.abs(diff)
  const rtf = new Intl.RelativeTimeFormat(bcp47.value, { numeric: 'auto' })
  if (abs < 60) return rtf.format(diff, 'second')
  if (abs < 3600) return rtf.format(Math.round(diff / 60), 'minute')
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), 'hour')
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), 'day')
  return formatDate(d)
}

// Détails dépliables (métadonnées + IP)
const openId = ref<string | null>(null)
function toggle(id: string) {
  openId.value = openId.value === id ? null : id
}
function metaEntries(meta: Record<string, unknown> | null) {
  return Object.entries(meta ?? {}).map(([k, v]) => [k, typeof v === 'object' ? JSON.stringify(v) : String(v)] as const)
}

const stats = computed(() => ({
  loaded: rows.value.length,
  today: rows.value.filter((r) => new Date(r.created_at).toDateString() === new Date().toDateString()).length,
  actors: new Set(rows.value.map((r) => r.user_id).filter(Boolean)).size,
}))
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('auditLog.title') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('auditLog.subtitle') }}</p>

    <!-- Chiffres clés -->
    <div class="mb-5 grid grid-cols-3 gap-3">
      <div v-for="(item, i) in [
        { icon: 'list', label: t('auditLog.statLoaded'), value: stats.loaded },
        { icon: 'clock', label: t('auditLog.statToday'), value: stats.today },
        { icon: 'users', label: t('auditLog.statActors'), value: stats.actors },
      ]" :key="i" class="org-panel flex items-center gap-3 p-3 sm:p-4">
        <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink"><AppIcon :name="item.icon" class="h-5 w-5" /></span>
        <div class="min-w-0">
          <p class="font-display text-xl font-extrabold leading-none text-tikeo-black">{{ item.value }}</p>
          <p class="mt-1 truncate text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">{{ item.label }}</p>
        </div>
      </div>
    </div>

    <!-- Filtres -->
    <form class="org-panel mb-5 grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" @submit.prevent="submit">
      <div class="admin-search sm:col-span-2 lg:col-span-1">
        <AppIcon name="search" />
        <input v-model="form.action" type="search" :placeholder="t('auditLog.filterActionPlaceholder')" :aria-label="t('auditLog.filterAction')" />
      </div>
      <select v-model="form.entityType" class="h-11 border border-tikeo-border bg-tikeo-surface px-3 text-sm text-tikeo-black focus:border-[#FF7A00] focus:outline-none" :aria-label="t('auditLog.entity')">
        <option value="">{{ t('auditLog.allEntities') }}</option>
        <option v-for="k in entityKeys" :key="k" :value="k">{{ entityLabel(k) }}</option>
      </select>
      <input v-model="form.from" type="date" class="h-11 border border-tikeo-border bg-tikeo-surface px-3 text-sm text-tikeo-black focus:border-[#FF7A00] focus:outline-none" :aria-label="t('auditLog.filterFrom')" :title="t('auditLog.filterFrom')" />
      <input v-model="form.to" type="date" class="h-11 border border-tikeo-border bg-tikeo-surface px-3 text-sm text-tikeo-black focus:border-[#FF7A00] focus:outline-none" :aria-label="t('auditLog.filterTo')" :title="t('auditLog.filterTo')" />
      <div class="flex gap-2 sm:col-span-2 lg:col-span-1">
        <OrgIconButton icon="refresh" :label="t('auditLog.refresh')" :loading="loading" class="!h-11 !w-11" @click="load(true)" />
        <OrgIconButton v-if="hasActiveFilters" icon="close" :label="t('auditLog.filterReset')" class="!h-11 !w-11" @click="clearAll" />
      </div>
    </form>

    <!-- Erreur (n'était jamais affichée avant : la page paraissait « morte ») -->
    <div v-if="error" class="acc-alert-error mb-4 flex flex-wrap items-center justify-between gap-3">
      <span>{{ error }}</span>
      <button type="button" class="acc-btn-ghost !h-9 !text-xs" @click="load(true)"><AppIcon name="refresh" class="h-4 w-4" />{{ t('auditLog.retry') }}</button>
    </div>

    <div v-if="loading && rows.length === 0" class="space-y-2">
      <div v-for="i in 6" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <AdminEmpty v-else-if="rows.length === 0 && !error" icon="activity" :text="hasActiveFilters ? t('adminCommon.noResults') : t('auditLog.empty')" />

    <div v-else-if="rows.length" class="relative" :class="loading ? 'opacity-60 transition-opacity' : ''">
      <!-- Cartes (mobile) -->
      <ul class="flex flex-col gap-2 md:hidden">
        <li v-for="r in rows" :key="r.id" class="org-panel">
          <button type="button" class="flex w-full items-start gap-3 p-3 text-left" :aria-expanded="openId === r.id" @click="toggle(r.id)">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center" :class="`pill-${actionTone(r.action)}`"><AppIcon :name="actionIcon(r.action)" class="h-5 w-5" /></span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-sm font-bold text-tikeo-black">{{ actionLabel(r.action) }}</span>
              <span class="block truncate text-xs text-tikeo-gray-text">{{ actorName(r) }} · {{ entityLabel(r.entity_type) }}</span>
              <span class="block text-[11px] text-tikeo-gray-text">{{ relative(r.created_at) }}</span>
            </span>
            <AppIcon name="chevron-down" class="mt-1 h-4 w-4 shrink-0 text-tikeo-gray-text transition-transform" :class="openId === r.id ? 'rotate-180' : ''" />
          </button>
          <dl v-if="openId === r.id" class="border-t border-tikeo-border bg-tikeo-surface-alt px-3 py-3 text-xs">
            <div class="flex gap-2 py-0.5"><dt class="w-24 shrink-0 font-bold text-tikeo-gray-text">{{ t('auditLog.date') }}</dt><dd class="text-tikeo-black">{{ formatDate(r.created_at) }}</dd></div>
            <div v-if="r.entity_id" class="flex gap-2 py-0.5"><dt class="w-24 shrink-0 font-bold text-tikeo-gray-text">ID</dt><dd class="break-all font-mono text-tikeo-black">{{ r.entity_id }}</dd></div>
            <div v-if="r.ip_address" class="flex gap-2 py-0.5"><dt class="w-24 shrink-0 font-bold text-tikeo-gray-text">IP</dt><dd class="font-mono text-tikeo-black">{{ r.ip_address }}</dd></div>
            <div v-for="[k, v] in metaEntries(r.metadata)" :key="k" class="flex gap-2 py-0.5"><dt class="w-24 shrink-0 font-bold text-tikeo-gray-text">{{ k }}</dt><dd class="break-all text-tikeo-black">{{ v }}</dd></div>
          </dl>
        </li>
      </ul>

      <!-- Tableau (md et plus) -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-3">{{ t('auditLog.date') }}</th>
              <th class="px-3 py-3">{{ t('auditLog.user') }}</th>
              <th class="px-3 py-3">{{ t('auditLog.action') }}</th>
              <th class="px-3 py-3">{{ t('auditLog.entity') }}</th>
              <th class="w-12 px-3 py-3"><span class="sr-only">{{ t('auditLog.details') }}</span></th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <template v-for="r in rows" :key="r.id">
              <tr class="cursor-pointer" @click="toggle(r.id)">
                <td class="whitespace-nowrap px-3 py-3 text-tikeo-gray-text" :title="formatDate(r.created_at)">{{ relative(r.created_at) }}</td>
                <td class="px-3 py-3">
                  <span class="flex items-center gap-2">
                    <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-tikeo-ink text-[11px] font-bold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ r.user_id ? initials(actorName(r)) : 'SY' }}</span>
                    <span class="min-w-0"><span class="block truncate font-semibold text-tikeo-black">{{ actorName(r) }}</span><span v-if="r.adminEmail && r.adminName" class="block truncate text-xs text-tikeo-gray-text">{{ r.adminEmail }}</span></span>
                  </span>
                </td>
                <td class="px-3 py-3">
                  <StatusPill :tone="actionTone(r.action)"><AppIcon :name="actionIcon(r.action)" class="h-3.5 w-3.5" />{{ actionLabel(r.action) }}</StatusPill>
                </td>
                <td class="px-3 py-3 text-tikeo-gray-text">{{ entityLabel(r.entity_type) }}<span v-if="r.entity_id" class="ml-1 font-mono text-xs">· {{ String(r.entity_id).slice(0, 8) }}</span></td>
                <td class="px-3 py-3 text-right"><AppIcon name="chevron-down" class="inline h-4 w-4 text-tikeo-gray-text transition-transform duration-200" :class="openId === r.id ? 'rotate-180' : ''" /></td>
              </tr>
              <tr v-if="openId === r.id" class="!bg-tikeo-surface-alt">
                <td colspan="5" class="px-4 py-3">
                  <dl class="grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                    <div class="flex gap-2"><dt class="w-20 shrink-0 font-bold text-tikeo-gray-text">{{ t('auditLog.date') }}</dt><dd class="text-tikeo-black">{{ formatDate(r.created_at) }}</dd></div>
                    <div v-if="r.entity_id" class="flex gap-2"><dt class="w-20 shrink-0 font-bold text-tikeo-gray-text">ID</dt><dd class="break-all font-mono text-tikeo-black">{{ r.entity_id }}</dd></div>
                    <div v-if="r.ip_address" class="flex gap-2"><dt class="w-20 shrink-0 font-bold text-tikeo-gray-text">IP</dt><dd class="font-mono text-tikeo-black">{{ r.ip_address }}</dd></div>
                    <div v-for="[k, v] in metaEntries(r.metadata)" :key="k" class="flex gap-2"><dt class="w-20 shrink-0 font-bold text-tikeo-gray-text">{{ k }}</dt><dd class="break-all text-tikeo-black">{{ v }}</dd></div>
                    <p v-if="!r.entity_id && !r.ip_address && metaEntries(r.metadata).length === 0" class="text-tikeo-gray-text">{{ t('auditLog.noDetails') }}</p>
                  </dl>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>

      <div v-if="hasMore" class="mt-5 flex justify-center">
        <button type="button" class="acc-btn-ghost" :disabled="loading" @click="nextPage">
          <AppIcon name="arrow-down" class="h-4 w-4" />{{ t('auditLog.loadMore') }}
        </button>
      </div>
    </div>
  </div>
</template>
