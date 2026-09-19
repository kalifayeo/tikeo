<script setup lang="ts">
const { t } = useI18n()
const { requestOtp, verifyOtp, resetPassword } = useAuth()
const router = useRouter()

const step = ref<'request' | 'verify' | 'reset'>('request')

const email = ref('')
const code = ref('')
const newPassword = ref('')

const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

async function submitRequest() {
  errorMessage.value = ''
  loading.value = true
  try {
    await requestOtp(email.value, 'reset_password')
    step.value = 'verify'
    infoMessage.value = t('auth.forgotOtpInfo')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpSendError')
  } finally {
    loading.value = false
  }
}

async function submitVerify() {
  errorMessage.value = ''
  loading.value = true
  try {
    // La vérification du code ouvre déjà une session Supabase : l'étape
    // suivante peut directement définir le nouveau mot de passe.
    await verifyOtp(email.value, code.value, 'reset_password')
    step.value = 'reset'
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpVerifyError')
  } finally {
    loading.value = false
  }
}

async function submitReset() {
  errorMessage.value = ''
  loading.value = true
  try {
    await resetPassword(newPassword.value)
    router.push('/connexion')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.resetError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout :title="t('auth.forgotTitle')" :subtitle="t('auth.forgotSubtitle')">
    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="mb-4 border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-tikeo-blue dark:bg-blue-500/10">{{ infoMessage }}</p>

    <form v-if="step === 'request'" class="flex flex-col gap-4" @submit.prevent="submitRequest">
      <input v-model="email" type="email" required :placeholder="t('auth.emailPlaceholder')" class="input-field" />
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.sendingCode') : t('auth.sendCode') }}
      </button>
    </form>

    <form v-else-if="step === 'verify'" class="flex flex-col gap-4" @submit.prevent="submitVerify">
      <input
        v-model="code"
        type="text"
        inputmode="numeric"
        maxlength="10"
        required
        :placeholder="t('auth.codePlaceholder')"
        class="input-field text-center tracking-[0.5em]"
      />
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.verifying') : t('auth.verifyCode') }}
      </button>
    </form>

    <form v-else class="flex flex-col gap-4" @submit.prevent="submitReset">
      <input
        v-model="newPassword"
        type="password"
        required
        :placeholder="t('auth.newPasswordPlaceholder')"
        class="input-field"
      />
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.resetting') : t('auth.resetPassword') }}
      </button>
    </form>

    <NuxtLink to="/connexion" class="mt-6 block text-center text-sm font-semibold text-tikeo-orange">{{ t('auth.backToLogin') }}</NuxtLink>
  </AuthSplitLayout>
</template>
