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

const loading = ref(false)
const errorMessage = ref('')
const infoMessage = ref('')

async function submitRegister() {
  errorMessage.value = ''
  loading.value = true
  try {
    await register({
      fullName: fullName.value,
      email: email.value,
      phone: phone.value || undefined,
      password: password.value || undefined,
    })
    step.value = 'otp'
    infoMessage.value = t('auth.registerOtpInfo')
  } catch (e: any) {
    errorMessage.value = e?.message || e?.data?.statusMessage || t('auth.registerError')
  } finally {
    loading.value = false
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
      <input v-model="fullName" type="text" required :placeholder="t('auth.fullNamePlaceholder')" class="input-field" />
      <input v-model="email" type="email" required :placeholder="t('auth.emailPlaceholder')" class="input-field" />
      <input v-model="phone" type="tel" :placeholder="t('auth.phonePlaceholder')" class="input-field" />
      <input
        v-model="password"
        type="password"
        :placeholder="t('auth.passwordOptionalPlaceholder')"
        class="input-field"
      />
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
