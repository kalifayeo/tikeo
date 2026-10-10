<script setup lang="ts">
const { t } = useI18n()
const { loginWithPassword, requestOtp, verifyOtp } = useAuth()
const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()

// Message d'erreur pour un compte suspendu/supprimé : soit la connexion vient
// d'échouer pour cette raison (SUSPENDED_ACCOUNT / DELETED_ACCOUNT, cf.
// composables/useAuth.ts), soit l'utilisateur était déjà connecté ailleurs
// et vient d'être déconnecté automatiquement (authStore.lockedReason, mis à
// jour par fetchProfile()).
function describeError(e: any): string {
  const code = e?.message || e?.data?.statusMessage
  if (code === 'SUSPENDED_ACCOUNT') return t('auth.accountSuspended')
  if (code === 'DELETED_ACCOUNT') return t('auth.accountDeleted')
  return e?.data?.statusMessage || e?.message || t('auth.loginError')
}

onMounted(() => {
  if (authStore.lockedReason) {
    errorMessage.value = authStore.lockedReason === 'deleted' ? t('auth.accountDeleted') : t('auth.accountSuspended')
    authStore.lockedReason = null
  }
})

// Bug corrigé : le middleware auth.ts redirige vers /connexion?redirect=...
// mais cette page ignorait toujours ce paramètre et renvoyait systématiquement
// vers /mon-espace/tableau-de-bord, même quand l'utilisateur venait d'une
// page précise (ex: favoris depuis une carte événement).
const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/')) return target
  return '/mon-espace/tableau-de-bord'
})

const modes = ['password', 'otp'] as const
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

// La double authentification (2FA) ne concerne QUE les administrateurs, et
// uniquement pour entrer dans le panneau d'administration : elle est demandée
// par middleware/admin.ts (page /admin/verification-2fa). La connexion au
// site (clients, organisateurs, agents) ne la demande jamais.
async function proceedAfterLogin() {
  // Un administrateur arrivé sans destination précise est dirigé vers son
  // panneau ; le middleware admin enchaînera avec la vérification 2FA.
  if (!route.query.redirect && authStore.profile?.role === 'admin') {
    await router.push('/admin')
    return
  }
  await router.push(redirectTarget.value)
}

async function submitPasswordLogin() {
  errorMessage.value = ''
  if (!captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  loading.value = true
  try {
    await loginWithPassword(email.value, password.value, captchaToken.value)
    await proceedAfterLogin()
  } catch (e: any) {
    errorMessage.value = describeError(e)
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
    await proceedAfterLogin()
  } catch (e: any) {
    errorMessage.value = e?.message === 'SUSPENDED_ACCOUNT' ? t('auth.accountSuspended') : e?.data?.statusMessage || e?.message || t('auth.otpVerifyError')
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
    <!-- Choix du mode de connexion -->
    <div class="mb-6 grid grid-cols-2 gap-2">
      <button
        v-for="m in modes"
        :key="m"
        type="button"
        class="flex h-11 items-center justify-center gap-2 border px-3 text-sm font-semibold transition-colors duration-200"
        :class="
          mode === m
            ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink'
            : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'
        "
        @click="switchMode(m)"
      >
        <AppIcon :name="m === 'password' ? 'lock' : 'mail'" class="h-4 w-4" />
        {{ m === 'password' ? t('auth.tabPassword') : t('auth.tabEmailCode') }}
      </button>
    </div>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="acc-alert-info mb-4">{{ infoMessage }}</p>

    <!-- Anti-robots : présent sur toute la page (connexion et renvoi du code) -->
    <TurnstileWidget ref="widget" class="mb-4" @verify="onVerify" @expire="onExpire" />

    <!-- Connexion par mot de passe -->
    <form v-if="mode === 'password' && step === 'form'" class="flex flex-col gap-5" @submit.prevent="submitPasswordLogin">
      <AuthField
        v-model="email"
        :label="t('auth.emailPlaceholder')"
        type="email"
        name="email"
        autocomplete="username"
        required
        maxlength="254"
      />
      <div>
        <AuthField
          v-model="password"
          :label="t('auth.passwordPlaceholder')"
          type="password"
          name="password"
          autocomplete="current-password"
          required
          maxlength="72"
        />
        <NuxtLink to="/mot-de-passe-oublie" class="mt-2 inline-block text-xs font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] transition-colors hover:text-tikeo-orange">
          {{ t('auth.forgotPasswordLink') }}
        </NuxtLink>
      </div>
      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.loggingIn') : t('auth.login') }}
        <AppIcon v-if="!loading" name="arrow-right" class="h-4 w-4" :stroke="2.4" />
      </button>
    </form>

    <!-- Connexion par code OTP : demande du code -->
    <form v-else-if="step === 'form'" class="flex flex-col gap-5" @submit.prevent="submitRequestOtp">
      <AuthField
        v-model="email"
        :label="t('auth.emailPlaceholder')"
        type="email"
        name="email"
        autocomplete="email"
        required
        maxlength="254"
      />
      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.sendingCode') : t('auth.sendCode') }}
        <AppIcon v-if="!loading" name="arrow-right" class="h-4 w-4" :stroke="2.4" />
      </button>
    </form>

    <!-- Connexion par code OTP : saisie du code reçu -->
    <form v-else class="flex flex-col gap-5" @submit.prevent="submitVerifyOtp">
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
      <button type="button" class="text-xs font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[5px] transition-colors hover:text-tikeo-orange" @click="submitRequestOtp">
        {{ t('auth.resendCode') }}
      </button>
    </form>

    <!-- Pas de compte ? -->
    <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-tikeo-gray-text/25 pt-6">
      <p class="text-sm text-tikeo-gray-text">{{ t('auth.noAccount') }}</p>
      <NuxtLink :to="{ path: '/inscription', query: route.query }" class="acc-btn-ghost !h-10">
        <AppIcon name="user-plus" class="h-4 w-4" />
        {{ t('auth.register') }}
      </NuxtLink>
    </div>
  </AuthSplitLayout>
</template>
