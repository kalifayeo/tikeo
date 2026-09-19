<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { resetPassword, profile, user, updateNotificationPrefs, signOutEverywhere, updateEmail } = useAuth()
const { country, countries, setCountry } = useCountry()
const supabase = useSupabase()
const router = useRouter()

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
// Suppression de compte — demande envoyée au support (0011_contact_messages)
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
    const { error } = await supabase.from('contact_messages').insert({
      full_name: profile.value?.full_name || user.value?.email || t('buyerSettings.deleteRequestFallbackName'),
      email: user.value?.email || '',
      subject: t('buyerSettings.deleteRequestSubject'),
      message: deleteReason.value.trim() || t('buyerSettings.deleteRequestDefaultMessage'),
    })
    if (error) throw error
    deleteRequestSent.value = true
    showDeleteModal.value = false
  } catch (e: any) {
    deleteError.value = e?.message || t('buyerSettings.deleteRequestError')
  } finally {
    sendingDeleteRequest.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('header.settings') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('buyerSettings.subtitle') }}</p>

    <div class="max-w-xl space-y-10">
      <!-- Préférences d'affichage -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.preferencesTitle') }}</h2>
        <div class="divide-y divide-tikeo-border border border-tikeo-border">
          <div class="flex items-center justify-between px-4 py-3">
            <span class="text-sm text-tikeo-black">{{ t('buyerSettings.themeLabel') }}</span>
            <ThemeToggle />
          </div>
          <div class="flex items-center justify-between px-4 py-3">
            <span class="text-sm text-tikeo-black">{{ t('buyerSettings.languageLabel') }}</span>
            <LanguageSwitcher />
          </div>
          <div class="flex items-center justify-between px-4 py-3">
            <span class="text-sm text-tikeo-black">{{ t('buyerSettings.countryLabel') }}</span>
            <select
              class="border border-tikeo-border bg-tikeo-surface px-2.5 py-1.5 text-sm text-tikeo-black focus:border-tikeo-orange focus:outline-none"
              :value="country.code"
              @change="setCountry(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="c in countries" :key="c.code" :value="c.code">{{ c.flag }} {{ c.name }}</option>
            </select>
          </div>
        </div>
      </section>

      <!-- Notifications -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.notificationsTitle') }}</h2>
        <p v-if="notifError" class="mb-2 border border-red-200 bg-red-50 px-4 py-2 text-sm text-tikeo-error">{{ notifError }}</p>
        <div class="divide-y divide-tikeo-border border border-tikeo-border">
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p class="text-sm text-tikeo-black">{{ t('buyerSettings.notifyEmailLabel') }}</p>
              <p class="text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifyEmailHelp') }}</p>
            </div>
            <ToggleSwitch
              :model-value="notifyEmail"
              :disabled="savingNotif === 'notifyEmail'"
              :aria-label="t('buyerSettings.notifyEmailLabel')"
              @update:model-value="(v) => toggleNotif('notifyEmail', v)"
            />
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p class="text-sm text-tikeo-black">{{ t('buyerSettings.notifySmsLabel') }}</p>
              <p class="text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifySmsHelp') }}</p>
            </div>
            <ToggleSwitch
              :model-value="notifySms"
              :disabled="savingNotif === 'notifySms'"
              :aria-label="t('buyerSettings.notifySmsLabel')"
              @update:model-value="(v) => toggleNotif('notifySms', v)"
            />
          </div>
          <div class="flex items-center justify-between gap-3 px-4 py-3">
            <div>
              <p class="text-sm text-tikeo-black">{{ t('buyerSettings.notifyPromotionsLabel') }}</p>
              <p class="text-xs text-tikeo-gray-text">{{ t('buyerSettings.notifyPromotionsHelp') }}</p>
            </div>
            <ToggleSwitch
              :model-value="notifyPromotions"
              :disabled="savingNotif === 'notifyPromotions'"
              :aria-label="t('buyerSettings.notifyPromotionsLabel')"
              @update:model-value="(v) => toggleNotif('notifyPromotions', v)"
            />
          </div>
        </div>
      </section>

      <!-- Adresse email -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.emailTitle') }}</h2>
        <p v-if="emailFeedback" class="mb-3 border px-4 py-2 text-sm" :class="emailFeedback.type === 'success' ? 'border-green-200 bg-green-50 text-tikeo-success' : 'border-red-200 bg-red-50 text-tikeo-error'">
          {{ emailFeedback.text }}
        </p>

        <p class="mb-3 text-sm text-tikeo-black">
          {{ t('buyerSettings.emailCurrent') }} <span class="font-semibold">{{ user?.email }}</span>
        </p>

        <div v-if="pendingNewEmail" class="mb-3 border border-tikeo-orange/30 bg-tikeo-orange/10 px-4 py-3 text-sm text-tikeo-black">
          <p>{{ t('buyerSettings.emailPending', { email: pendingNewEmail }) }}</p>
          <button type="button" class="mt-2 font-semibold text-tikeo-orange hover:underline" :disabled="updatingEmail" @click="resendEmailConfirmation">
            {{ t('buyerSettings.emailResend') }}
          </button>
        </div>

        <form class="flex flex-col gap-2 sm:flex-row" @submit.prevent="handleEmailUpdate">
          <input v-model="newEmail" type="email" :placeholder="t('buyerSettings.emailNewPlaceholder')" class="input-field flex-1" />
          <button type="submit" class="btn-secondary shrink-0" :disabled="updatingEmail">
            {{ updatingEmail ? t('buyerSettings.updating') : t('buyerSettings.emailChangeButton') }}
          </button>
        </form>
      </section>

      <!-- Sécurité -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.passwordTitle') }}</h2>
        <form class="space-y-3" @submit.prevent="handlePasswordUpdate">
          <p
            v-if="passwordFeedback"
            class="border px-4 py-2 text-sm"
            :class="passwordFeedback.type === 'success' ? 'border-green-200 bg-green-50 text-tikeo-success' : 'border-red-200 bg-red-50 text-tikeo-error'"
          >
            {{ passwordFeedback.text }}
          </p>
          <input v-model="newPassword" type="password" required :placeholder="t('buyerSettings.newPassword')" class="input-field" />
          <input v-model="confirmPassword" type="password" required :placeholder="t('buyerSettings.confirmPassword')" class="input-field" />
          <button type="submit" class="btn-primary" :disabled="updatingPassword">
            {{ updatingPassword ? t('buyerSettings.updating') : t('buyerSettings.updatePassword') }}
          </button>
        </form>

        <div class="mt-5 border-t border-tikeo-border pt-5">
          <p class="mb-2 text-sm text-tikeo-black">{{ t('buyerSettings.signOutEverywhereTitle') }}</p>
          <p class="mb-3 text-xs text-tikeo-gray-text">{{ t('buyerSettings.signOutEverywhereHelp') }}</p>
          <p v-if="signOutFeedback" class="mb-3 border border-red-200 bg-red-50 px-4 py-2 text-sm text-tikeo-error">{{ signOutFeedback }}</p>
          <button type="button" class="btn-secondary" :disabled="signingOutEverywhere" @click="handleSignOutEverywhere">
            {{ signingOutEverywhere ? t('buyerSettings.signingOut') : t('buyerSettings.signOutEverywhereButton') }}
          </button>
        </div>
      </section>

      <!-- Mes données -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.dataTitle') }}</h2>
        <p class="mb-3 text-sm text-tikeo-gray-text">{{ t('buyerSettings.dataText') }}</p>
        <p v-if="exportError" class="mb-3 border border-red-200 bg-red-50 px-4 py-2 text-sm text-tikeo-error">{{ exportError }}</p>
        <button type="button" class="btn-secondary" :disabled="exportingData" @click="handleExportData">
          {{ exportingData ? t('buyerSettings.exporting') : t('buyerSettings.exportButton') }}
        </button>
      </section>

      <!-- Compte -->
      <section>
        <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerSettings.accountTitle') }}</h2>

        <p v-if="deleteRequestSent" class="mb-3 border border-tikeo-success/30 bg-tikeo-success/10 px-4 py-3 text-sm text-tikeo-success">
          {{ t('buyerSettings.deleteRequestSent') }}
        </p>

        <template v-else>
          <p class="mb-2 text-sm text-tikeo-gray-text">{{ t('buyerSettings.deleteAccountText') }}</p>
          <div class="flex flex-wrap items-center gap-4">
            <button type="button" class="text-sm font-semibold text-tikeo-error hover:underline" @click="showDeleteModal = true">
              {{ t('buyerSettings.deleteAccountButton') }}
            </button>
            <NuxtLink to="/contact" class="text-sm font-semibold text-tikeo-orange hover:underline">
              {{ t('buyerSettings.contactSupport') }}
            </NuxtLink>
          </div>
        </template>
      </section>
    </div>

    <!-- Modale de confirmation de suppression de compte -->
    <div v-if="showDeleteModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h2 class="mb-2 text-sm font-bold text-tikeo-black">{{ t('buyerSettings.deleteModalTitle') }}</h2>
        <p class="mb-4 text-xs text-tikeo-gray-text">{{ t('buyerSettings.deleteModalText') }}</p>
        <p v-if="deleteError" class="mb-3 border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-tikeo-error">{{ deleteError }}</p>
        <textarea
          v-model="deleteReason"
          rows="3"
          class="input-field mb-4 resize-none"
          :placeholder="t('buyerSettings.deleteModalReasonPlaceholder')"
        />
        <div class="flex gap-2">
          <button type="button" class="btn-secondary flex-1 text-sm" @click="showDeleteModal = false">
            {{ t('buyerSettings.deleteModalCancel') }}
          </button>
          <button
            type="button"
            class="flex-1 border border-tikeo-error bg-tikeo-error px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-60"
            :disabled="sendingDeleteRequest"
            @click="submitDeleteRequest"
          >
            {{ sendingDeleteRequest ? t('buyerSettings.deleteModalSending') : t('buyerSettings.deleteModalConfirm') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
