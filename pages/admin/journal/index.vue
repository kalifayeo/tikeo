<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'audit.view' })

const { t } = useI18n()
const { rows, loading, error, filters, hasMore, nextPage, applyFilters, resetFilters } = useAuditLogs()

// Vocabulaire déjà en usage dans le code (voir server/api/**, composables/useEventEditRequests.ts,
// pages/admin/utilisateurs, useAdminRbac.ts) : traduit ici pour un affichage lisible ;
// une action non répertoriée s'affiche telle quelle plutôt que de disparaître.
const ACTION_LABELS: Record<string, string> = {
  ADMIN_USER_CREATED: t('auditLog.actions.ADMIN_USER_CREATED'),
  ADMIN_USER_DELETED: t('auditLog.actions.ADMIN_USER_DELETED'),
  USER_SUSPENDED: t('auditLog.actions.USER_SUSPENDED'),
  USER_REACTIVATED: t('auditLog.actions.USER_REACTIVATED'),
  USER_ROLE_CHANGED: t('auditLog.actions.USER_ROLE_CHANGED'),
  ADMIN_ROLE_ASSIGNED: t('auditLog.actions.ADMIN_ROLE_ASSIGNED'),
  ADMIN_ROLE_REMOVED: t('auditLog.actions.ADMIN_ROLE_REMOVED'),
  ADMIN_ROLE_CREATED: t('auditLog.actions.ADMIN_ROLE_CREATED'),
  ADMIN_PERMISSION_GRANTED: t('auditLog.actions.ADMIN_PERMISSION_GRANTED'),
  ADMIN_PERMISSION_REVOKED: t('auditLog.actions.ADMIN_PERMISSION_REVOKED'),
  ADMIN_SUSPENDED: t('auditLog.actions.ADMIN_SUSPENDED'),
  ADMIN_REACTIVATED: t('auditLog.actions.ADMIN_REACTIVATED'),
  ADMIN_MFA_ENABLED: t('auditLog.actions.ADMIN_MFA_ENABLED'),
  ADMIN_MFA_DISABLED: t('auditLog.actions.ADMIN_MFA_DISABLED'),
  EVENT_STATUS_CHANGED: t('auditLog.actions.EVENT_STATUS_CHANGED'),
  EVENT_EDIT_APPROVED: t('auditLog.actions.EVENT_EDIT_APPROVED'),
  EVENT_EDIT_REJECTED: t('auditLog.actions.EVENT_EDIT_REJECTED'),
  ORDER_PAYMENT_CONFIRMED: t('auditLog.actions.ORDER_PAYMENT_CONFIRMED'),
  CONTENT_CREATED: t('auditLog.actions.CONTENT_CREATED'),
  CONTENT_UPDATED: t('auditLog.actions.CONTENT_UPDATED'),
  CONTENT_DELETED: t('auditLog.actions.CONTENT_DELETED'),
}
const actionLabel = (a: string) => ACTION_LABELS[a] || a

const ENTITY_LABELS: Record<string, string> = {
  profiles: t('auditLog.entities.profiles'),
  events: t('auditLog.entities.events'),
  orders: t('auditLog.entities.orders'),
  admin_roles: t('auditLog.entities.admin_roles'),
  onboarding_slides: t('auditLog.entities.onboarding_slides'),
  tour_steps: t('auditLog.entities.tour_steps'),
  popups: t('auditLog.entities.popups'),
}
const entityLabel = (e: string) => ENTITY_LABELS[e] || e

// Icône/couleur par famille d'action, pour repérer vite les actions sensibles.
function severity(action: string): 'danger' | 'warning' | 'neutral' {
  if (['ADMIN_USER_DELETED', 'USER_SUSPENDED', 'ADMIN_SUSPENDED', 'ADMIN_MFA_DISABLED', 'CONTENT_DELETED', 'ADMIN_PERMISSION_REVOKED', 'ADMIN_ROLE_REMOVED'].includes(action)) return 'danger'
  if (['USER_ROLE_CHANGED', 'ADMIN_ROLE_ASSIGNED', 'ADMIN_PERMISSION_GRANTED', 'EVENT_STATUS_CHANGED'].includes(action)) return 'warning'
  return 'neutral'
}
const severityClass: Record<string, string> = {
  danger: 'bg-tikeo-error/10 text-tikeo-error',
  warning: 'bg-tikeo-orange/10 text-tikeo-orange',
  neutral: 'bg-tikeo-gray-text/10 text-tikeo-gray-text',
}

const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const expanded = ref<string | null>(null)
function toggle(id: string) {
  expanded.value = expanded.value === id ? null : id
}
function hasDetails(r: { metadata: Record<string, unknown> }) {
  return r.metadata && Object.keys(r.metadata).length > 0
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <h1 class="text-xl font-bold text-tikeo-black">{{ t('auditLog.title') }}</h1>
    <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('auditLog.subtitle') }}</p>

    <!-- Filtres -->
    <form class="mt-5 grid gap-3 border border-tikeo-border bg-tikeo-surface p-4 sm:grid-cols-4" @submit.prevent="applyFilters">
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('auditLog.filterAction') }}</label>
        <input v-model="filters.action" type="text" class="input-field w-full" :placeholder="t('auditLog.filterActionPlaceholder')" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('auditLog.filterFrom') }}</label>
        <input v-model="filters.dateFrom" type="date" class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('auditLog.filterTo') }}</label>
        <input v-model="filters.dateTo" type="date" class="input-field w-full" />
      </div>
      <div class="flex items-end gap-2">
        <button type="submit" class="btn-primary flex-1 !py-2 text-xs">{{ t('auditLog.filterApply') }}</button>
        <button type="button" class="btn-secondary !py-2 text-xs" @click="resetFilters">{{ t('auditLog.filterReset') }}</button>
      </div>
    </form>

    <p v-if="error" class="mt-4 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ error }}</p>

    <div v-if="loading && !rows.length" class="mt-4 space-y-2">
      <div v-for="i in 6" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <p v-else-if="!rows.length" class="mt-4 border border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">{{ t('auditLog.empty') }}</p>

    <ul v-else class="mt-4 divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
      <li v-for="r in rows" :key="r.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-tikeo-gray-light"
          :class="hasDetails(r) ? 'cursor-pointer' : 'cursor-default'"
          @click="hasDetails(r) && toggle(r.id)"
        >
          <span class="px-2 py-0.5 text-[10px] font-bold uppercase" :class="severityClass[severity(r.action)]">{{ actionLabel(r.action) }}</span>
          <span class="min-w-0 flex-1 truncate text-sm text-tikeo-black">
            <span class="font-semibold">{{ r.adminName || r.adminEmail || t('auditLog.system') }}</span>
            <span class="text-tikeo-gray-text"> — {{ entityLabel(r.entity_type) }}</span>
          </span>
          <span class="shrink-0 text-xs text-tikeo-gray-text">{{ fmtDate(r.created_at) }}</span>
          <svg v-if="hasDetails(r)" class="h-4 w-4 shrink-0 text-tikeo-gray-text transition-transform" :class="expanded === r.id ? 'rotate-180' : ''" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <div v-if="expanded === r.id" class="border-t border-tikeo-border bg-tikeo-gray-light px-4 py-3">
          <pre class="overflow-x-auto text-xs text-tikeo-gray-text">{{ JSON.stringify(r.metadata, null, 2) }}</pre>
        </div>
      </li>
    </ul>

    <button v-if="hasMore" type="button" class="btn-secondary mt-4 w-full !py-2 text-xs" :disabled="loading" @click="nextPage">
      {{ loading ? t('common.loading') : t('auditLog.loadMore') }}
    </button>
  </div>
</template>
