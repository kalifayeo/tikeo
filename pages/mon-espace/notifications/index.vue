<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { notifications, loading, errorMessage, unreadCount, markAsRead, markAllAsRead } = useMyNotifications()

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('header.notifications') }}</h1>
      <button v-if="unreadCount > 0" type="button" class="text-xs font-semibold text-tikeo-orange" @click="markAllAsRead">
        {{ t('buyerNotifications.markAllRead') }}
      </button>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <p v-else-if="notifications.length === 0" class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">
      {{ t('buyerNotifications.empty') }}
    </p>

    <ul v-else class="divide-y divide-tikeo-border border border-tikeo-border">
      <li
        v-for="n in notifications"
        :key="n.id"
        class="flex cursor-pointer items-start gap-3 px-4 py-3 transition"
        :class="n.read_at ? '' : 'bg-tikeo-orange/5'"
        @click="markAsRead(n.id)"
      >
        <span class="mt-1.5 h-2 w-2 shrink-0 rounded-full" :class="n.read_at ? 'bg-transparent' : 'bg-tikeo-orange'" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-tikeo-black">{{ n.title }}</p>
          <p class="text-sm text-tikeo-gray-text">{{ n.message }}</p>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ formatDate(n.created_at) }}</p>
        </div>
      </li>
    </ul>
  </div>
</template>
