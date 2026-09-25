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

onMounted(async () => {
  try {
    if (!organizer.value) await fetchOrganizer()
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
  <div class="mx-auto max-w-2xl px-4 py-8 md:px-6">
    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('organizerSettings.title') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('organizerSettings.subtitle') }}</p>

    <div v-if="loading" class="space-y-3">
      <div v-for="i in 4" :key="i" class="h-11 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <form v-else class="flex flex-col gap-4" @submit.prevent="save">
      <p v-if="errorMessage" class="border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>
      <p v-if="successMessage" class="border border-tikeo-success/30 bg-tikeo-success/10 px-4 py-2 text-sm text-tikeo-success">{{ successMessage }}</p>

      <div class="flex items-center gap-4">
        <img
          v-if="form.logo_url"
          :src="form.logo_url"
          alt="Logo"
          class="h-16 w-16 shrink-0 rounded-full border border-tikeo-border object-cover"
        />
        <span v-else class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-tikeo-border bg-tikeo-surface-alt text-lg font-bold text-tikeo-gray-text">
          {{ form.name?.slice(0, 2).toUpperCase() || 'OR' }}
        </span>
        <div class="flex-1">
          <MediaInput
            v-model="form.logo_url"
            folder="organizer-logos"
            compact
            :label="t('organizerSettings.logoLabel')"
          />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-semibold text-tikeo-gray-text">{{ t('organizerSettings.orgNameLabel') }}</label>
        <input v-model="form.name" type="text" required class="input-field" />
      </div>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-semibold text-tikeo-gray-text">{{ t('organizerSettings.emailLabel') }}</label>
          <input v-model="form.email" type="email" class="input-field" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-semibold text-tikeo-gray-text">{{ t('organizerSettings.phoneLabel') }}</label>
          <input v-model="form.phone" type="tel" class="input-field" />
        </div>
      </div>

      <div>
        <label class="mb-1 block text-xs font-semibold text-tikeo-gray-text">{{ t('organizerSettings.descriptionLabel') }}</label>
        <textarea v-model="form.description" rows="4" :placeholder="t('organizerSettings.descriptionPlaceholder')" class="input-field" />
      </div>

      <button type="submit" class="btn-primary self-start" :disabled="saving">
        {{ saving ? t('organizerSettings.saving') : t('organizerSettings.saveButton') }}
      </button>
    </form>
  </div>
</template>
