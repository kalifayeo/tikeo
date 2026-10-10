<script setup lang="ts">
/**
 * Administration des avis laissés par les visiteurs sur la plateforme
 * (page publique /avis) : cartes-filtres, liste, pop-up de détail avec
 * publication sur la page publique, archivage et réponse (email + réponse
 * visible sous l'avis publié).
 */
import type { SiteFeedback } from '~/types/database'

const emit = defineEmits<{ 'new-count': [number] }>()
const { t, locale } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const { askConfirm } = useAdminConfirm()
const toast = useToast()
const relative = useRelativeTime()
const canManage = computed(() => authStore.isSuperAdmin || authStore.hasPermission('moderation.manage'))

const loading = ref(true)
const items = ref<SiteFeedback[]>([])
const errorMessage = ref('')
type Tab = 'all' | 'new' | 'public' | 'archived'
const tab = ref<Tab>('all')
const category = ref('all')
const ratingFilter = ref(0)
const search = ref('')
const busyId = ref<string | null>(null)

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('site_feedback').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    items.value = (data as unknown as SiteFeedback[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('feedbackAdmin.loadError')
  } finally {
    loading.value = false
  }
}
onMounted(load)

const counts = computed(() => ({
  all: items.value.filter((f) => f.status !== 'archived').length,
  new: items.value.filter((f) => f.status === 'new').length,
  public: items.value.filter((f) => f.is_public && f.status !== 'archived').length,
  archived: items.value.filter((f) => f.status === 'archived').length,
}))
watch(() => counts.value.new, (n) => emit('new-count', n), { immediate: true })

const average = computed(() => {
  const live = items.value.filter((f) => f.status !== 'archived')
  return live.length ? (live.reduce((a, f) => a + f.rating, 0) / live.length).toFixed(1) : '—'
})

const tiles = computed(() => [
  { key: 'all' as Tab, label: t('feedbackAdmin.tileAll'), icon: 'inbox', n: counts.value.all, tone: 'bg-tikeo-ink text-white' },
  { key: 'new' as Tab, label: t('feedbackAdmin.tileNew'), icon: 'bell', n: counts.value.new, tone: 'bg-[#FF7A00] text-tikeo-ink' },
  { key: 'public' as Tab, label: t('feedbackAdmin.tilePublic'), icon: 'eye', n: counts.value.public, tone: 'bg-tikeo-success text-white' },
  { key: 'archived' as Tab, label: t('feedbackAdmin.tileArchived'), icon: 'clipboard', n: counts.value.archived, tone: 'bg-tikeo-gray-text text-white' },
])

const filtered = computed(() => {
  let list = items.value
  if (tab.value === 'all') list = list.filter((f) => f.status !== 'archived')
  else if (tab.value === 'new') list = list.filter((f) => f.status === 'new')
  else if (tab.value === 'public') list = list.filter((f) => f.is_public && f.status !== 'archived')
  else list = list.filter((f) => f.status === 'archived')
  if (category.value !== 'all') list = list.filter((f) => f.category === category.value)
  if (ratingFilter.value) list = list.filter((f) => f.rating === ratingFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) list = list.filter((f) => [f.display_name, f.email, f.message].some((v) => (v || '').toLowerCase().includes(term)))
  return list
})

const catLabel = (c: string) => t(`feedback.cat_${c}`)
const catTone = (c: string) => ({ praise: 'success', idea: 'info', bug: 'error', other: 'neutral' })[c] as 'success' | 'info' | 'error' | 'neutral'
const fullDate = (iso: string) => new Date(iso).toLocaleString(locale.value, { dateStyle: 'long', timeStyle: 'short' })

// ------------------------------------------------------------------
// Pop-up
// ------------------------------------------------------------------
const openId = ref<string | null>(null)
const current = computed(() => items.value.find((f) => f.id === openId.value) ?? null)
const idx = computed(() => filtered.value.findIndex((f) => f.id === openId.value))
const hasPrev = computed(() => idx.value > 0)
const hasNext = computed(() => idx.value >= 0 && idx.value < filtered.value.length - 1)
const replyText = ref('')
const sending = ref(false)

function open(f: SiteFeedback) {
  openId.value = f.id
  replyText.value = ''
  if (f.status === 'new' && canManage.value) patch(f, { status: 'read' }, true)
}
function go(d: number) {
  const n = filtered.value[idx.value + d]
  if (n) open(n)
}

async function patch(f: SiteFeedback, changes: Partial<SiteFeedback>, silent = false, okText = '') {
  busyId.value = f.id
  try {
    const { error } = await supabase.from('site_feedback').update(changes).eq('id', f.id)
    if (error) throw error
    Object.assign(f, changes)
    if (!silent && okText) toast.success(okText)
    return true
  } catch (e: any) {
    toast.error(e?.message || t('feedbackAdmin.updateError'))
    return false
  } finally {
    busyId.value = null
  }
}

async function togglePublic(f: SiteFeedback) {
  if (!f.allow_public && !f.is_public) return
  const next = !f.is_public
  const ok = await patch(f, { is_public: next, ...(next && f.status === 'archived' ? { status: 'read' as const } : {}) }, false, next ? t('feedbackAdmin.publishedToast') : t('feedbackAdmin.unpublishedToast'))
  if (ok) writeAuditLog({ action: next ? 'SITE_FEEDBACK_PUBLISHED' : 'SITE_FEEDBACK_UNPUBLISHED', entityType: 'site_feedback', entityId: f.id })
}

async function archive(f: SiteFeedback) {
  const next = filtered.value[idx.value + 1] ?? filtered.value[idx.value - 1] ?? null
  const ok = await patch(f, { status: 'archived', is_public: false }, false, t('feedbackAdmin.archivedToast'))
  if (ok && tab.value !== 'archived') (next ? open(next) : (openId.value = null))
}

async function remove(f: SiteFeedback) {
  if (!(await askConfirm({ title: t('feedbackAdmin.delete'), message: t('feedbackAdmin.confirmDelete'), confirmLabel: t('feedbackAdmin.delete') }))) return
  busyId.value = f.id
  try {
    const { error } = await supabase.from('site_feedback').delete().eq('id', f.id)
    if (error) throw error
    items.value = items.value.filter((x) => x.id !== f.id)
    openId.value = null
    toast.success(t('feedbackAdmin.deletedToast'))
    writeAuditLog({ action: 'SITE_FEEDBACK_DELETED', entityType: 'site_feedback', entityId: f.id })
  } catch (e: any) {
    toast.error(e?.message || t('feedbackAdmin.updateError'))
  } finally {
    busyId.value = null
  }
}

const templates = computed(() => [
  { label: t('feedbackAdmin.tplThanks'), text: t('feedbackAdmin.tplThanksText', { name: current.value?.display_name || '' }) },
  { label: t('feedbackAdmin.tplIdea'), text: t('feedbackAdmin.tplIdeaText', { name: current.value?.display_name || '' }) },
  { label: t('feedbackAdmin.tplBug'), text: t('feedbackAdmin.tplBugText', { name: current.value?.display_name || '' }) },
])

async function sendReply(f: SiteFeedback) {
  if (replyText.value.trim().length < 2) return
  sending.value = true
  try {
    const res = await sendAdminReply('feedback', f.id, replyText.value.trim())
    f.admin_reply = replyText.value.trim()
    f.replied_at = res.repliedAt
    if (f.status === 'new') f.status = 'read'
    replyText.value = ''
    toast.success(res.hasEmail ? (res.emailSent ? t('feedbackAdmin.replyEmailed') : t('feedbackAdmin.replySavedNoMail')) : t('feedbackAdmin.replySaved'))
    writeAuditLog({ action: 'SITE_FEEDBACK_REPLIED', entityType: 'site_feedback', entityId: f.id })
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || e?.message || t('feedbackAdmin.updateError'))
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div>
    <p class="mb-5 text-sm text-tikeo-gray-text">{{ t('feedbackAdmin.subtitle') }}</p>

    <!-- Cartes-filtres + moyenne -->
    <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
      <button
        v-for="c in tiles"
        :key="c.key"
        type="button"
        class="flex items-center gap-3 border bg-tikeo-surface p-3.5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
        :class="tab === c.key ? 'border-tikeo-ink dark:border-[#FF7A00]' : 'border-tikeo-border'"
        :aria-pressed="tab === c.key"
        @click="tab = c.key"
      >
        <span class="flex h-11 w-11 shrink-0 items-center justify-center" :class="c.tone"><AppIcon :name="c.icon" class="h-5 w-5" /></span>
        <span class="min-w-0">
          <span class="block font-display text-2xl font-extrabold leading-none tabular-nums text-tikeo-black">{{ c.n }}</span>
          <span class="mt-1 block truncate text-xs font-bold text-tikeo-gray-text">{{ c.label }}</span>
        </span>
      </button>
      <div class="col-span-2 flex items-center gap-3 border border-tikeo-border bg-tikeo-ink p-3.5 text-white lg:col-span-1">
        <span class="font-display text-3xl font-extrabold leading-none tabular-nums">{{ average }}</span>
        <span class="min-w-0"><StarRating :model-value="Math.round(Number(average) || 0)" readonly size="sm" /><span class="mt-1 block text-xs font-bold text-white/70">{{ t('feedbackAdmin.average') }}</span></span>
      </div>
    </div>

    <!-- Outils -->
    <div class="admin-toolbar !mb-4">
      <AdminSearch v-model="search" :placeholder="t('feedbackAdmin.searchPlaceholder')" />
      <select v-model="category" class="h-11 w-full border border-tikeo-border bg-tikeo-surface px-3 text-sm font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none sm:w-auto" :aria-label="t('feedbackAdmin.category')">
        <option value="all">{{ t('feedbackAdmin.allCategories') }}</option>
        <option v-for="c in ['praise', 'idea', 'bug', 'other']" :key="c" :value="c">{{ catLabel(c) }}</option>
      </select>
      <select v-model.number="ratingFilter" class="h-11 w-full border border-tikeo-border bg-tikeo-surface px-3 text-sm font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none sm:w-auto" :aria-label="t('feedbackAdmin.rating')">
        <option :value="0">{{ t('feedbackAdmin.allRatings') }}</option>
        <option v-for="n in [5, 4, 3, 2, 1]" :key="n" :value="n">{{ '★'.repeat(n) }}</option>
      </select>
      <button type="button" class="admin-chip !h-11 sm:ml-auto" :disabled="loading" :title="t('adminMessages.refresh')" @click="load">
        <AppIcon name="refresh" class="h-4 w-4" :class="loading ? 'animate-spin' : ''" :stroke="2.2" />
      </button>
    </div>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>
    <div v-if="loading && !items.length" class="space-y-2"><div v-for="i in 4" :key="i" class="h-20 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" /></div>
    <AdminEmpty v-else-if="!filtered.length" icon="star" :text="t('feedbackAdmin.empty')" />

    <ul v-else class="org-panel divide-y divide-tikeo-border">
      <li v-for="f in filtered" :key="f.id">
        <button type="button" class="group flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-tikeo-surface-alt md:gap-4 md:px-4" :class="f.status === 'new' ? 'bg-[#FF7A00]/[0.06]' : ''" @click="open(f)">
          <span class="relative flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink font-display text-lg font-extrabold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            {{ (f.display_name[0] || '?').toUpperCase() }}
            <span v-if="f.status === 'new'" class="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-tikeo-surface bg-[#FF7A00]" aria-hidden="true" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span class="truncate font-semibold text-tikeo-black">{{ f.display_name }}</span>
              <StarRating :model-value="f.rating" readonly size="sm" />
              <StatusPill :tone="catTone(f.category)">{{ catLabel(f.category) }}</StatusPill>
              <StatusPill v-if="f.is_public" tone="success">{{ t('feedbackAdmin.published') }}</StatusPill>
              <StatusPill v-if="f.status === 'archived'" tone="neutral">{{ t('adminMessages.statusArchived') }}</StatusPill>
              <span v-if="f.replied_at" class="inline-flex items-center gap-1 text-[11px] font-bold text-tikeo-success"><AppIcon name="reply" class="h-3.5 w-3.5" :stroke="2.4" />{{ t('adminMessages.answered') }}</span>
            </span>
            <span class="mt-0.5 block truncate text-sm text-tikeo-gray-text">{{ f.message }}</span>
          </span>
          <span class="flex shrink-0 flex-col items-end gap-1">
            <span class="text-xs font-semibold text-tikeo-gray-text">{{ relative(f.created_at) }}</span>
            <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text transition-transform group-hover:translate-x-1" :stroke="2.4" />
          </span>
        </button>
      </li>
    </ul>

    <AdminModal :open="!!current" :has-prev="hasPrev" :has-next="hasNext" @close="openId = null" @prev="go(-1)" @next="go(1)">
      <template v-if="current" #header>
        <div class="flex items-center gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center bg-tikeo-ink font-display text-xl font-extrabold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ (current.display_name[0] || '?').toUpperCase() }}</span>
          <div class="min-w-0">
            <p class="truncate font-display text-lg font-extrabold leading-tight text-tikeo-black">{{ current.display_name }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-2">
              <StarRating :model-value="current.rating" readonly size="sm" />
              <StatusPill :tone="catTone(current.category)">{{ catLabel(current.category) }}</StatusPill>
              <StatusPill v-if="current.is_public" tone="success">{{ t('feedbackAdmin.published') }}</StatusPill>
            </div>
          </div>
        </div>
      </template>

      <template v-if="current">
        <dl class="grid gap-3 border border-tikeo-border bg-tikeo-surface-alt p-3.5 text-sm sm:grid-cols-2">
          <div class="min-w-0">
            <dt class="text-xs font-bold text-tikeo-gray-text">{{ t('adminMessages.fieldEmail') }}</dt>
            <dd class="mt-0.5 truncate font-semibold text-tikeo-black">{{ current.email || t('feedbackAdmin.noEmail') }}</dd>
          </div>
          <div>
            <dt class="text-xs font-bold text-tikeo-gray-text">{{ t('adminMessages.fieldDate') }}</dt>
            <dd class="mt-0.5 font-semibold text-tikeo-black">{{ fullDate(current.created_at) }}</dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="text-xs font-bold text-tikeo-gray-text">{{ t('feedbackAdmin.consent') }}</dt>
            <dd class="mt-0.5 flex items-center gap-1.5 font-semibold" :class="current.allow_public ? 'text-tikeo-success' : 'text-tikeo-gray-text'">
              <AppIcon :name="current.allow_public ? 'check-circle' : 'lock'" class="h-4 w-4" :stroke="2.2" />
              {{ current.allow_public ? t('feedbackAdmin.consentYes') : t('feedbackAdmin.consentNo') }}
              <span v-if="current.user_id" class="ml-2 text-xs font-semibold text-tikeo-gray-text">· {{ t('feedbackAdmin.memberAccount') }}</span>
            </dd>
          </div>
        </dl>

        <div class="mt-4 border border-tikeo-border bg-tikeo-surface p-4 shadow-card">
          <p class="whitespace-pre-wrap text-sm leading-relaxed text-tikeo-black">{{ current.message }}</p>
        </div>

        <div v-if="current.admin_reply" class="mt-4 border-l-4 border-tikeo-success bg-tikeo-success/5 px-4 py-3">
          <p class="flex items-center gap-1.5 text-xs font-bold text-tikeo-success"><AppIcon name="check-circle" class="h-4 w-4" :stroke="2.4" />{{ t('adminMessages.yourReply') }}<span v-if="current.replied_at" class="font-semibold text-tikeo-gray-text">· {{ fullDate(current.replied_at) }}</span></p>
          <p class="mt-1.5 whitespace-pre-wrap text-sm text-tikeo-black">{{ current.admin_reply }}</p>
        </div>

        <div v-if="canManage" class="mt-5">
          <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-tikeo-gray-text">{{ current.admin_reply ? t('adminMessages.replyAgain') : t('adminMessages.replyTitle') }}</h3>
          <div class="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            <button v-for="tpl in templates" :key="tpl.label" type="button" class="h-8 shrink-0 border border-tikeo-border px-3 text-xs font-bold text-tikeo-black transition-all hover:-translate-y-0.5 hover:border-[#FF7A00] active:scale-95" @click="replyText = tpl.text">{{ tpl.label }}</button>
          </div>
          <textarea v-model="replyText" rows="4" maxlength="2000" class="input-field resize-y" :placeholder="t('feedbackAdmin.replyPlaceholder')" />
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ current.email ? t('feedbackAdmin.replyHelpEmail', { email: current.email }) : t('feedbackAdmin.replyHelpPublic') }}</p>
        </div>
      </template>

      <template v-if="current" #footer>
        <div v-if="canManage" class="flex flex-wrap items-center gap-2">
          <button type="button" class="btn-ink !h-10 !text-[13px] disabled:opacity-50" :disabled="sending || replyText.trim().length < 2" @click="sendReply(current)">
            <TikeoSpinner v-if="sending" :size="16" />
            <AppIcon v-else name="reply" class="h-4 w-4" :stroke="2.4" />
            {{ sending ? t('adminMessages.sending') : t('adminMessages.sendReply') }}
          </button>
          <button type="button" class="acc-btn-ghost !h-10 !text-[13px] disabled:opacity-50" :disabled="busyId === current.id || (!current.allow_public && !current.is_public)" :title="!current.allow_public && !current.is_public ? t('feedbackAdmin.consentNo') : ''" @click="togglePublic(current)">
            <AppIcon :name="current.is_public ? 'eye-off' : 'eye'" class="h-4 w-4" :stroke="2.2" />{{ current.is_public ? t('feedbackAdmin.unpublish') : t('feedbackAdmin.publish') }}
          </button>
          <span class="flex-1" />
          <button v-if="current.status !== 'archived'" type="button" class="acc-btn-ghost !h-10 !text-[13px]" :disabled="busyId === current.id" @click="archive(current)"><AppIcon name="inbox" class="h-4 w-4" :stroke="2.2" />{{ t('adminMessages.archive') }}</button>
          <button v-else type="button" class="acc-btn-ghost !h-10 !text-[13px]" :disabled="busyId === current.id" @click="patch(current, { status: 'read' }, false, t('adminMessages.restoredToast'))"><AppIcon name="refresh" class="h-4 w-4" :stroke="2.2" />{{ t('adminMessages.unarchive') }}</button>
          <button type="button" class="acc-btn-danger !h-10 !text-[13px]" :disabled="busyId === current.id" @click="remove(current)"><AppIcon name="trash" class="h-4 w-4" :stroke="2.2" />{{ t('feedbackAdmin.delete') }}</button>
        </div>
        <p v-else class="text-xs text-tikeo-gray-text">{{ t('feedbackAdmin.readOnly') }}</p>
      </template>
    </AdminModal>
  </div>
</template>
