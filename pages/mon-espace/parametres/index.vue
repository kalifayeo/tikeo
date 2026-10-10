<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { resetPassword, profile, user, updateNotificationPrefs, signOutEverywhere, updateEmail } = useAuth()
const { country, countries, setCountry } = useCountry()
const supabase = useSupabase()
const router = useRouter()

// ------------------------------------------------------------------
// Notifications de l'appareil (push)
// ------------------------------------------------------------------
const { supported: pushSupported, subscribed: pushSubscribed, loading: pushLoading, errorMessage: pushError, enable: pushEnable, disable: pushDisable } = usePushNotifications()

function roleLabelFor(role?: string) {
  switch (role) {
    case 'organizer':
      return t('adminUsers.roleOrganizer')
    case 'agent':
      return t('adminUsers.roleAgent')
    case 'admin':
      return t('adminUsers.roleAdmin')
    default:
      return t('adminUsers.roleBuyer')
  }
}

// ------------------------------------------------------------------
// Adresse email — Supabase envoie un lien de confirmation à la
// nouvelle adresse avant d'appliquer le changement.
// ------------------------------------------------------------------
const newEmail = ref('')
const updatingEmail = ref(false)
const emailFeedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const pendingNewEmail = computed(() => (user.value as any)?.new_email || '')

async function handleEmailUpdate() {
  emailFeedback.value = null
  const value = newEmail.value.trim().toLowerCase()
  if (!value || value === user.value?.email) {
    emailFeedback.value = { type: 'error', text: t('buyerSettings.emailSame') }
    return
  }
  updatingEmail.value = true
  try {
    await updateEmail(value)
    emailFeedback.value = { type: 'success', text: t('buyerSettings.emailConfirmSent', { email: value }) }
    newEmail.value = ''
  } catch (e: any) {
    emailFeedback.value = { type: 'error', text: e?.message || t('buyerSettings.emailError') }
  } finally {
    updatingEmail.value = false
  }
}

async function resendEmailConfirmation() {
  if (!pendingNewEmail.value) return
  updatingEmail.value = true
  emailFeedback.value = null
  try {
    await updateEmail(pendingNewEmail.value)
    emailFeedback.value = { type: 'success', text: t('buyerSettings.emailConfirmResent') }
  } catch (e: any) {
    emailFeedback.value = { type: 'error', text: e?.message || t('buyerSettings.emailError') }
  } finally {
    updatingEmail.value = false
  }
}

// ------------------------------------------------------------------
// Mot de passe
// ------------------------------------------------------------------
const newPassword = ref('')
const confirmPassword = ref('')
const updatingPassword = ref(false)
const passwordFeedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)

async function handlePasswordUpdate() {
  passwordFeedback.value = null
  if (newPassword.value.length < 8) {
    passwordFeedback.value = { type: 'error', text: t('buyerSettings.passwordTooShort') }
    return
  }
  if (newPassword.value !== confirmPassword.value) {
    passwordFeedback.value = { type: 'error', text: t('buyerSettings.passwordMismatch') }
    return
  }
  updatingPassword.value = true
  try {
    await resetPassword(newPassword.value)
    passwordFeedback.value = { type: 'success', text: t('buyerSettings.passwordSuccess') }
    newPassword.value = ''
    confirmPassword.value = ''
  } catch (e: any) {
    passwordFeedback.value = { type: 'error', text: e?.message || t('buyerSettings.passwordError') }
  } finally {
    updatingPassword.value = false
  }
}

// ------------------------------------------------------------------
// Notifications — sauvegarde immédiate à chaque bascule, pas de bouton
// dédié : c'est le comportement attendu d'un switch.
// ------------------------------------------------------------------
const notifyEmail = ref(true)
const notifySms = ref(true)
const notifyPromotions = ref(false)
const savingNotif = ref<string | null>(null)
const notifError = ref('')

watch(
  profile,
  (p) => {
    if (!p) return
    notifyEmail.value = p.notify_email
    notifySms.value = p.notify_sms
    notifyPromotions.value = p.notify_promotions
  },
  { immediate: true }
)

async function toggleNotif(key: 'notifyEmail' | 'notifySms' | 'notifyPromotions', value: boolean) {
  notifError.value = ''
  savingNotif.value = key
  const target = key === 'notifyEmail' ? notifyEmail : key === 'notifySms' ? notifySms : notifyPromotions
  const previous = target.value
  target.value = value
  try {
    await updateNotificationPrefs({ [key]: value })
  } catch (e: any) {
    target.value = previous
    notifError.value = e?.message || t('buyerSettings.notifError')
  } finally {
    savingNotif.value = null
  }
}

// ------------------------------------------------------------------
// Sécurité — déconnexion de tous les appareils
// ------------------------------------------------------------------
const signingOutEverywhere = ref(false)
const signOutFeedback = ref('')

async function handleSignOutEverywhere() {
  signingOutEverywhere.value = true
  signOutFeedback.value = ''
  try {
    await signOutEverywhere()
    router.push('/connexion')
  } catch (e: any) {
    signOutFeedback.value = e?.message || t('buyerSettings.signOutEverywhereError')
    signingOutEverywhere.value = false
  }
}

// ------------------------------------------------------------------
// Mes données — export PDF lisible (pas un dump JSON) : infos
// personnelles, commandes et billets, avec le nom de l'événement.
// ------------------------------------------------------------------
const exportingData = ref(false)
const exportError = ref('')

function formatDateFr(iso?: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
}

function formatAmount(value: number, currency: string) {
  return `${new Intl.NumberFormat('fr-FR').format(value)} ${currency}`
}

async function handleExportData() {
  exportingData.value = true
  exportError.value = ''
  try {
    const [{ data: orders, error: ordersError }, { data: tickets, error: ticketsError }] = await Promise.all([
      supabase
        .from('orders')
        .select('order_number, status, total, currency, created_at, events(title)')
        .eq('user_id', user.value!.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('tickets')
        .select('ticket_number, status, created_at, events(title)')
        .eq('user_id', user.value!.id)
        .order('created_at', { ascending: false }),
    ])
    if (ordersError) throw ordersError
    if (ticketsError) throw ticketsError

    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const marginX = 16
    const pageHeight = doc.internal.pageSize.getHeight()
    const pageWidth = doc.internal.pageSize.getWidth()
    let y = 20

    function ensureSpace(next = 8) {
      if (y + next > pageHeight - 16) {
        doc.addPage()
        y = 20
      }
    }

    function heading(text: string) {
      ensureSpace(14)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(13)
      doc.setTextColor(20, 20, 20)
      doc.text(text, marginX, y)
      y += 3
      doc.setDrawColor(230, 230, 230)
      doc.line(marginX, y, pageWidth - marginX, y)
      y += 8
    }

    function row(label: string, value: string) {
      ensureSpace(7)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(110, 110, 110)
      doc.text(label, marginX, y)
      doc.setTextColor(20, 20, 20)
      doc.setFont('helvetica', 'bold')
      doc.text(value, marginX + 55, y)
      y += 7
    }

    // En-tête du document
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(20)
    doc.setTextColor(237, 106, 33) // tikeo-orange
    doc.text('Tikeo', marginX, y)
    y += 8
    doc.setFontSize(12)
    doc.setTextColor(20, 20, 20)
    doc.text(t('buyerSettings.pdfTitle'), marginX, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(140, 140, 140)
    doc.text(`${t('buyerSettings.pdfGeneratedOn')} ${formatDateFr(new Date().toISOString())}`, marginX, y)
    y += 10

    // Informations personnelles (les vraies infos du compte, pas du JSON brut)
    heading(t('buyerProfile.accountInfoTitle'))
    row(t('buyerProfile.fullName'), profile.value?.full_name || '—')
    row(t('buyerProfile.email'), profile.value?.email || user.value?.email || '—')
    row(t('buyerProfile.phone'), profile.value?.phone || '—')
    row(t('buyerProfile.accountType'), roleLabelFor(profile.value?.role))
    row(t('buyerProfile.memberSince'), formatDateFr(profile.value?.created_at))
    y += 4

    // Commandes
    heading(`${t('placeholderPages.myOrders')} (${orders?.length ?? 0})`)
    if (!orders || orders.length === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(140, 140, 140)
      doc.text(t('buyerSettings.pdfNoOrders'), marginX, y)
      y += 8
    } else {
      for (const o of orders as any[]) {
        ensureSpace(16)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.setTextColor(20, 20, 20)
        doc.text(o.events?.title || o.order_number, marginX, y)
        y += 5.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(
          `${o.order_number} • ${formatDateFr(o.created_at)} • ${o.status} • ${formatAmount(o.total, o.currency)}`,
          marginX,
          y
        )
        y += 8
      }
    }
    y += 4

    // Billets
    heading(`${t('header.myTickets')} (${tickets?.length ?? 0})`)
    if (!tickets || tickets.length === 0) {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(10)
      doc.setTextColor(140, 140, 140)
      doc.text(t('buyerSettings.pdfNoTickets'), marginX, y)
      y += 8
    } else {
      for (const tk of tickets as any[]) {
        ensureSpace(16)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(10.5)
        doc.setTextColor(20, 20, 20)
        doc.text(tk.events?.title || tk.ticket_number, marginX, y)
        y += 5.5
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9)
        doc.setTextColor(120, 120, 120)
        doc.text(`${tk.ticket_number} • ${formatDateFr(tk.created_at)} • ${tk.status}`, marginX, y)
        y += 8
      }
    }

    doc.save(`tikeo-mes-donnees-${new Date().toISOString().slice(0, 10)}.pdf`)
  } catch (e: any) {
    exportError.value = e?.message || t('buyerSettings.exportError')
  } finally {
    exportingData.value = false
  }
}

// ------------------------------------------------------------------
// Suppression de compte — passe désormais par le serveur (voir
// server/api/account/request-deletion.post.ts), qui rattache la demande au
// vrai user_id (jeton de session, jamais fourni par le client) pour que
// l'administration puisse réellement supprimer LE bon compte depuis
// /admin/messages, au lieu de simplement pouvoir répondre par email ou
// archiver un message (correctif : la suppression n'avait jusqu'ici aucun
// effet réel — voir server/api/admin/users/[userId]/delete.post.ts).
// ------------------------------------------------------------------
const showDeleteModal = ref(false)
const deleteReason = ref('')
const sendingDeleteRequest = ref(false)
const deleteRequestSent = ref(false)
const deleteError = ref('')

async function submitDeleteRequest() {
  sendingDeleteRequest.value = true
  deleteError.value = ''
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')

    const { csrfHeader } = useCsrf()
    await $fetch('/api/account/request-deletion', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
      body: { reason: deleteReason.value.trim() || undefined },
    })
    deleteRequestSent.value = true
    showDeleteModal.value = false
  } catch (e: any) {
    deleteError.value = e?.data?.statusMessage || e?.message || t('buyerSettings.deleteRequestError')
  } finally {
    sendingDeleteRequest.value = false
  }
}

// ------------------------------------------------------------------
// Affichage et accessibilité : chaque réglage s'applique IMMÉDIATEMENT
// (cookie lu par app.vue, classes .ui-* dans assets/css/main.css).
// ------------------------------------------------------------------
const toast = useToast()
const { theme, auto: themeAuto, setTheme, setAuto } = useTheme()
const { prefs: uiPrefs, set: setUi, reset: resetUi, buzz } = useUiPrefs()
const { extras, saveExtras } = useProfileExtras()

const themeChoice = computed(() => (themeAuto.value ? 'auto' : theme.value))
function pickTheme(v: string) {
  if (v === 'auto') setAuto(true)
  else setTheme(v as 'light' | 'dark')
  toast.info(t('buyerSettings.themeApplied'))
}
const themeOptions = computed(() => [
  { value: 'light', label: t('buyerSettings.themeLight'), icon: 'eye' },
  { value: 'dark', label: t('buyerSettings.themeDark'), icon: 'lock' },
  { value: 'auto', label: t('buyerSettings.themeAuto'), icon: 'sparkles' },
])
const sizeOptions = [
  { value: 'sm', label: 'A-' },
  { value: 'md', label: 'A' },
  { value: 'lg', label: 'A+' },
  { value: 'xl', label: 'A++' },
]
const uiToggles = computed(() => [
  { key: 'reduceMotion' as const, icon: 'pause', label: t('buyerSettings.reduceMotion'), help: t('buyerSettings.reduceMotionHelp') },
  { key: 'highContrast' as const, icon: 'eye', label: t('buyerSettings.highContrast'), help: t('buyerSettings.highContrastHelp') },
  { key: 'dataSaver' as const, icon: 'download', label: t('buyerSettings.dataSaver'), help: t('buyerSettings.dataSaverHelp') },
  { key: 'haptics' as const, icon: 'bolt', label: t('buyerSettings.haptics'), help: t('buyerSettings.hapticsHelp') },
])

function resetDisplay() {
  resetUi()
  setAuto(false)
  setTheme('light')
  toast.success(t('buyerSettings.displayReset'))
}

// ------------------------------------------------------------------
// Rappels et alertes (enregistrés dans le compte, sauvegarde immédiate)
// ------------------------------------------------------------------
const topicSaving = ref('')
const topics = computed(() => [
  { key: 'remindDayBefore' as const, label: t('buyerSettings.remindDayBefore'), help: t('buyerSettings.remindDayBeforeHelp') },
  { key: 'notifyWaitlist' as const, label: t('buyerSettings.notifyWaitlist'), help: t('buyerSettings.notifyWaitlistHelp') },
  { key: 'notifyNewInCity' as const, label: t('buyerSettings.notifyNewInCity'), help: t('buyerSettings.notifyNewInCityHelp') },
])
async function toggleTopic(key: 'remindDayBefore' | 'notifyWaitlist' | 'notifyNewInCity' | 'showNameOnReviews', value: boolean) {
  topicSaving.value = key
  try {
    await saveExtras({ [key]: value })
    toast.success(t('buyerSettings.savedAuto'))
  } catch (e: any) {
    toast.error(e?.message || t('buyerSettings.notifError'))
  } finally {
    topicSaving.value = ''
  }
}

// ------------------------------------------------------------------
// Test de connexion : mesure le temps de réponse du site
// ------------------------------------------------------------------
const testing = ref(false)
const speed = ref<{ ms: number; type: string; online: boolean } | null>(null)
async function testConnection() {
  testing.value = true
  speed.value = null
  buzz(10)
  const conn = (navigator as any).connection
  const t0 = performance.now()
  let ok = navigator.onLine
  try {
    await fetch(`/favicon.png?t=${Date.now()}`, { cache: 'no-store' })
  } catch {
    ok = false
  }
  speed.value = { ms: Math.round(performance.now() - t0), type: conn?.effectiveType || '', online: ok }
  testing.value = false
}
const speedVerdict = computed(() => {
  if (!speed.value) return null
  if (!speed.value.online) return { tone: 'error', text: t('buyerSettings.speedOffline') }
  if (speed.value.ms < 400) return { tone: 'success', text: t('buyerSettings.speedGood') }
  if (speed.value.ms < 1200) return { tone: 'info', text: t('buyerSettings.speedMedium') }
  return { tone: 'error', text: t('buyerSettings.speedSlow') }
})

// ------------------------------------------------------------------
// Stockage de l'appareil : vider le cache local
// ------------------------------------------------------------------
const clearing = ref(false)
async function clearLocalData() {
  clearing.value = true
  try {
    if ('caches' in window) {
      const keys = await caches.keys()
      await Promise.all(keys.map((k) => caches.delete(k)))
    }
    try {
      sessionStorage.removeItem('tikeo:splash-seen')
    } catch {
      /* ignoré */
    }
    toast.success(t('buyerSettings.cacheCleared'))
  } catch {
    toast.error(t('buyerSettings.cacheError'))
  } finally {
    clearing.value = false
  }
}

// ------------------------------------------------------------------
// Sommaire : un clic ouvre la section, défile jusqu'à elle et la met en évidence
// ------------------------------------------------------------------
const SECTION_IDS = ['display', 'notifications', 'device', 'email', 'security', 'data', 'account'] as const
const openMap = reactive<Record<string, boolean>>({ display: true, notifications: true, device: true, email: false, security: false, data: false, account: false })
const sectionNav = computed(() => [
  { id: 'display', icon: 'settings', label: t('buyerSettings.navDisplay') },
  { id: 'notifications', icon: 'bell', label: t('buyerSettings.notificationsTitle') },
  { id: 'device', icon: 'phone', label: t('buyerSettings.navDevice') },
  { id: 'email', icon: 'mail', label: t('buyerSettings.emailTitle') },
  { id: 'security', icon: 'shield', label: t('buyerSettings.passwordTitle') },
  { id: 'data', icon: 'share', label: t('buyerSettings.dataTitle') },
  { id: 'account', icon: 'user', label: t('buyerSettings.accountTitle') },
])
const activeSection = ref('')
async function jumpTo(id: string) {
  buzz(8)
  openMap[id] = true
  activeSection.value = id
  await nextTick()
  setTimeout(() => {
    const el = document.getElementById(`set-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.classList.remove('tk-flash')
    void el.offsetWidth
    el.classList.add('tk-flash')
    setTimeout(() => el.classList.remove('tk-flash'), 1900)
  }, 340)
}
function setAll(open: boolean) {
  buzz(8)
  for (const id of SECTION_IDS) openMap[id] = open
}

const showPwd = ref(false)
const pwdStrength = computed(() => {
  const p = newPassword.value
  let score = 0
  if (p.length >= 8) score++
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++
  if (/\d/.test(p)) score++
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) score++
  const colors = ['bg-tikeo-error', 'bg-tikeo-error', 'bg-[#FF7A00]', 'bg-[#EAB308]', 'bg-tikeo-success']
  const labels = [t('buyerSettings.pwdWeak'), t('buyerSettings.pwdWeak'), t('buyerSettings.pwdFair'), t('buyerSettings.pwdGood'), t('buyerSettings.pwdStrong')]
  return { score, color: colors[score], label: labels[score] }
})
</script>

<template>
  <AccountShell :title="t('header.settings')" :subtitle="t('buyerSettings.subtitle')" width="narrow">
    <!-- Sommaire -->
    <div class="mb-6 flex flex-wrap items-center gap-2 md:mb-8">
      <button
        v-for="n in sectionNav"
        :key="n.id"
        type="button"
        class="flex h-9 items-center gap-1.5 border px-3 text-[13px] font-bold transition-all duration-200 active:scale-95"
        :class="activeSection === n.id ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:-translate-y-0.5 hover:border-[#FF7A00]'"
        @click="jumpTo(n.id)"
      >
        <AppIcon :name="n.icon" class="h-4 w-4" />
        {{ n.label }}
      </button>
      <span class="ml-auto flex gap-3 text-[12px] font-bold">
        <button type="button" class="text-tikeo-gray-text underline-offset-4 hover:text-tikeo-black hover:underline" @click="setAll(true)">{{ t('buyerSettings.expandAll') }}</button>
        <button type="button" class="text-tikeo-gray-text underline-offset-4 hover:text-tikeo-black hover:underline" @click="setAll(false)">{{ t('buyerSettings.collapseAll') }}</button>
      </span>
    </div>

    <div class="space-y-6 md:space-y-8">
      <!-- ============ Affichage et accessibilité ============ -->
      <div id="set-display" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.display" :title="t('buyerSettings.preferencesTitle')" :subtitle="t('buyerSettings.displaySubtitle')" icon="settings">
          <div class="divide-y divide-tikeo-border">
            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.themeLabel') }}</p>
                <p class="text-xs text-tikeo-gray-text">{{ t('buyerSettings.themeHelp') }}</p>
              </div>
              <SegmentedControl :model-value="themeChoice" :options="themeOptions" :aria-label="t('buyerSettings.themeLabel')" @update:model-value="pickTheme" />
            </div>

            <div class="flex flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.textSize') }}</p>
                <p class="text-xs text-tikeo-gray-text">{{ t('buyerSettings.textSizeHelp') }}</p>
              </div>
              <SegmentedControl :model-value="uiPrefs?.textSize || 'md'" :options="sizeOptions" :aria-label="t('buyerSettings.textSize')" @update:model-value="(v) => setUi('textSize', v as any)" />
            </div>

            <div v-for="o in uiToggles" :key="o.key" class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="flex min-w-0 items-start gap-3">
                <AppIcon :name="o.icon" class="mt-0.5 h-[18px] w-[18px] shrink-0 text-tikeo-gray-text" />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-tikeo-black">{{ o.label }}</p>
                  <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ o.help }}</p>
                </div>
              </div>
              <ToggleSwitch :model-value="!!uiPrefs?.[o.key]" :aria-label="o.label" @update:model-value="(v) => setUi(o.key, v)" />
            </div>

            <div class="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
              <span class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.languageLabel') }}</span>
              <LanguageSwitcher />
            </div>
            <div class="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
              <span class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.countryLabel') }}</span>
              <select class="input-field !h-10 !w-auto" :value="country.code" @change="setCountry(($event.target as HTMLSelectElement).value)">
                <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
              </select>
            </div>

            <!-- Aperçu en direct -->
            <div class="px-4 py-4 md:px-5">
              <p class="mb-2 text-xs font-bold text-tikeo-gray-text">{{ t('buyerSettings.preview') }}</p>
              <div class="flex items-center gap-3 border border-tikeo-border bg-tikeo-surface-alt p-3">
                <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="ticket" class="h-5 w-5" /></span>
                <div class="min-w-0">
                  <p class="font-display text-base font-extrabold text-tikeo-black">{{ t('buyerSettings.previewTitle') }}</p>
                  <p class="text-sm text-tikeo-gray-text">{{ t('buyerSettings.previewText') }}</p>
                </div>
              </div>
            </div>

            <div class="px-4 py-4 md:px-5">
              <button type="button" class="acc-btn-ghost max-sm:w-full" @click="resetDisplay">
                <AppIcon name="refresh" class="h-4 w-4" :stroke="2.2" />
                {{ t('buyerSettings.resetDisplay') }}
              </button>
            </div>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Notifications ============ -->
      <div id="set-notifications" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.notifications" :title="t('buyerSettings.notificationsTitle')" :subtitle="t('buyerSettings.notificationsSubtitle')" icon="bell">
          <p v-if="notifError" class="acc-alert-error m-4 md:mx-5">{{ notifError }}</p>
          <div class="divide-y divide-tikeo-border">
            <div class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.notifyEmailLabel') }}</p>
                <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifyEmailHelp') }}</p>
              </div>
              <ToggleSwitch :model-value="notifyEmail" :disabled="savingNotif === 'notifyEmail'" :aria-label="t('buyerSettings.notifyEmailLabel')" @update:model-value="(v) => toggleNotif('notifyEmail', v)" />
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.notifySmsLabel') }}</p>
                <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifySmsHelp') }}</p>
              </div>
              <ToggleSwitch :model-value="notifySms" :disabled="savingNotif === 'notifySms'" :aria-label="t('buyerSettings.notifySmsLabel')" @update:model-value="(v) => toggleNotif('notifySms', v)" />
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.notifyPromotionsLabel') }}</p>
                <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifyPromotionsHelp') }}</p>
              </div>
              <ToggleSwitch :model-value="notifyPromotions" :disabled="savingNotif === 'notifyPromotions'" :aria-label="t('buyerSettings.notifyPromotionsLabel')" @update:model-value="(v) => toggleNotif('notifyPromotions', v)" />
            </div>
            <div v-for="tp in topics" :key="tp.key" class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ tp.label }}</p>
                <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ tp.help }}</p>
              </div>
              <ToggleSwitch :model-value="extras[tp.key]" :disabled="topicSaving === tp.key" :aria-label="tp.label" @update:model-value="(v) => toggleTopic(tp.key, v)" />
            </div>
            <div class="flex items-center justify-between gap-4 px-4 py-4 md:px-5">
              <div class="min-w-0">
                <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.showNameOnReviews') }}</p>
                <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.showNameOnReviewsHelp') }}</p>
              </div>
              <ToggleSwitch :model-value="extras.showNameOnReviews" :disabled="topicSaving === 'showNameOnReviews'" :aria-label="t('buyerSettings.showNameOnReviews')" @update:model-value="(v) => toggleTopic('showNameOnReviews', v)" />
            </div>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Cet appareil ============ -->
      <div id="set-device" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.device" :title="t('buyerSettings.navDevice')" :subtitle="t('buyerSettings.deviceSubtitle')" icon="phone">
          <div class="divide-y divide-tikeo-border">
            <template v-if="pushSupported">
              <p v-if="pushError" class="acc-alert-error m-4 md:mx-5">{{ pushError }}</p>
              <div class="flex items-center justify-between gap-3 px-4 py-4 md:px-5">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-tikeo-black">{{ t('pushNotifications.title') }}</p>
                  <p v-if="pushSubscribed" class="mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-tikeo-success"><AppIcon name="check" class="h-3.5 w-3.5" :stroke="2.8" />{{ t('pushNotifications.enabled') }}</p>
                  <p v-else class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('pushNotifications.subtitle') }}</p>
                </div>
                <button v-if="!pushSubscribed" type="button" class="btn-ink !h-10 !text-[13px] shrink-0 disabled:opacity-60" :disabled="pushLoading" @click="pushEnable">{{ t('pushNotifications.enableButton') }}</button>
                <button v-else type="button" class="acc-btn-danger shrink-0 !h-9 !text-xs" :disabled="pushLoading" @click="pushDisable">{{ t('pushNotifications.disableButton') }}</button>
              </div>
            </template>

            <!-- Test de connexion -->
            <div class="px-4 py-4 md:px-5">
              <div class="flex flex-wrap items-center justify-between gap-3">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.speedTitle') }}</p>
                  <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.speedHelp') }}</p>
                </div>
                <button type="button" class="acc-btn-ghost shrink-0 max-sm:w-full" :disabled="testing" @click="testConnection">
                  <TikeoSpinner v-if="testing" :size="16" />
                  <AppIcon v-else name="activity" class="h-4 w-4" :stroke="2.2" />
                  {{ testing ? t('buyerSettings.speedTesting') : t('buyerSettings.speedButton') }}
                </button>
              </div>
              <div v-if="speed && speedVerdict" class="mt-3 flex items-center gap-3 border-l-4 bg-tikeo-surface-alt px-4 py-3 text-sm" :class="speedVerdict.tone === 'success' ? 'border-tikeo-success' : speedVerdict.tone === 'error' ? 'border-tikeo-error' : 'border-[#FF7A00]'">
                <span class="font-display text-2xl font-extrabold tabular-nums text-tikeo-black">{{ speed.online ? `${speed.ms} ms` : '—' }}</span>
                <span class="text-tikeo-gray-text">{{ speedVerdict.text }}<template v-if="speed.type"> ({{ speed.type }})</template></span>
              </div>
            </div>

            <div class="px-4 py-4 md:px-5">
              <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.cacheTitle') }}</p>
              <p class="mb-3 mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.cacheHelp') }}</p>
              <button type="button" class="acc-btn-ghost max-sm:w-full" :disabled="clearing" @click="clearLocalData">
                <AppIcon name="trash" class="h-4 w-4" :stroke="2.2" />
                {{ clearing ? t('buyerSettings.updating') : t('buyerSettings.cacheButton') }}
              </button>
            </div>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Adresse email ============ -->
      <div id="set-email" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.email" :title="t('buyerSettings.emailTitle')" icon="mail" :summary="user?.email">
          <div class="space-y-4 p-4 md:p-5">
            <p v-if="emailFeedback" :class="emailFeedback.type === 'success' ? 'acc-alert-success' : 'acc-alert-error'">{{ emailFeedback.text }}</p>
            <p class="text-sm text-tikeo-gray-text">
              {{ t('buyerSettings.emailCurrent') }} <span class="font-bold text-tikeo-black">{{ user?.email }}</span>
            </p>
            <div v-if="pendingNewEmail" class="border-l-4 border-[#FF7A00] bg-tikeo-surface-alt px-4 py-3 text-sm text-tikeo-black">
              <p>{{ t('buyerSettings.emailPending', { email: pendingNewEmail }) }}</p>
              <button type="button" class="mt-2 text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange" :disabled="updatingEmail" @click="resendEmailConfirmation">
                {{ t('buyerSettings.emailResend') }}
              </button>
            </div>
            <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="handleEmailUpdate">
              <input v-model="newEmail" type="email" :placeholder="t('buyerSettings.emailNewPlaceholder')" class="input-field !h-11 flex-1" />
              <button type="submit" class="btn-ink !h-11 shrink-0 disabled:opacity-60" :disabled="updatingEmail">
                {{ updatingEmail ? t('buyerSettings.updating') : t('buyerSettings.emailChangeButton') }}
              </button>
            </form>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Sécurité ============ -->
      <div id="set-security" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.security" :title="t('buyerSettings.passwordTitle')" icon="shield">
          <div class="p-4 md:p-5">
            <form class="space-y-3" @submit.prevent="handlePasswordUpdate">
              <p v-if="passwordFeedback" :class="passwordFeedback.type === 'success' ? 'acc-alert-success' : 'acc-alert-error'">{{ passwordFeedback.text }}</p>
              <div class="relative">
                <input v-model="newPassword" :type="showPwd ? 'text' : 'password'" required :placeholder="t('buyerSettings.newPassword')" class="input-field !h-11 !pr-12" />
                <button type="button" class="absolute right-0 top-0 flex h-11 w-11 items-center justify-center text-tikeo-gray-text hover:text-tikeo-black" :aria-label="t('buyerSettings.togglePassword')" @click="showPwd = !showPwd">
                  <AppIcon :name="showPwd ? 'eye-off' : 'eye'" class="h-5 w-5" />
                </button>
              </div>
              <!-- Force du mot de passe : se remplit pendant la saisie -->
              <div v-if="newPassword" class="flex items-center gap-3" aria-live="polite">
                <div class="flex h-1.5 flex-1 gap-1">
                  <span v-for="n in 4" :key="n" class="flex-1 transition-colors duration-300" :class="n <= pwdStrength.score ? pwdStrength.color : 'bg-tikeo-surface-alt'" />
                </div>
                <span class="w-16 text-right text-xs font-bold text-tikeo-gray-text">{{ pwdStrength.label }}</span>
              </div>
              <input v-model="confirmPassword" :type="showPwd ? 'text' : 'password'" required :placeholder="t('buyerSettings.confirmPassword')" class="input-field !h-11" />
              <button type="submit" class="btn-ink !h-11 disabled:opacity-60 max-sm:w-full" :disabled="updatingPassword">
                {{ updatingPassword ? t('buyerSettings.updating') : t('buyerSettings.updatePassword') }}
              </button>
            </form>

            <div class="mt-6 border-t-2 border-dashed border-tikeo-gray-text/25 pt-6">
              <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.signOutEverywhereTitle') }}</p>
              <p class="mb-3 mt-0.5 text-xs text-tikeo-gray-text">{{ t('buyerSettings.signOutEverywhereHelp') }}</p>
              <p v-if="signOutFeedback" class="acc-alert-error mb-3">{{ signOutFeedback }}</p>
              <button type="button" class="acc-btn-ghost max-sm:w-full" :disabled="signingOutEverywhere" @click="handleSignOutEverywhere">
                {{ signingOutEverywhere ? t('buyerSettings.signingOut') : t('buyerSettings.signOutEverywhereButton') }}
              </button>
            </div>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Mes données ============ -->
      <div id="set-data" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.data" :title="t('buyerSettings.dataTitle')" icon="share">
          <div class="p-4 md:p-5">
            <p class="mb-4 text-sm leading-relaxed text-tikeo-gray-text">{{ t('buyerSettings.dataText') }}</p>
            <p v-if="exportError" class="acc-alert-error mb-3">{{ exportError }}</p>
            <button type="button" class="acc-btn-ghost max-sm:w-full" :disabled="exportingData" @click="handleExportData">
              {{ exportingData ? t('buyerSettings.exporting') : t('buyerSettings.exportButton') }}
            </button>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Compte ============ -->
      <div id="set-account" class="scroll-mt-24">
        <AccordionPanel v-model:open="openMap.account" :title="t('buyerSettings.accountTitle')" icon="user" tone="danger">
          <div class="p-4 md:p-5">
            <p v-if="deleteRequestSent" class="acc-alert-success">{{ t('buyerSettings.deleteRequestSent') }}</p>
            <template v-else>
              <p class="mb-4 text-sm leading-relaxed text-tikeo-gray-text">{{ t('buyerSettings.deleteAccountText') }}</p>
              <div class="flex flex-wrap items-center gap-x-5 gap-y-3">
                <button type="button" class="acc-btn-danger" @click="showDeleteModal = true">{{ t('buyerSettings.deleteAccountButton') }}</button>
                <NuxtLink to="/contact" class="text-[13px] font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] hover:text-tikeo-orange">
                  {{ t('buyerSettings.contactSupport') }}
                </NuxtLink>
              </div>
            </template>
          </div>
        </AccordionPanel>
      </div>
    </div>

    <!-- Modale de confirmation de suppression de compte -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-tikeo-ink/70 p-4 backdrop-blur-[2px]">
      <div class="w-full max-w-sm bg-tikeo-surface p-5 shadow-2xl">
        <h2 class="mb-2 font-display text-xl font-extrabold tracking-tight text-tikeo-black">{{ t('buyerSettings.deleteModalTitle') }}</h2>
        <p class="mb-4 text-sm text-tikeo-gray-text">{{ t('buyerSettings.deleteModalText') }}</p>
        <p v-if="deleteError" class="acc-alert-error mb-3 !py-1.5 !text-xs">{{ deleteError }}</p>
        <textarea v-model="deleteReason" rows="3" class="input-field mb-4 resize-none" :placeholder="t('buyerSettings.deleteModalReasonPlaceholder')" />
        <div class="flex gap-2">
          <button type="button" class="acc-btn-ghost flex-1" @click="showDeleteModal = false">{{ t('buyerSettings.deleteModalCancel') }}</button>
          <button
            type="button"
            class="inline-flex h-10 flex-1 items-center justify-center bg-tikeo-error px-4 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            :disabled="sendingDeleteRequest"
            @click="submitDeleteRequest"
          >
            {{ sendingDeleteRequest ? t('buyerSettings.deleteModalSending') : t('buyerSettings.deleteModalConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </AccountShell>
</template>
