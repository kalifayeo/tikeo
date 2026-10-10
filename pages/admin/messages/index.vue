<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'support.view' })
import type { ContactMessage } from '~/types/database'

const { t, locale } = useI18n()
const { askConfirm } = useAdminConfirm()
const supabase = useSupabase()
const authStore = useAuthStore()
const toast = useToast()
const relative = useRelativeTime()
const canManage = computed(() => authStore.isSuperAdmin || authStore.hasPermission('support.manage'))
// Suppression réelle d'un compte (server/api/admin/users/[userId]/delete.post.ts) :
// permission distincte de « traiter les messages ».
const canDeleteAccount = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.delete'))

const loading = ref(true)
const messages = ref<ContactMessage[]>([])
const errorMessage = ref('')
const search = ref('')
type Tab = 'all' | 'new' | 'deletion' | 'archived'
const tab = ref<Tab>('all')
const typeFilter = ref<'all' | 'contact' | 'account_deletion'>('all')
const sort = ref<'recent' | 'old'>('recent')
const updatingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const markingAll = ref(false)
// Comptes supprimés pendant cette session (le message est juste archivé en base).
const deletedAccountIds = ref<Set<string>>(new Set())

const statusLabels = computed<Record<ContactMessage['status'], string>>(() => ({
  new: t('adminMessages.statusNew'),
  read: t('adminMessages.statusRead'),
  archived: t('adminMessages.statusArchived'),
}))
const statusTone: Record<ContactMessage['status'], 'warning' | 'info' | 'neutral'> = { new: 'warning', read: 'info', archived: 'neutral' }

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) throw error
    messages.value = (data as unknown as ContactMessage[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminMessages.loadError')
  } finally {
    loading.value = false
  }
}

// ------------------------------------------------------------------
// Compteurs (cartes cliquables) + liste filtrée / triée / groupée par jour
// ------------------------------------------------------------------
const isDeletion = (m: ContactMessage) => m.request_type === 'account_deletion'
const counts = computed(() => ({
  all: messages.value.filter((m) => m.status !== 'archived').length,
  new: messages.value.filter((m) => m.status === 'new').length,
  deletion: messages.value.filter((m) => isDeletion(m) && m.status !== 'archived').length,
  archived: messages.value.filter((m) => m.status === 'archived').length,
}))
const tiles = computed(() => [
  { key: 'all' as Tab, label: t('adminMessages.tileAll'), icon: 'inbox', n: counts.value.all, tone: 'bg-tikeo-ink text-white' },
  { key: 'new' as Tab, label: t('adminMessages.tileNew'), icon: 'mail', n: counts.value.new, tone: 'bg-[#FF7A00] text-tikeo-ink' },
  { key: 'deletion' as Tab, label: t('adminMessages.tileDeletion'), icon: 'user-x', n: counts.value.deletion, tone: 'bg-tikeo-error text-white' },
  { key: 'archived' as Tab, label: t('adminMessages.tileArchived'), icon: 'clipboard', n: counts.value.archived, tone: 'bg-tikeo-gray-text text-white' },
])

const filtered = computed(() => {
  let list = messages.value
  if (tab.value === 'all') list = list.filter((m) => m.status !== 'archived')
  else if (tab.value === 'new') list = list.filter((m) => m.status === 'new')
  else if (tab.value === 'deletion') list = list.filter((m) => isDeletion(m) && m.status !== 'archived')
  else list = list.filter((m) => m.status === 'archived')
  if (typeFilter.value !== 'all') list = list.filter((m) => m.request_type === typeFilter.value)
  const term = search.value.trim().toLowerCase()
  if (term) list = list.filter((m) => [m.full_name, m.email, m.subject, m.message].some((v) => (v || '').toLowerCase().includes(term)))
  return sort.value === 'recent' ? list : [...list].reverse()
})

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(today) - start(d)) / 86400000)
  if (diff <= 0) return t('adminMessages.today')
  if (diff === 1) return t('adminMessages.yesterday')
  if (diff < 7) return t('adminMessages.thisWeek')
  return d.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
}
const groups = computed(() => {
  const out: Array<{ label: string; items: ContactMessage[] }> = []
  for (const m of filtered.value) {
    const label = dayLabel(m.created_at)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(m)
    else out.push({ label, items: [m] })
  }
  return out
})

const preview = (m: ContactMessage) => m.message.replace(/\s+/g, ' ').slice(0, 110)
const initial = (m: ContactMessage) => (m.full_name.trim()[0] || '?').toUpperCase()
const fullDate = (iso: string) => new Date(iso).toLocaleString(locale.value, { dateStyle: 'long', timeStyle: 'short' })

// ------------------------------------------------------------------
// Pop-up de détail
// ------------------------------------------------------------------
const openId = ref<string | null>(null)
const current = computed(() => filtered.value.find((m) => m.id === openId.value) ?? messages.value.find((m) => m.id === openId.value) ?? null)
const idx = computed(() => filtered.value.findIndex((m) => m.id === openId.value))
const hasPrev = computed(() => idx.value > 0)
const hasNext = computed(() => idx.value >= 0 && idx.value < filtered.value.length - 1)
const replyText = ref('')
const sending = ref(false)
const copied = ref(false)

function openMessage(m: ContactMessage) {
  openId.value = m.id
  replyText.value = ''
  if (m.status === 'new' && canManage.value) updateStatus(m, 'read', true)
}
function go(delta: number) {
  const next = filtered.value[idx.value + delta]
  if (next) openMessage(next)
}
function closeModal() {
  openId.value = null
}

async function updateStatus(m: ContactMessage, status: ContactMessage['status'], silent = false) {
  updatingId.value = m.id
  try {
    const { error } = await supabase.from('contact_messages').update({ status }).eq('id', m.id)
    if (error) throw error
    m.status = status
    if (!silent) toast.success(status === 'archived' ? t('adminMessages.archivedToast') : status === 'new' ? t('adminMessages.markedUnread') : t('adminMessages.restoredToast'))
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminMessages.updateError')
    toast.error(t('adminMessages.updateError'))
  } finally {
    updatingId.value = null
  }
}

async function archiveAndNext(m: ContactMessage) {
  // Le message suivant (ou précédent) est repéré AVANT l'archivage : une fois
  // archivé, il disparaît de la liste courante.
  const next = filtered.value[idx.value + 1] ?? filtered.value[idx.value - 1] ?? null
  await updateStatus(m, 'archived')
  if (tab.value === 'archived') return
  if (next) openMessage(next)
  else closeModal()
}

async function markUnread(m: ContactMessage) {
  await updateStatus(m, 'new')
  closeModal()
}

async function markAllRead() {
  if (!counts.value.new) return
  markingAll.value = true
  try {
    const { error } = await supabase.from('contact_messages').update({ status: 'read' }).eq('status', 'new')
    if (error) throw error
    messages.value.forEach((m) => m.status === 'new' && (m.status = 'read'))
    toast.success(t('adminMessages.allReadToast'))
  } catch {
    toast.error(t('adminMessages.updateError'))
  } finally {
    markingAll.value = false
  }
}

async function copyEmail(m: ContactMessage) {
  try {
    await navigator.clipboard.writeText(m.email)
    copied.value = true
    toast.success(t('adminMessages.emailCopied'))
    setTimeout(() => (copied.value = false), 1500)
  } catch {
    toast.error(t('adminMessages.updateError'))
  }
}

// ------------------------------------------------------------------
// Réponse : modèles rapides + envoi par email depuis la plateforme
// ------------------------------------------------------------------
const templates = computed(() => {
  const name = current.value?.full_name?.split(' ')[0] || ''
  return [
    { label: t('adminMessages.tplThanks'), text: t('adminMessages.tplThanksText', { name }) },
    { label: t('adminMessages.tplInfo'), text: t('adminMessages.tplInfoText', { name }) },
    { label: t('adminMessages.tplDone'), text: t('adminMessages.tplDoneText', { name }) },
    ...(current.value && isDeletion(current.value) ? [{ label: t('adminMessages.tplDeletion'), text: t('adminMessages.tplDeletionText', { name }) }] : []),
  ]
})

async function sendReply(m: ContactMessage) {
  if (replyText.value.trim().length < 2) return
  sending.value = true
  try {
    const res = await sendAdminReply('message', m.id, replyText.value.trim())
    m.admin_reply = replyText.value.trim()
    m.replied_at = res.repliedAt
    if (m.status === 'new') m.status = 'read'
    replyText.value = ''
    toast.success(res.emailSent ? t('adminMessages.replySent') : t('adminMessages.replySavedNoMail'))
    writeAuditLog({ action: 'CONTACT_MESSAGE_REPLIED', entityType: 'contact_messages', entityId: m.id })
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || e?.message || t('adminMessages.replyError'))
  } finally {
    sending.value = false
  }
}

// ------------------------------------------------------------------
// Suppression réelle du compte visé par une demande « account_deletion »
// ------------------------------------------------------------------
async function deleteAccount(m: ContactMessage) {
  if (!m.user_id) return
  if (!(await askConfirm({ message: t('adminMessages.confirmDeleteAccount', { name: m.full_name }) }))) return

  deletingId.value = m.id
  errorMessage.value = ''
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')
    const { csrfHeader } = useCsrf()
    await $fetch(`/api/admin/users/${m.user_id}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
    })
    deletedAccountIds.value.add(m.id)
    m.status = 'archived'
    toast.success(t('adminMessages.accountDeletedToast'))
  } catch (e: any) {
    toast.error(e?.data?.statusMessage || e?.message || t('adminMessages.deleteAccountError'))
  } finally {
    deletingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-6 md:px-6 md:py-8">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('adminMessages.title') }}</h1>
    <p class="mb-5 text-sm text-tikeo-gray-text">{{ t('adminMessages.subtitle') }}</p>

    <!-- Cartes-filtres -->
    <div class="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      <button
        v-for="c in tiles"
        :key="c.key"
        type="button"
        class="group flex items-center gap-3 border bg-tikeo-surface p-3.5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 active:scale-[0.98]"
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
    </div>

    <!-- Barre d'outils -->
    <div class="admin-toolbar !mb-4">
      <AdminSearch v-model="search" :placeholder="t('adminMessages.searchPlaceholder')" />
      <select v-model="typeFilter" class="h-11 w-full border border-tikeo-border bg-tikeo-surface px-3 text-sm font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none sm:w-auto" :aria-label="t('adminMessages.typeLabel')">
        <option value="all">{{ t('adminMessages.typeAll') }}</option>
        <option value="contact">{{ t('adminMessages.typeContact') }}</option>
        <option value="account_deletion">{{ t('adminMessages.typeDeletion') }}</option>
      </select>
      <select v-model="sort" class="h-11 w-full border border-tikeo-border bg-tikeo-surface px-3 text-sm font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none sm:w-auto" :aria-label="t('adminMessages.sortLabel')">
        <option value="recent">{{ t('adminMessages.sortRecent') }}</option>
        <option value="old">{{ t('adminMessages.sortOld') }}</option>
      </select>
      <div class="flex gap-2 sm:ml-auto">
        <button type="button" class="admin-chip !h-11" :disabled="loading" :title="t('adminMessages.refresh')" @click="load">
          <AppIcon name="refresh" class="h-4 w-4" :class="loading ? 'animate-spin' : ''" :stroke="2.2" />
        </button>
        <button v-if="canManage" type="button" class="admin-chip !h-11 disabled:opacity-40" :disabled="!counts.new || markingAll" @click="markAllRead">
          <AppIcon name="check-circle" class="h-4 w-4" :stroke="2.2" />
          {{ t('adminMessages.markAllRead') }}
        </button>
      </div>
    </div>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>

    <div v-if="loading && !messages.length" class="space-y-2">
      <div v-for="i in 5" :key="i" class="h-[4.5rem] animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <AdminEmpty v-else-if="filtered.length === 0" icon="mail" :text="search ? t('adminMessages.emptySearch') : t('adminMessages.empty')" />

    <!-- Liste groupée par jour -->
    <div v-else class="space-y-5">
      <section v-for="g in groups" :key="g.label">
        <h2 class="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-tikeo-gray-text">
          <span class="h-[3px] w-5 bg-[#FF7A00]" aria-hidden="true" />{{ g.label }}
          <span class="font-semibold normal-case tracking-normal">({{ g.items.length }})</span>
        </h2>
        <ul class="org-panel divide-y divide-tikeo-border">
          <li v-for="m in g.items" :key="m.id">
            <button type="button" class="group flex w-full items-center gap-3 px-3.5 py-3.5 text-left transition-colors hover:bg-tikeo-surface-alt md:gap-4 md:px-4" :class="m.status === 'new' ? 'bg-[#FF7A00]/[0.06]' : ''" @click="openMessage(m)">
              <span class="relative flex h-11 w-11 shrink-0 items-center justify-center font-display text-lg font-extrabold" :class="isDeletion(m) ? 'bg-tikeo-error text-white' : 'bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink'">
                {{ initial(m) }}
                <span v-if="m.status === 'new'" class="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-tikeo-surface bg-[#FF7A00]" aria-hidden="true" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span class="truncate" :class="m.status === 'new' ? 'font-extrabold text-tikeo-black' : 'font-semibold text-tikeo-black'">{{ m.full_name }}</span>
                  <StatusPill :tone="statusTone[m.status]">{{ statusLabels[m.status] }}</StatusPill>
                  <StatusPill v-if="isDeletion(m)" tone="error">{{ deletedAccountIds.has(m.id) ? t('adminMessages.accountDeletedBadge') : t('adminMessages.accountDeletionBadge') }}</StatusPill>
                  <span v-if="m.replied_at" class="inline-flex items-center gap-1 text-[11px] font-bold text-tikeo-success"><AppIcon name="reply" class="h-3.5 w-3.5" :stroke="2.4" />{{ t('adminMessages.answered') }}</span>
                </span>
                <span class="mt-0.5 block truncate text-sm text-tikeo-black">{{ m.subject }}</span>
                <span class="block truncate text-xs text-tikeo-gray-text">{{ preview(m) }}</span>
              </span>
              <span class="flex shrink-0 flex-col items-end gap-1 text-right">
                <span class="text-xs font-semibold text-tikeo-gray-text">{{ relative(m.created_at) }}</span>
                <AppIcon name="chevron-right" class="h-4 w-4 text-tikeo-gray-text transition-transform group-hover:translate-x-1" :stroke="2.4" />
              </span>
            </button>
          </li>
        </ul>
      </section>
    </div>

    <!-- ============ Pop-up de détail ============ -->
    <AdminModal :open="!!current" :has-prev="hasPrev" :has-next="hasNext" @close="closeModal" @prev="go(-1)" @next="go(1)">
      <template v-if="current" #header>
        <div class="flex items-center gap-3">
          <span class="flex h-12 w-12 shrink-0 items-center justify-center font-display text-xl font-extrabold" :class="isDeletion(current) ? 'bg-tikeo-error text-white' : 'bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink'">{{ initial(current) }}</span>
          <div class="min-w-0">
            <p class="truncate font-display text-lg font-extrabold leading-tight text-tikeo-black">{{ current.full_name }}</p>
            <div class="mt-1 flex flex-wrap items-center gap-1.5">
              <StatusPill :tone="statusTone[current.status]">{{ statusLabels[current.status] }}</StatusPill>
              <StatusPill v-if="isDeletion(current)" tone="error">{{ deletedAccountIds.has(current.id) ? t('adminMessages.accountDeletedBadge') : t('adminMessages.accountDeletionBadge') }}</StatusPill>
              <span v-if="idx >= 0" class="text-xs font-semibold text-tikeo-gray-text">{{ idx + 1 }} / {{ filtered.length }}</span>
            </div>
          </div>
        </div>
      </template>

      <template v-if="current">
        <!-- Coordonnées -->
        <dl class="grid gap-3 border border-tikeo-border bg-tikeo-surface-alt p-3.5 text-sm sm:grid-cols-2">
          <div class="min-w-0">
            <dt class="text-xs font-bold text-tikeo-gray-text">{{ t('adminMessages.fieldEmail') }}</dt>
            <dd class="mt-0.5 flex items-center gap-2">
              <a :href="`mailto:${current.email}`" class="truncate font-semibold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-4">{{ current.email }}</a>
              <button type="button" class="flex h-7 w-7 shrink-0 items-center justify-center border border-tikeo-border bg-tikeo-surface text-tikeo-gray-text transition-colors hover:border-[#FF7A00] hover:text-tikeo-black active:scale-90" :aria-label="t('adminMessages.copyEmail')" @click="copyEmail(current)">
                <AppIcon :name="copied ? 'check' : 'copy'" class="h-3.5 w-3.5" :class="copied ? 'tk-pop text-tikeo-success' : ''" :stroke="2.4" />
              </button>
            </dd>
          </div>
          <div>
            <dt class="text-xs font-bold text-tikeo-gray-text">{{ t('adminMessages.fieldDate') }}</dt>
            <dd class="mt-0.5 font-semibold text-tikeo-black">{{ fullDate(current.created_at) }}</dd>
          </div>
        </dl>

        <!-- Alerte suppression de compte -->
        <div v-if="isDeletion(current)" class="mt-4 border-l-4 border-tikeo-error bg-tikeo-error/5 px-4 py-3">
          <p class="flex items-center gap-2 text-sm font-bold text-tikeo-error"><AppIcon name="alert" class="h-4 w-4" :stroke="2.4" />{{ t('adminMessages.deletionWarnTitle') }}</p>
          <p class="mt-1 text-sm text-tikeo-gray-text">{{ deletedAccountIds.has(current.id) ? t('adminMessages.deletionDoneText') : current.user_id ? t('adminMessages.deletionWarnText') : t('adminMessages.accountDeletionNoUser') }}</p>
        </div>

        <!-- Message -->
        <h3 class="mb-2 mt-5 text-xs font-bold uppercase tracking-wider text-tikeo-gray-text">{{ t('adminMessages.fieldSubject') }}</h3>
        <p class="font-display text-lg font-extrabold leading-snug text-tikeo-black">{{ current.subject }}</p>
        <div class="mt-3 border border-tikeo-border bg-tikeo-surface p-4 shadow-card">
          <p class="whitespace-pre-wrap text-sm leading-relaxed text-tikeo-black">{{ current.message }}</p>
        </div>

        <!-- Réponse déjà envoyée -->
        <div v-if="current.admin_reply" class="mt-4 border-l-4 border-tikeo-success bg-tikeo-success/5 px-4 py-3">
          <p class="flex items-center gap-1.5 text-xs font-bold text-tikeo-success">
            <AppIcon name="check-circle" class="h-4 w-4" :stroke="2.4" />{{ t('adminMessages.yourReply') }}
            <span v-if="current.replied_at" class="font-semibold text-tikeo-gray-text">· {{ fullDate(current.replied_at) }}</span>
          </p>
          <p class="mt-1.5 whitespace-pre-wrap text-sm text-tikeo-black">{{ current.admin_reply }}</p>
        </div>

        <!-- Rédiger une réponse -->
        <div v-if="canManage" class="mt-5">
          <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-tikeo-gray-text">{{ current.admin_reply ? t('adminMessages.replyAgain') : t('adminMessages.replyTitle') }}</h3>
          <div class="no-scrollbar mb-2 flex gap-2 overflow-x-auto">
            <button v-for="tpl in templates" :key="tpl.label" type="button" class="h-8 shrink-0 border border-tikeo-border px-3 text-xs font-bold text-tikeo-black transition-all hover:-translate-y-0.5 hover:border-[#FF7A00] active:scale-95" @click="replyText = tpl.text">
              {{ tpl.label }}
            </button>
          </div>
          <textarea v-model="replyText" rows="5" maxlength="5000" class="input-field resize-y" :placeholder="t('adminMessages.replyPlaceholder')" />
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminMessages.replyHelp', { email: current.email }) }}</p>
        </div>
      </template>

      <template v-if="current" #footer>
        <div class="flex flex-wrap items-center gap-2">
          <button v-if="canManage" type="button" class="btn-ink !h-10 !text-[13px] disabled:opacity-50" :disabled="sending || replyText.trim().length < 2" @click="sendReply(current)">
            <TikeoSpinner v-if="sending" :size="16" />
            <AppIcon v-else name="reply" class="h-4 w-4" :stroke="2.4" />
            {{ sending ? t('adminMessages.sending') : t('adminMessages.sendReply') }}
          </button>
          <a :href="`mailto:${current.email}?subject=${encodeURIComponent('Re: ' + current.subject)}`" class="acc-btn-ghost !h-10 !text-[13px]">
            <AppIcon name="mail" class="h-4 w-4" :stroke="2.2" />{{ t('adminMessages.openMailApp') }}
          </a>
          <span class="flex-1" />
          <button v-if="current.status === 'read' && canManage" type="button" class="acc-btn-ghost !h-10 !text-[13px]" :disabled="updatingId === current.id" @click="markUnread(current)">{{ t('adminMessages.markUnread') }}</button>
          <button v-if="current.status !== 'archived' && canManage" type="button" class="acc-btn-ghost !h-10 !text-[13px]" :disabled="updatingId === current.id" @click="archiveAndNext(current)">
            <AppIcon name="inbox" class="h-4 w-4" :stroke="2.2" />{{ t('adminMessages.archive') }}
          </button>
          <button v-else-if="canManage" type="button" class="acc-btn-ghost !h-10 !text-[13px]" :disabled="updatingId === current.id" @click="updateStatus(current, 'read')">
            <AppIcon name="refresh" class="h-4 w-4" :stroke="2.2" />{{ t('adminMessages.unarchive') }}
          </button>
          <button v-if="isDeletion(current) && current.user_id && canDeleteAccount && !deletedAccountIds.has(current.id)" type="button" class="acc-btn-danger !h-10 !text-[13px]" :disabled="deletingId === current.id" @click="deleteAccount(current)">
            <AppIcon name="user-x" class="h-4 w-4" :stroke="2.2" />{{ deletingId === current.id ? t('adminMessages.deletingAccount') : t('adminMessages.deleteAccountButton') }}
          </button>
        </div>
      </template>
    </AdminModal>
  </div>
</template>
