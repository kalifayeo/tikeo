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
    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>
    <p v-if="infoMessage" class="acc-alert-info mb-4">{{ infoMessage }}</p>

    <form v-if="step === 'form'" class="flex flex-col gap-5" @submit.prevent="submitRegister">
      <AuthField
        v-model="fullName"
        :label="t('auth.fullNamePlaceholder')"
        type="text"
        name="name"
        autocomplete="name"
        required
        maxlength="120"
      />
      <AuthField
        v-model="email"
        :label="t('auth.emailPlaceholder')"
        type="email"
        name="email"
        autocomplete="email"
        required
        maxlength="254"
      />
      <AuthField
        v-model="phone"
        :label="t('auth.phonePlaceholder')"
        type="tel"
        name="tel"
        autocomplete="tel"
        maxlength="30"
      />
      <AuthField
        v-model="password"
        :label="t('auth.passwordOptionalPlaceholder')"
        type="password"
        name="new-password"
        autocomplete="new-password"
        minlength="8"
        maxlength="72"
      />

      <!-- Honeypot anti-spam : invisible pour un humain, tentant pour un robot -->
      <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
        <input v-model="website" type="text" name="website" tabindex="-1" autocomplete="off" />
      </div>

      <label class="flex items-start gap-3 border border-tikeo-border bg-tikeo-surface-alt/60 p-3.5 text-xs leading-relaxed text-tikeo-gray-text">
        <input
          v-model="acceptTerms"
          type="checkbox"
          required
          class="mt-0.5 h-4 w-4 shrink-0 accent-[rgb(var(--tikeo-orange-strong))]"
        />
        <span>
          {{ t('auth.termsConsentPrefix') }}
          <NuxtLink to="/conditions" target="_blank" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">{{ t('auth.termsConsentTerms') }}</NuxtLink>
          {{ t('auth.termsConsentAnd') }}
          <NuxtLink to="/confidentialite" target="_blank" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-[3px]">{{ t('auth.termsConsentPrivacy') }}</NuxtLink>
        </span>
      </label>

      <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />

      <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="loading">
        {{ loading ? t('auth.creatingAccount') : t('auth.createAccount') }}
        <AppIcon v-if="!loading" name="arrow-right" class="h-4 w-4" :stroke="2.4" />
      </button>
    </form>

    <form v-else class="flex flex-col gap-5" @submit.prevent="submitVerify">
      <div class="flex items-start gap-3 border-l-4 border-[#FF7A00] bg-tikeo-surface-alt px-4 py-3">
        <AppIcon name="mail" class="mt-0.5 h-5 w-5 shrink-0 text-tikeo-orange" />
        <p class="text-sm leading-relaxed text-tikeo-black">{{ email }}</p>
      </div>
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
        {{ loading ? t('auth.confirmingAccount') : t('auth.confirmAccount') }}
      </button>
    </form>

    <div class="mt-8 flex flex-wrap items-center justify-between gap-3 border-t-2 border-dashed border-tikeo-gray-text/25 pt-6">
      <p class="text-sm text-tikeo-gray-text">{{ t('auth.haveAccount') }}</p>
      <NuxtLink :to="{ path: '/connexion', query: route.query }" class="acc-btn-ghost !h-10">
        <AppIcon name="login" class="h-4 w-4" />
        {{ t('auth.login') }}
      </NuxtLink>
    </div>
  </AuthSplitLayout>
</template>
