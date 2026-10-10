<script setup lang="ts">
const { askConfirm } = useAdminConfirm()
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'moderation.manage' })

const { t } = useI18n()
const supabase = useSupabase()
const { setStatus } = useAdminReviewModeration()

const tab = ref<'events' | 'site'>('site')
const siteNew = ref(0)
onMounted(async () => {
  const { count } = await supabase.from('site_feedback').select('id', { count: 'exact', head: true }).eq('status', 'new')
  siteNew.value = count || 0
})

const reviews = ref<any[]>([])
const loading = ref(true)
const filter = ref<'all' | 'reported'>('all')

async function fetchReviews() {
  loading.value = true
  try {
    let query = supabase
      .from('event_reviews')
      .select('*, author:profiles(full_name), event:events(title, slug), reports:event_review_reports(id, reason)')
      .order('created_at', { ascending: false })
      .limit(100)
    const { data } = await query
    reviews.value = filter.value === 'reported' ? ((data as any[]) ?? []).filter((r) => r.reports?.length) : ((data as any[]) ?? [])
  } finally {
    loading.value = false
  }
}

watch(filter, fetchReviews, { immediate: true })

async function toggleHide(review: any) {
  const nextStatus = review.status === 'visible' ? 'hidden' : 'visible'
  if (nextStatus === 'hidden' && !(await askConfirm({ title: t('reviewsModeration.hide'), message: t('reviewsModeration.confirmHide'), confirmLabel: t('reviewsModeration.hide') }))) return
  const ok = await setStatus(review.id, nextStatus)
  if (ok) {
    review.status = nextStatus
    await writeAuditLog({ action: nextStatus === 'hidden' ? 'REVIEW_HIDDEN' : 'REVIEW_RESTORED', entityType: 'event_reviews', entityId: review.id })
  }
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <h1 class="mb-4 text-xl font-bold text-tikeo-black">{{ t('reviewsModeration.title') }}</h1>

    <!-- Deux sources d'avis : visiteurs (sur Tikeo) et acheteurs (sur un événement) -->
    <div class="mb-6 flex flex-wrap gap-2 border-b border-tikeo-border pb-4" role="tablist">
      <button type="button" role="tab" :aria-selected="tab === 'site'" class="admin-chip !h-10 !px-4 !text-[13px]" :class="tab === 'site' ? 'is-active' : ''" @click="tab = 'site'">
        <AppIcon name="star" class="h-4 w-4" />{{ t('feedbackAdmin.tabSite') }}
        <span v-if="siteNew" class="flex h-5 min-w-5 items-center justify-center bg-[#FF7A00] px-1.5 text-[11px] font-bold text-tikeo-ink">{{ siteNew }}</span>
      </button>
      <button type="button" role="tab" :aria-selected="tab === 'events'" class="admin-chip !h-10 !px-4 !text-[13px]" :class="tab === 'events' ? 'is-active' : ''" @click="tab = 'events'">
        <AppIcon name="ticket" class="h-4 w-4" />{{ t('feedbackAdmin.tabEvents') }}
      </button>
    </div>

    <AdminSiteFeedback v-if="tab === 'site'" @new-count="(n: number) => (siteNew = n)" />

    <template v-else>
    <div class="mb-6 flex items-center justify-between">
      <div>
        <p class="text-sm text-tikeo-gray-text">{{ t('reviewsModeration.subtitle') }}</p>
      </div>
      <div class="flex gap-2">
        <button type="button" class="admin-chip" :class="filter === 'all' ? 'is-active' : ''" @click="filter = 'all'"><AppIcon name="list" class="h-4 w-4" />{{ t('adminCommon.all') }}</button>
        <button type="button" class="admin-chip" :class="filter === 'reported' ? 'is-active' : ''" @click="filter = 'reported'"><AppIcon name="flag" class="h-4 w-4" />{{ t('reviewsModeration.filterReported') }}</button>
      </div>
    </div>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 3" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <AdminEmpty v-else-if="reviews.length === 0" icon="star" :text="t('reviewsModeration.empty')" />

    <div v-else class="space-y-3">
      <div v-for="r in reviews" :key="r.id" class="org-panel p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-sm font-semibold text-tikeo-black">{{ r.author?.full_name }} — {{ r.event?.title }}</p>
            <p class="mt-0.5 flex gap-0.5 text-tikeo-orange" :aria-label="`${r.rating}/5`"><AppIcon v-for="n in 5" :key="n" name="star" class="h-4 w-4" :class="n <= r.rating ? 'fill-current' : 'opacity-30'" /></p>
            <p v-if="r.comment" class="mt-1 text-sm text-tikeo-gray-text">{{ r.comment }}</p>
            <p v-if="r.reports?.length" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-tikeo-error"><AppIcon name="flag" class="h-3.5 w-3.5" />{{ t('reviewsModeration.reportsCount', { n: r.reports.length }) }}</p>
          </div>
          <div class="flex shrink-0 flex-col items-end gap-2">
            <StatusPill v-if="r.status === 'hidden'" tone="neutral">{{ t('reviewsModeration.hiddenBadge') }}</StatusPill>
            <OrgIconButton :icon="r.status === 'visible' ? 'eye-off' : 'eye'" :danger="r.status === 'visible'" :label="r.status === 'visible' ? t('reviewsModeration.hide') : t('reviewsModeration.show')" @click="toggleHide(r)" />
          </div>
        </div>
      </div>
    </div>
    </template>
  </div>
</template>
