<script setup lang="ts">
const { t } = useI18n()
const { register, verifyOtp } = useAuth()
const router = useRouter()
const route = useRoute()

const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target === 'string' && target.startsWith('/')) return target
  return '/mon-espace/tableau-de-bord'
})

const step = ref<'form' | 'otp'>('form')

const fullName = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')
const code = ref('')

// Acceptation des CGU + politique de confidentialité (obligatoire).
const acceptTerms = ref(false)

// Honeypot : champ invisible que seuls les robots remplissent. S'il est
// rempli, on fait semblant de réussir sans rien envoyer (comme /api/contact).
const website = ref('')

// Anti-robots Turnstile (inactif tant que NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide).
const { token: captchaToken, widget, ready: captchaReady, onVerify, onExpire, reset: resetCaptcha } = useCaptcha()

const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

async function submitRegister() {
  errorMessage.value = ''
  if (!acceptTerms.value) {
    errorMessage.value = t('auth.mustAcceptTerms')
    return
  }
  if (website.value) {
    step.value = 'otp'
    infoMessage.value = t('auth.registerOtpInfo')
    return
  }
  if (!captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }

  loading.value = true
  try {
    await register({
      fullName: fullName.value,
      email: email.value,
      phone: phone.value || undefined,
      password: password.value || undefined,
      captchaToken: captchaToken.value,
    })
    step.value = 'otp'
    infoMessage.value = t('auth.registerOtpInfo')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.registerError')
  } finally {
    loading.value = false
    resetCaptcha() // le jeton est à usage unique
  }
}

async function submitVerify() {
  errorMessage.value = ''
  loading.value = true
  try {
    await verifyOtp(email.value, code.value, 'signup')
    router.push(redirectTarget.value)
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.otpVerifyError')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthSplitLayout :title="t('auth.registerTitle')" :subtitle="t('auth.registerSubtitle')">
    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="mb-4 border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-tikeo-blue dark:bg-blue-500/10">{{ infoMessage }}</p>

    <form v-if="step === 'form'" class="flex flex-col gap-4" @submit.prevent="submitRegister">
      <input
        v-model="fullName"
        type="text"
        name="name"
        autocomplete="name"
        required
        maxlength="120"
        :placeholder="t('auth.fullNamePlaceholder')"
        :aria-label="t('auth.fullNamePlaceholder')"
        class="input-field"
      />
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
      <input
        v-model="phone"
        type="tel"
        name="tel"
        autocomplete="tel"
        maxlength="30"
        :placeholder="t('auth.phonePlaceholder')"
        :aria-label="t('auth.phonePlaceholder')"
        class="input-field"
      />
      <input
        v-model="password"
        type="password"
        name="new-password"
        autocomplete="new-password"
        minlength="8"
        maxlength="72"
        :placeholder="t('auth.passwordOptionalPlaceholder')"
        :aria-label="t('auth.passwordOptionalPlaceholder')"
        class="input-field"
      />

      <!-- Honeypot anti-spam : invisible pour un humain, tentant pour un robot -->
      <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <label class="flex items-start gap-2.5 text-xs leading-relaxed text-tikeo-gray-text">
        <input
          v-model="acceptTerms"
          type="checkbox"
          required
          class="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--tikeo-orange-strong))]"
        />
        <span>
          {{ t('auth.termsConsentPrefix') }}
          <NuxtLink to="/conditions" target="_blank" class="font-semibold text-tikeo-blue underline">{{ t('auth.termsConsentTerms') }}</NuxtLink>
          {{ t('auth.termsConsentAnd') }}
          <NuxtLink to="/confidentialite" target="_blank" class="font-semibold text-tikeo-blue underline">{{ t('auth.termsConsentPrivacy') }}</NuxtLink>
        </span>
      </label>

      <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />

      <button type="submit" class="btn-primary w-full" :disabled="loading">
        {{ loading ? t('auth.creatingAccount') : t('auth.createAccount') }}
      </button>
    </form>

    <form v-else class="flex flex-col gap-4" @submit.prevent="submitVerify">
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
        {{ loading ? t('auth.confirmingAccount') : t('auth.confirmAccount') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-tikeo-gray-text">
      {{ t('auth.haveAccount') }}
      <NuxtLink :to="{ path: '/connexion', query: route.query }" class="font-semibold text-tikeo-orange">{{ t('auth.login') }}</NuxtLink>
    </p>
  </AuthSplitLayout>
</template>
