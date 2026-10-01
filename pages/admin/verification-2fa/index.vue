<script setup lang="ts">
// Étape de vérification à chaque nouvelle session admin (facteur déjà
// enregistré) : demande le code à 6 chiffres avant de laisser entrer.
definePageMeta({ layout: false, middleware: 'admin' })

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { signOut } = useAuth()
const { listFactors, verifySession } = useAdminMfa()

const loading = ref(true)
const factorId = ref<string | null>(null)
const code = ref('')
const submitting = ref(false)
const errorMsg = ref('')
const redirectTo = computed(() => (typeof route.query.redirect === 'string' ? route.query.redirect : '/admin'))

onMounted(async () => {
  try {
    const factors = await listFactors()
    factorId.value = factors[0]?.id ?? null
    // Aucun facteur enregistré malgré tout (cas limite) : retour à l'inscription.
    if (!factorId.value) await router.replace('/admin/securite')
  } finally {
    loading.value = false
  }
})

async function submit() {
  if (!factorId.value || code.value.trim().length < 6) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await verifySession(factorId.value, code.value)
    await router.push(redirectTo.value)
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
    <div class="w-full max-w-sm">
      <div class="mb-6 flex flex-col items-center gap-2 text-center">
        <img src="/logo-tikeo.png" alt="Tikeo" class="h-9 w-auto" />
        <h1 class="text-lg font-bold text-tikeo-black">{{ t('adminMfa.verifyTitle') }}</h1>
        <p class="text-xs text-tikeo-gray-text">{{ t('adminMfa.verifySubtitle') }}</p>
      </div>

      <div class="border border-tikeo-border bg-tikeo-surface p-6 shadow-card">
        <div v-if="loading" class="py-6 text-center text-sm text-tikeo-gray-text">{{ t('common.loading') }}</div>
        <template v-else>
          <input
            v-model="code"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="6"
            autofocus
            class="input-field w-full text-center text-xl tracking-[0.5em]"
            placeholder="000000"
            @keyup.enter="submit"
          />
          <p v-if="errorMsg" class="mt-2 text-xs font-medium text-tikeo-error">{{ errorMsg }}</p>
          <button type="button" class="btn-primary mt-4 w-full" :disabled="submitting || code.trim().length < 6" @click="submit">
            {{ submitting ? t('common.loading') : t('adminMfa.verifyButton') }}
          </button>
        </template>
      </div>

      <div class="mt-4 text-center">
        <button type="button" class="text-xs font-semibold text-tikeo-gray-text hover:text-tikeo-orange" @click="handleLogout">{{ t('adminNav.logout') }}</button>
      </div>
    </div>
  </div>
</template>
