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
const codeInvalid = ref(false)
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
  if (submitting.value || !factorId.value || code.value.trim().length < 6) return
  errorMsg.value = ''
  submitting.value = true
  try {
    await verifySession(factorId.value, code.value)
    await writeAuditLog({ action: 'ADMIN_MFA_VERIFIED', entityType: 'profiles' })
    await router.push(redirectTo.value)
  } catch {
    errorMsg.value = t('adminMfa.codeInvalid')
    code.value = ''
    codeInvalid.value = true
    setTimeout(() => (codeInvalid.value = false), 600)
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
  <AdminGate :title="t('adminMfa.verifyTitle')" :subtitle="t('adminMfa.verifySubtitle')" icon="lock">
    <div v-if="loading" class="flex flex-col items-center gap-3 py-6 text-sm text-tikeo-gray-text">
      <TikeoSpinner />
      {{ t('common.loading') }}
    </div>
    <template v-else>
      <OtpInput v-model="code" autofocus :invalid="codeInvalid" :disabled="submitting" @complete="submit" />
      <p v-if="errorMsg" class="mt-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-tikeo-error"><AppIcon name="alert" class="h-4 w-4" />{{ errorMsg }}</p>
      <button type="button" class="btn-ink mt-6 !h-12 w-full" :disabled="submitting || code.trim().length < 6" @click="submit">
        {{ submitting ? t('common.loading') : t('adminMfa.verifyButton') }}
      </button>
    </template>

    <template #footer>
      <span />
      <button type="button" class="flex items-center gap-1.5 transition-colors hover:text-[#FF7A00]" @click="handleLogout">
        <AppIcon name="logout" class="h-4 w-4" />{{ t('adminNav.logout') }}
      </button>
    </template>
  </AdminGate>
</template>
