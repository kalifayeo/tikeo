<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { entries, loading, leave } = useMyWaitlistEntries()

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

async function handleLeave(id: string) {
  if (confirm(t('waitlistPage.leaveConfirm'))) await leave(id)
}
</script>

<template>
  <AccountShell :title="t('waitlistPage.title')" :subtitle="t('account.subtitleWaitlist')" width="wide">
    <div v-if="loading" class="space-y-4">
      <div v-for="i in 2" :key="i" class="h-24 animate-pulse bg-tikeo-border" />
    </div>

    <div v-else-if="entries.length === 0" class="acc-empty">
      <span class="flex h-14 w-14 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
        <AppIcon name="clock" class="h-7 w-7" />
      </span>
      <p class="font-display text-lg font-bold text-tikeo-black">{{ t('waitlistPage.empty') }}</p>
      <p class="max-w-sm text-sm text-tikeo-gray-text">{{ t('waitlistPage.emptyHint') }}</p>
      <NuxtLink to="/evenements" class="btn-ink mt-1">{{ t('common.browseEvents') }}</NuxtLink>
    </div>

    <ul v-else class="space-y-4">
      <li v-for="entry in entries" :key="entry.id">
        <article class="flex bg-tikeo-surface shadow-card transition-shadow duration-300 hover:shadow-card-hover">
          <span class="w-1.5 shrink-0" :class="entry.status === 'notified' ? 'bg-[#FF7A00]' : 'bg-tikeo-border'" aria-hidden="true" />
          <div class="flex min-w-0 flex-1 items-center justify-between gap-3 p-4 md:p-5">
            <div class="min-w-0">
              <p class="truncate font-display text-lg font-bold leading-tight tracking-tight text-tikeo-black md:text-xl">{{ entry.event?.title }}</p>
              <p class="mt-1 flex items-center gap-1.5 text-sm text-tikeo-gray-text">
                <AppIcon name="ticket" class="h-4 w-4 shrink-0" />
                {{ entry.ticket_type?.name }} · {{ entry.quantity }}
              </p>
              <p v-if="entry.status === 'notified' && entry.hold_expires_at" class="acc-tag mt-2.5 !normal-case bg-[#FF7A00] text-tikeo-ink">
                {{ t('waitlistPage.notifiedBanner', { date: formatDate(entry.hold_expires_at) }) }}
              </p>
            </div>
            <button type="button" class="acc-btn-danger !h-9 !px-3 !text-xs shrink-0" @click="handleLeave(entry.id)">
              {{ t('waitlistPage.leave') }}
            </button>
          </div>
        </article>
      </li>
    </ul>
  </AccountShell>
</template>
