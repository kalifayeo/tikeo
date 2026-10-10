<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { notifications, loading, errorMessage, unreadCount, markAsRead, markAllAsRead, deleteNotification, deleteAllNotifications } = useMyNotifications()

// Suppression : une notification ou toutes, avec confirmation.
const pendingDelete = ref<{ type: 'one'; id: string } | { type: 'all' } | null>(null)
const deleting = ref(false)
const deleteError = ref('')

function askDelete(id: string) {
  deleteError.value = ''
  pendingDelete.value = { type: 'one', id }
}
function askDeleteAll() {
  deleteError.value = ''
  pendingDelete.value = { type: 'all' }
}
async function confirmDelete() {
  if (!pendingDelete.value) return
  deleting.value = true
  const ok = pendingDelete.value.type === 'one' ? await deleteNotification(pendingDelete.value.id) : await deleteAllNotifications()
  deleting.value = false
  if (ok) pendingDelete.value = null
  else deleteError.value = t('buyerDelete.error')
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <AccountShell
    :title="t('header.notifications')"
    :subtitle="unreadCount > 0 ? t('account.unread', { n: unreadCount }) : t('account.subtitleNotifications')"
    width="wide"
  >
    <template v-if="unreadCount > 0 || notifications.length > 0" #actions>
      <button
        v-if="unreadCount > 0"
        type="button"
        class="flex h-10 items-center gap-2 border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:bg-white hover:text-tikeo-ink"
        @click="markAllAsRead"
      >
        <AppIcon name="check" class="h-4 w-4" :stroke="2.6" />
        {{ t('buyerNotifications.markAllRead') }}
      </button>
      <button
        v-if="notifications.length > 0"
        type="button"
        class="flex h-10 items-center gap-2 border border-white/25 px-4 text-sm font-semibold text-white transition-colors hover:border-tikeo-error hover:bg-tikeo-error"
        @click="askDeleteAll"
      >
        <TrashIcon />
        {{ t('buyerDelete.deleteAll') }}
      </button>
    </template>

    <p v-if="errorMessage" class="acc-alert-error mb-5">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse bg-tikeo-border" />
    </div>

    <div v-else-if="notifications.length === 0" class="acc-empty">
      <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="bell" class="h-7 w-7" />
      </span>
      <p class="text-sm text-tikeo-gray-text">{{ t('buyerNotifications.empty') }}</p>
    </div>

    <ul v-else class="space-y-3">
      <li v-for="n in notifications" :key="n.id">
        <article
          class="flex cursor-pointer bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover"
          @click="markAsRead(n.id)"
        >
          <span class="w-1.5 shrink-0" :class="n.read_at ? 'bg-tikeo-border' : 'bg-[#FF7A00]'" aria-hidden="true" />
          <div class="flex min-w-0 flex-1 items-start gap-3 p-4">
            <span
              class="flex h-10 w-10 shrink-0 items-center justify-center"
              :class="n.read_at ? 'bg-tikeo-surface-alt text-tikeo-gray-text' : 'bg-[#FF7A00] text-tikeo-ink'"
            >
              <AppIcon name="bell" class="h-5 w-5" />
            </span>
            <div class="min-w-0 flex-1">
              <p class="text-sm text-tikeo-black" :class="n.read_at ? 'font-semibold' : 'font-bold'">{{ n.title }}</p>
              <p class="mt-0.5 text-sm leading-relaxed text-tikeo-gray-text">{{ n.message }}</p>
              <p class="acc-label mt-2 !text-[10px]">{{ formatDate(n.created_at) }}</p>
            </div>
            <button
              type="button"
              class="-mr-1 flex h-9 w-9 shrink-0 items-center justify-center text-tikeo-gray-text transition-colors hover:text-tikeo-error"
              :aria-label="t('buyerDelete.notifAria')"
              :title="t('buyerDelete.delete')"
              @click.stop="askDelete(n.id)"
            >
              <TrashIcon />
            </button>
          </div>
        </article>
      </li>
    </ul>

    <ConfirmDeleteModal
      :open="!!pendingDelete"
      :title="pendingDelete?.type === 'all' ? t('buyerDelete.notifAllTitle') : t('buyerDelete.notifTitle')"
      :message="pendingDelete?.type === 'all' ? t('buyerDelete.notifAllBody') : t('buyerDelete.notifBody')"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="pendingDelete = null"
    />
  </AccountShell>
</template>
