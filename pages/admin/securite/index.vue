<script setup lang="ts">
// Page « gate » volontairement hors de la mise en page admin habituelle
// (pas de menu, pas de données) : tant que le 2FA n'est pas en place, rien
// d'autre de l'administration ne doit être visible à l'écran.
definePageMeta({ layout: false, middleware: 'admin' })

import type { AdminMfaFactor } from '~/composables/useAdminMfa'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { signOut } = useAuth()
const { listFactors, startEnroll, confirmEnroll, disable, abortEnroll } = useAdminMfa()

const loading = ref(true)
const factors = ref<AdminMfaFactor[]>([])
const forced = computed(() => route.query.setup === '1')
const redirectTo = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'))

const step = ref<'status' | 'enroll' | 'disable'>('status')
const pendingFactorId = ref<string | null>(null)
const qrCode = ref('')
const secret = ref('')
const code = ref('')
const disableCode = ref('')
const submitting = ref(false)
const errorMsg = ref('')

async function refresh() {
  loading.value = true
  try {
    factors.value = await listFactors()
    step.value = 'status'
  } catch (e: any) {
    errorMsg.value = e?.message || t('adminMfa.loadError')
  } finally {
    loading.value = false
  }
}
onMounted(async () => {
  await refresh()
  // Aucun facteur et arrivée forcée depuis le middleware : lance directement l'inscription.
  if (forced.value && !factors.value.length) await beginEnroll()
})

// Un message clair plutôt que le texte brut de Supabase
function enrollMessage(e: any) {
  const msg = String(e?.message || '')
  if (/disabled|not enabled|not allowed/i.test(msg)) return t('adminMfa.enrollDisabled')
  return msg ? `${t('adminMfa.enrollError')} (${msg})` : t('adminMfa.enrollError')
}

const secretCopied = ref(false)
async function copySecret() {
  try {
    await navigator.clipboard.writeText(secret.value)
    secretCopied.value = true
    setTimeout(() => (secretCopied.value = false), 2000)
  } catch {
    /* le secret reste sélectionnable à la main */
  }
}
const codeInvalid = ref(false)
function flagInvalid() {
  codeInvalid.value = true
  setTimeout(() => (codeInvalid.value = false), 600)
}

async function beginEnroll() {
  if (submitting.value) return
  errorMsg.value = ''
  submitting.value = true
  try {
    const r = await startEnroll()
    pendingFactorId.value = r.factorId
    qrCode.value = r.qrCode
    secret.value = r.secret
    code.value = ''
    step.value = 'enroll'
  } catch (e: any) {
    errorMsg.value = enrollMessage(e)
  } finally {
    submitting.value = false
  }
}

async function cancelEnroll() {
  if (pendingFactorId.value) await abortEnroll(pendingFactorId.value)
  pendingFactorId.value = null
  step.value = 'status'
}

async function submitEnroll() {
  if (submitting.value || !pendingFactorId.value || code.value.trim().length < 6) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await confirmEnroll(pendingFactorId.value, code.value)
    pendingFactorId.value = null
    await writeAuditLog({ action: 'ADMIN_MFA_ENABLED', entityType: 'profiles' })
    await refresh()
    if (forced.value) await router.push(redirectTo.value)
  } catch (e: any) {
    errorMsg.value = t('adminMfa.codeInvalid')
    code.value = ''
    flagInvalid()
  } finally {
    submitting.value = false
  }
}

function askDisable() {
  errorMsg.value = ''
  disableCode.value = ''
  step.value = 'disable'
}

async function submitDisable(factor: AdminMfaFactor) {
  if (submitting.value || disableCode.value.trim().length < 6) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await disable(factor.id, disableCode.value)
    await writeAuditLog({ action: 'ADMIN_MFA_DISABLED', entityType: 'profiles' })
    await refresh()
  } catch {
    errorMsg.value = t('adminMfa.codeInvalid')
    disableCode.value = ''
    flagInvalid()
  } finally {
    submitting.value = false
  }
}

async function handleLogout() {
  await signOut()
  router.push('/connexion')
}
</script>

<template>
  <AdminGate :title="t('adminMfa.title')" :subtitle="forced ? t('adminMfa.forcedSubtitle') : undefined" icon="shield-check" :wide="step === 'enroll'">
    <div v-if="loading" class="flex flex-col items-center gap-3 py-8 text-sm text-tikeo-gray-text">
      <TikeoSpinner />
      {{ t('common.loading') }}
    </div>

    <!-- ================= Statut ================= -->
    <template v-else-if="step === 'status'">
      <div v-if="!factors.length">
        <p class="text-sm leading-relaxed text-tikeo-gray-text">{{ t('adminMfa.notEnrolledBody') }}</p>
        <p v-if="errorMsg" class="acc-alert-error mt-4 flex items-start gap-2 !text-xs"><AppIcon name="alert" class="mt-0.5 h-4 w-4 shrink-0" />{{ errorMsg }}</p>
        <button type="button" class="btn-ink mt-5 !h-12 w-full" :disabled="submitting" @click="beginEnroll">
          <svg v-if="submitting" class="h-[18px] w-[18px] animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" /><path d="M21 12a9 9 0 00-9-9" stroke="currentColor" stroke-width="3" stroke-linecap="round" /></svg>
          <AppIcon v-else name="lock" class="h-[18px] w-[18px]" />
          {{ t('adminMfa.startEnroll') }}
        </button>
      </div>
      <div v-else>
        <div class="flex items-center gap-3 border-l-4 border-tikeo-success bg-tikeo-success/10 p-4">
          <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-success text-white"><AppIcon name="check" class="h-6 w-6" :stroke="2.6" /></span>
          <div>
            <p class="text-sm font-bold text-tikeo-success">{{ t('adminMfa.enabledTitle') }}</p>
            <p class="text-xs text-tikeo-success/80">{{ t('adminMfa.enabledSince', { date: new Date(factors[0].createdAt).toLocaleDateString() }) }}</p>
          </div>
        </div>
        <button type="button" class="acc-btn-danger mt-5 w-full" @click="askDisable">{{ t('adminMfa.disable') }}</button>
      </div>
    </template>

    <!-- ================= Inscription ================= -->
    <template v-else-if="step === 'enroll'">
      <div class="grid gap-6 sm:grid-cols-[auto_1fr] sm:items-start">
        <div class="mx-auto">
          <p class="acc-label mb-2 flex items-center gap-2"><span class="flex h-5 w-5 items-center justify-center bg-tikeo-ink text-[11px] text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">1</span>{{ t('adminMfa.enrollStep1').replace(/^1\.\s*/, '') }}</p>
          <img :src="qrCode" :alt="t('adminMfa.qrAlt')" class="mx-auto h-44 w-44 border border-tikeo-border bg-white p-2" />
        </div>
        <div class="min-w-0">
          <p class="acc-label mb-2">{{ t('adminMfa.manualEntry') }}</p>
          <button type="button" class="group flex w-full items-center justify-between gap-2 border border-dashed border-tikeo-border bg-tikeo-surface-alt px-3 py-2.5 text-left transition-colors hover:border-tikeo-ink dark:hover:border-[#FF7A00]" @click="copySecret">
            <span class="break-all font-mono text-xs font-bold tracking-wider text-tikeo-black">{{ secret }}</span>
            <AppIcon :name="secretCopied ? 'check' : 'copy'" class="h-4 w-4 shrink-0" :class="secretCopied ? 'text-tikeo-success' : 'text-tikeo-gray-text'" />
          </button>
        </div>
      </div>

      <div class="mt-6 border-t border-dashed border-tikeo-border pt-6">
        <p class="acc-label mb-3 flex items-center gap-2"><span class="flex h-5 w-5 items-center justify-center bg-tikeo-ink text-[11px] text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">2</span>{{ t('adminMfa.enrollStep2').replace(/^2\.\s*/, '') }}</p>
        <OtpInput v-model="code" autofocus :invalid="codeInvalid" :disabled="submitting" @complete="submitEnroll" />
        <p v-if="errorMsg" class="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-tikeo-error"><AppIcon name="alert" class="h-4 w-4" />{{ errorMsg }}</p>
      </div>

      <div class="mt-6 flex gap-3">
        <button type="button" class="acc-btn-ghost flex-1" @click="cancelEnroll">{{ t('adminEngagement.cancel') }}</button>
        <button type="button" class="btn-ink flex-1" :disabled="submitting || code.trim().length < 6" @click="submitEnroll">
          {{ submitting ? t('common.loading') : t('adminMfa.confirm') }}
        </button>
      </div>
    </template>

    <!-- ================= Désactivation ================= -->
    <template v-else-if="step === 'disable'">
      <p class="mb-4 text-center text-sm leading-relaxed text-tikeo-gray-text">{{ t('adminMfa.disableBody') }}</p>
      <OtpInput v-model="disableCode" autofocus :invalid="codeInvalid" :disabled="submitting" @complete="submitDisable(factors[0])" />
      <p v-if="errorMsg" class="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-tikeo-error"><AppIcon name="alert" class="h-4 w-4" />{{ errorMsg }}</p>
      <div class="mt-6 flex gap-3">
        <button type="button" class="acc-btn-ghost flex-1" @click="step = 'status'">{{ t('adminEngagement.cancel') }}</button>
        <button type="button" class="flex h-10 flex-1 items-center justify-center bg-tikeo-error text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-50" :disabled="submitting || disableCode.trim().length < 6" @click="submitDisable(factors[0])">
          {{ submitting ? t('common.loading') : t('adminMfa.confirmDisable') }}
        </button>
      </div>
    </template>

    <template #footer>
      <NuxtLink v-if="!forced" to="/admin" class="group flex items-center gap-1.5 transition-colors hover:text-[#FF7A00]">
        <AppIcon name="arrow-left" class="h-4 w-4 transition-transform duration-300 group-hover:-translate-x-1" />{{ t('common.back') }}
      </NuxtLink>
      <span v-else />
      <button type="button" class="flex items-center gap-1.5 transition-colors hover:text-[#FF7A00]" @click="handleLogout">
        <AppIcon name="logout" class="h-4 w-4" />{{ t('adminNav.logout') }}
      </button>
    </template>
  </AdminGate>
</template>
