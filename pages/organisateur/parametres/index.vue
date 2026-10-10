<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
const { t } = useI18n()

const supabase = useSupabase()
const { organizer, fetchOrganizer } = useOrganizer()

const loading = ref(true)
const saving = ref(false)
const errorMessage = ref('')
const successMessage = ref('')

const form = reactive({
  name: '',
  email: '',
  phone: '',
  logo_url: '',
  description: '',
})

function syncFormFromOrganizer() {
  if (!organizer.value) return
  form.name = organizer.value.name || ''
  form.email = organizer.value.email || ''
  form.phone = organizer.value.phone || ''
  form.logo_url = organizer.value.logo_url || ''
  form.description = organizer.value.description || ''
}

// "Membre depuis" + formule active, demandés au même titre que côté
// acheteur (pages/mon-espace/profil/index.vue) et admin
// (pages/admin/organisateurs/index.vue).
const memberSince = computed(() => {
  if (!organizer.value?.created_at) return ''
  return new Date(organizer.value.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})
const { status: commissionStatus, fetchStatus: fetchCommissionStatus } = useCommission()
const fmtRate = (n: number) => String(n).replace('.', ',')
const fmtFcfa = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} FCFA`

onMounted(async () => {
  try {
    if (!organizer.value) await fetchOrganizer()
    await fetchCommissionStatus()
    syncFormFromOrganizer()
  } finally {
    loading.value = false
  }
})

async function save() {
  if (!organizer.value) return
  saving.value = true
  errorMessage.value = ''
  successMessage.value = ''
  try {
    if (!form.name.trim()) throw new Error(t('organizerSettings.nameRequiredError'))

    const { error } = await supabase
      .from('organizers')
      .update({
        name: form.name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        logo_url: form.logo_url.trim() || null,
        description: form.description.trim() || null,
      })
      .eq('id', organizer.value.id)

    if (error) throw error

    await fetchOrganizer()
    successMessage.value = t('organizerSettings.saved')
  } catch (e: any) {
    errorMessage.value = e?.message || t('organizerSettings.saveError')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <OrgPageHeader :eyebrow="t('organizerNav.fallbackTitle')" :title="t('organizerSettings.title')" :subtitle="t('organizerSettings.subtitle')" icon="settings" />

    <div class="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-10">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 4" :key="i" class="org-skeleton h-12" />
      </div>

      <template v-else>
        <!-- Compte & formule -->
        <div v-if="organizer" class="org-rise org-panel relative mb-6 overflow-hidden p-5">
          <span class="absolute inset-y-0 left-0 w-1 bg-[#FF7A00]" aria-hidden="true" />
          <h2 class="acc-label mb-4 flex items-center gap-2"><AppIcon name="shield-check" class="h-4 w-4" />{{ t('organizerSettings.accountInfoTitle') }}</h2>
          <dl class="space-y-3 text-sm">
            <div v-if="memberSince" class="flex items-center justify-between gap-3">
              <dt class="text-tikeo-gray-text">{{ t('organizerSettings.memberSince') }}</dt>
              <dd class="font-bold text-tikeo-black">{{ memberSince }}</dd>
            </div>
            <div class="flex items-center justify-between gap-3">
              <dt class="text-tikeo-gray-text">{{ t('organizerSettings.currentCommission') }}</dt>
              <dd class="font-bold text-tikeo-black">{{ commissionStatus ? fmtRate(commissionStatus.rate) + ' %' : '—' }}<span v-if="commissionStatus?.custom" class="ml-1 text-xs font-semibold text-tikeo-gray-text">({{ t('organizerSettings.customRate') }})</span></dd>
            </div>
            <div v-if="commissionStatus" class="flex items-center justify-between gap-3">
              <dt class="text-tikeo-gray-text">{{ t('organizerSettings.salesToDate') }}</dt>
              <dd class="font-bold text-tikeo-black">{{ fmtFcfa(commissionStatus.sales) }}</dd>
            </div>
            <p v-if="commissionStatus?.next_min_sales" class="border-t border-dashed border-tikeo-border pt-3 text-xs text-tikeo-gray-text">
              {{ t('organizerSettings.nextTier', { rate: fmtRate(commissionStatus.next_rate || 0), amount: fmtFcfa(commissionStatus.next_min_sales - commissionStatus.sales) }) }}
            </p>
          </dl>
          <NuxtLink to="/organisateur/tarifs" class="acc-link group mt-4 inline-flex items-center gap-1.5">
            {{ t('organizerSettings.viewPlans') }}
            <AppIcon name="arrow-right" class="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
          </NuxtLink>
        </div>

        <form class="org-rise org-panel flex flex-col gap-5 p-5 md:p-6" style="--i: 2" @submit.prevent="save">
          <p v-if="errorMessage" class="acc-alert-error">{{ errorMessage }}</p>
          <p v-if="successMessage" class="acc-alert-success">{{ successMessage }}</p>

          <div class="flex items-center gap-4">
            <img v-if="form.logo_url" :src="form.logo_url" alt="Logo" class="h-20 w-20 shrink-0 border border-tikeo-border object-cover" />
            <span v-else class="flex h-20 w-20 shrink-0 items-center justify-center bg-tikeo-ink font-display text-xl font-extrabold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
              {{ form.name?.slice(0, 2).toUpperCase() || 'OR' }}
            </span>
            <div class="flex-1">
              <MediaInput v-model="form.logo_url" folder="organizer-logos" compact :label="t('organizerSettings.logoLabel')" />
            </div>
          </div>

          <div>
            <label class="acc-label mb-1.5 block">{{ t('organizerSettings.orgNameLabel') }}</label>
            <input v-model="form.name" type="text" required class="field-input" />
          </div>

          <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <label class="acc-label mb-1.5 block">{{ t('organizerSettings.emailLabel') }}</label>
              <input v-model="form.email" type="email" class="field-input" />
            </div>
            <div>
              <label class="acc-label mb-1.5 block">{{ t('organizerSettings.phoneLabel') }}</label>
              <input v-model="form.phone" type="tel" class="field-input" />
            </div>
          </div>

          <div>
            <label class="acc-label mb-1.5 block">{{ t('organizerSettings.descriptionLabel') }}</label>
            <textarea v-model="form.description" rows="4" :placeholder="t('organizerSettings.descriptionPlaceholder')" class="field-input !h-auto py-3" />
          </div>

          <button type="submit" class="btn-ink group self-start max-sm:w-full" :disabled="saving">
            <AppIcon name="save" class="h-[18px] w-[18px]" />
            {{ saving ? t('organizerSettings.saving') : t('organizerSettings.saveButton') }}
          </button>
        </form>
      </template>
    </div>
  </div>
</template>
