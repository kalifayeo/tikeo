<script setup lang="ts">
const { t } = useI18n()
const { requestOtp, verifyOtp, resetPassword } = useAuth()
const router = useRouter()

const step = ref<'request' | 'verify' | 'reset'>('request')

// Barre de progression : email → code → nouveau mot de passe.
const steps = computed(() => [
  { label: t('authLayout.stepEmail') },
  { label: t('authLayout.stepCode') },
  { label: t('authLayout.stepPassword') },
])
const currentStepIndex = computed(() => ({ request: 0, verify: 1, reset: 2 })[step.value])

const email = ref('')
const code = ref('')
const newPassword = ref('')

const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

// Anti-robots Turnstile (inactif tant que NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide).
const { token: captchaToken, widget, ready: captchaReady, onVerify, onExpire, reset: resetCaptcha } = useCaptcha()

async function submitRequest() {
  errorMessage.value = ''
  if (!captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  loading.value = true
  try {
    await requestOtp(email.value, 'reset_password', captchaToken.value)
    step.value = 'verify'
    infoMessage.value = t('auth.forgotOtpInfo')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpSendError')
  } finally {
    loading.value = false
    resetCaptcha()
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
    <!-- Progression : email → code → nouveau mot de passe -->
    <ol class="mb-7 grid grid-cols-3 gap-2" aria-hidden="true">
      <li v-for="(s, i) in steps" :key="s.label" class="min-w-0">
        <span class="block h-1 transition-colors duration-300" :class="i <= currentStepIndex ? 'bg-[#FF7A00]' : 'bg-tikeo-border'" />
        <span class="mt-2 block truncate text-[11px] font-bold uppercase tracking-wider" :class="i <= currentStepIndex ? 'text-tikeo-black' : 'text-tikeo-gray-text'">
          {{ i + 1 }}. {{ s.label }}
        </span>
      </li>
    </ol>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="acc-alert-info mb-4">{{ infoMessage }}</p>

    <form v-if="step === 'request'" class="flex flex-col gap-5" @submit.prevent="submitRequest">
      <AuthField
        v-model="email"
        :label="t('auth.emailPlaceholder')"
        type="email"
        name="email"
        autocomplete="email"
        required
        maxlength="254"
      />
      <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />
      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.sendingCode') : t('auth.sendCode') }}
        <AppIcon v-if="!loading" name="arrow-right" class="h-4 w-4" :stroke="2.4" />
      </button>
    </form>

    <form v-else-if="step === 'verify'" class="flex flex-col gap-5" @submit.prevent="submitVerify">
      <AuthField
        v-model="code"
        :label="t('auth.codePlaceholder')"
        type="text"
        inputmode="numeric"
        maxlength="10"
        required
        class="text-center font-mono text-xl tracking-[0.5em]"
      />
      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.verifying') : t('auth.verifyCode') }}
      </button>
    </form>

    <form v-else class="flex flex-col gap-5" @submit.prevent="submitReset">
      <AuthField
        v-model="newPassword"
        :label="t('auth.newPasswordPlaceholder')"
        type="password"
        name="new-password"
        autocomplete="new-password"
        minlength="8"
        maxlength="72"
        required
      />
      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.resetting') : t('auth.resetPassword') }}
      </button>
    </form>

    <div class="mt-8 border-t-2 border-dashed border-tikeo-gray-text/25 pt-6">
      <NuxtLink to="/connexion" class="inline-flex items-center gap-2 text-sm font-bold text-tikeo-black transition-colors hover:text-tikeo-orange">
        <AppIcon name="chevron-left" class="h-4 w-4" :stroke="2.4" />
        {{ t('auth.backToLogin') }}
      </NuxtLink>
    </div>
  </AuthSplitLayout>
</template>
