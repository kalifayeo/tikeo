<script setup lang="ts">
// Page « gate » volontairement hors de la mise en page admin habituelle
// (pas de menu, pas de données) : tant que le 2FA n'est pas en place, rien
// d'autre de l'administration ne doit être visible à l'écran.
definePageMeta({ layout: false, middleware: 'admin' })

import type { MfaFactor } from '~/composables/useAdminMfa'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { signOut } = useAuth()
const { listFactors, startEnroll, confirmEnroll, disable, abortEnroll } = useAdminMfa()

const loading = ref(true)
const factors = ref<MfaFactor[]>([])
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

async function beginEnroll() {
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
    errorMsg.value = e?.message || t('adminMfa.enrollError')
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
  if (!pendingFactorId.value || code.value.trim().length < 6) return
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
  } finally {
    submitting.value = false
  }
}

function askDisable() {
  errorMsg.value = ''
  disableCode.value = ''
  step.value = 'disable'
}

async function submitDisable(factor: MfaFactor) {
  if (disableCode.value.trim().length < 6) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await disable(factor.id, disableCode.value)
    await writeAuditLog({ action: 'ADMIN_MFA_DISABLED', entityType: 'profiles' })
    await refresh()
  } catch {
    errorMsg.value = t('adminMfa.codeInvalid')
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
  <div class="flex min-h-screen items-center justify-center bg-tikeo-gray-light px-4 py-10">
    <div class="w-full max-w-md">
      <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto" />
        <h1 class="text-lg font-bold text-tikeo-black">{{ t('adminMfa.title') }}</h1>
        <p v-if="forced" class="text-xs text-tikeo-gray-text">{{ t('adminMfa.forcedSubtitle') }}</p>
      </div>

      <div class="border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
        <div v-if="loading" class="py-8 text-center text-sm text-tikeo-gray-text">{{ t('common.loading') }}</div>

        <!-- ================= Statut ================= -->
        <template v-else-if="step === 'status'">
          <div v-if="!factors.length">
            <p class="text-sm text-tikeo-gray-text">{{ t('adminMfa.notEnrolledBody') }}</p>
            <button type="button" class="btn-primary mt-4 w-full" :disabled="submitting" @click="beginEnroll">{{ t('adminMfa.startEnroll') }}</button>
          </div>
          <div v-else>
            <div class="flex items-center gap-3 border border-green-500/30 bg-green-500/10 p-3">
              <span class="flex h-9 w-9 shrink-0 items-center justify-center bg-green-600 text-white">✓</span>
              <div>
                <p class="text-sm font-bold text-green-700">{{ t('adminMfa.enabledTitle') }}</p>
                <p class="text-xs text-green-700/80">{{ t('adminMfa.enabledSince', { date: new Date(factors[0].createdAt).toLocaleDateString() }) }}</p>
              </div>
            </div>
            <button type="button" class="mt-4 w-full border border-tikeo-error/40 py-2 text-xs font-semibold text-tikeo-error hover:bg-tikeo-error/5" @click="askDisable">
              {{ t('adminMfa.disable') }}
            </button>
          </div>
        </template>

        <!-- ================= Inscription ================= -->
        <template v-else-if="step === 'enroll'">
          <p class="text-sm text-tikeo-gray-text">{{ t('adminMfa.enrollStep1') }}</p>
          <div class="my-4 flex justify-center">
            <img :src="qrCode" :alt="t('adminMfa.qrAlt')" class="h-44 w-44 border border-tikeo-border p-2" />
          </div>
          <p class="mb-1 text-center text-[11px] text-tikeo-gray-text">{{ t('adminMfa.manualEntry') }}</p>
          <p class="mb-4 break-all rounded bg-tikeo-gray-light px-2 py-1.5 text-center font-mono text-xs text-tikeo-black">{{ secret }}</p>

          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminMfa.enrollStep2') }}</label>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="input-field w-full text-center text-lg tracking-[0.4em]"
            placeholder="000000"
            @keyup.enter="submitEnroll"
          />
          <p v-if="errorMsg" class="mt-2 text-xs font-medium text-tikeo-error">{{ errorMsg }}</p>

          <div class="mt-4 flex gap-2">
            <button type="button" class="btn-secondary flex-1" @click="cancelEnroll">{{ t('adminEngagement.cancel') }}</button>
            <button type="button" class="btn-primary flex-1" :disabled="submitting || code.trim().length < 6" @click="submitEnroll">
              {{ submitting ? t('common.loading') : t('adminMfa.confirm') }}
            </button>
          </div>
        </template>

        <!-- ================= Désactivation ================= -->
        <template v-else-if="step === 'disable'">
          <p class="text-sm text-tikeo-gray-text">{{ t('adminMfa.disableBody') }}</p>
          <input
            v-model="disableCode"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            class="input-field mt-3 w-full text-center text-lg tracking-[0.4em]"
            placeholder="000000"
            @keyup.enter="submitDisable(factors[0])"
          />
          <p v-if="errorMsg" class="mt-2 text-xs font-medium text-tikeo-error">{{ errorMsg }}</p>
          <div class="mt-4 flex gap-2">
            <button type="button" class="btn-secondary flex-1" @click="step = 'status'">{{ t('adminEngagement.cancel') }}</button>
            <button type="button" class="flex-1 bg-tikeo-error py-2.5 text-sm font-semibold text-white disabled:opacity-50" :disabled="submitting || disableCode.trim().length < 6" @click="submitDisable(factors[0])">
              {{ submitting ? t('common.loading') : t('adminMfa.confirmDisable') }}
            </button>
          </div>
        </template>
      </div>

      <div class="mt-4 flex items-center justify-between text-xs">
        <NuxtLink v-if="!forced" to="/admin" class="font-semibold text-tikeo-gray-text hover:text-tikeo-orange">← {{ t('common.back') }}</NuxtLink>
        <span v-else />
        <button type="button" class="font-semibold text-tikeo-gray-text hover:text-tikeo-orange" @click="handleLogout">{{ t('adminNav.logout') }}</button>
      </div>
    </div>
  </div>
</template>
