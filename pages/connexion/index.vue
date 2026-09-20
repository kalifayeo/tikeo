<script setup lang="ts">
const { t } = useI18n()
const { loginWithPassword, requestOtp, verifyOtp } = useAuth()
const router = useRouter()
const route = useRoute()

// Bug corrigé : le middleware auth.ts redirige vers /connexion?redirect=...
// mais cette page ignorait toujours ce paramètre et renvoyait systématiquement
// vers /mon-espace/tableau-de-bord, même quand l'utilisateur venait d'une
// page précise (ex: favoris depuis une carte événement).
const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/')) return target
  return '/mon-espace/tableau-de-bord'
})

const mode = ref<'password' | 'otp'>('password')
const step = ref<'form' | 'otp-sent'>('form')

const email = ref('')
const password = ref('')
const code = ref('')

const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

// Anti-robots Turnstile (inactif tant que NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide).
// Un seul widget pour toute la page : il sert aussi au renvoi du code.
const { token: captchaToken, widget, ready: captchaReady, onVerify, onExpire, reset: resetCaptcha } = useCaptcha()

async function submitPasswordLogin() {
  errorMessage.value = ''
  if (!captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  loading.value = true
  try {
    await loginWithPassword(email.value, password.value, captchaToken.value)
    router.push(redirectTarget.value)
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.loginError')
  } finally {
    loading.value = false
    resetCaptcha() // le jeton est à usage unique
  }
}

async function submitRequestOtp() {
  errorMessage.value = ''
  if (!captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  loading.value = true
  try {
    await requestOtp(email.value, 'login', captchaToken.value)
    step.value = 'otp-sent'
    infoMessage.value = t('auth.otpSentInfo')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpSendError')
  } finally {
    loading.value = false
    resetCaptcha()
  }
}

async function submitVerifyOtp() {
  errorMessage.value = ''
  loading.value = true
  try {
    await verifyOtp(email.value, code.value, 'login')
    router.push(redirectTarget.value)
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpVerifyError')
  } finally {
    loading.value = false
  }
}

function switchMode(next: 'password' | 'otp') {
  mode.value = next
  step.value = 'form'
  errorMessage.value = ''
  infoMessage.value = ''
}
</script>

<template>
  <AuthSplitLayout :title="t('auth.loginTitle')" :subtitle="t('auth.loginSubtitle')">
    <div class="mb-5 flex bg-tikeo-surface-alt p-1 text-sm font-medium">
      <button
        type="button"
        class="flex-1 py-2 transition"
        :class="mode === 'password' ? 'bg-tikeo-surface shadow-card text-tikeo-black' : 'text-tikeo-gray-text'"
        @click="switchMode('password')"
      >
        {{ t('auth.tabPassword') }}
      </button>
      <button
        type="button"
        class="flex-1 py-2 transition"
        :class="mode === 'otp' ? 'bg-tikeo-surface shadow-card text-tikeo-black' : 'text-tikeo-gray-text'"
        @click="switchMode('otp')"
      >
        {{ t('auth.tabEmailCode') }}
      </button>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="mb-4 border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-tikeo-blue dark:bg-blue-500/10">{{ infoMessage }}</p>

    <!-- Anti-robots : présent sur toute la page (connexion et renvoi du code) -->
    <TurnstileWidget ref="widget" class="mb-4" @verify="onVerify" @expire="onExpire" />

    <!-- Connexion par mot de passe -->
    <form v-if="mode === 'password'" class="flex flex-col gap-4" @submit.prevent="submitPasswordLogin">
      <input
        v-model="email"
        type="email"
        name="email"
        autocomplete="username"
        required
        maxlength="254"
        :placeholder="t('auth.emailPlaceholder')"
        :aria-label="t('auth.emailPlaceholder')"
        class="input-field"
      />
      <input
        v-model="password"
        type="password"
        name="password"
        autocomplete="current-password"
        required
        maxlength="72"
        :placeholder="t('auth.passwordPlaceholder')"
        :aria-label="t('auth.passwordPlaceholder')"
        class="input-field"
      />
      <NuxtLink to="/mot-de-passe-oublie" class="self-end text-xs font-medium text-tikeo-blue">
        {{ t('auth.forgotPasswordLink') }}
      </NuxtLink>
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.loggingIn') : t('auth.login') }}
      </button>
    </form>

    <!-- Connexion par code OTP -->
    <form v-else-if="step === 'form'" class="flex flex-col gap-4" @submit.prevent="submitRequestOtp">
      <input
        v-model="email"
        type="email"
        name="email"
        autocomplete="email"
        required
        maxlength="254"
        :placeholder="t('auth.emailPlaceholder')"
        :aria-label="t('auth.emailPlaceholder')"
        class="input-field"
      />
      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.sendingCode') : t('auth.sendCode') }}
      </button>
    </form>
    <form v-else class="flex flex-col gap-4" @submit.prevent="submitVerifyOtp">
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
      <button type="button" class="text-xs font-medium text-tikeo-blue" @click="submitRequestOtp">
        {{ t('auth.resendCode') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-tikeo-gray-text">
      {{ t('auth.noAccount') }}
      <NuxtLink :to="{ path: '/inscription', query: route.query }" class="font-semibold text-tikeo-orange">{{ t('auth.register') }}</NuxtLink>
    </p>
  </AuthSplitLayout>
</template>
