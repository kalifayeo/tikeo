<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const { profile, user, updateProfile } = useAuth()

const form = reactive({ fullName: '', phone: '', avatarUrl: '' })
const saving = ref(false)
const savingAvatar = ref(false)
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)

watch(
  profile,
  (p) => {
    form.fullName = p?.full_name || ''
    form.phone = p?.phone || ''
    form.avatarUrl = p?.avatar_url || ''
  },
  { immediate: true }
)

const initials = computed(() => {
  const name = form.fullName || profile.value?.full_name || ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
})

const roleLabel = computed(() => {
  switch (profile.value?.role) {
    case 'organizer':
      return t('adminUsers.roleOrganizer')
    case 'agent':
      return t('adminUsers.roleAgent')
    case 'admin':
      return t('adminUsers.roleAdmin')
    default:
      return t('adminUsers.roleBuyer')
  }
})

const memberSince = computed(() => {
  if (!profile.value?.created_at) return ''
  return new Date(profile.value.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

// L'avatar se sauvegarde tout seul dès qu'un fichier est envoyé ou une URL
// collée : pas besoin d'attendre le bouton "Enregistrer" du formulaire pour
// une simple photo de profil.
async function handleAvatarChange(url: string) {
  form.avatarUrl = url
  savingAvatar.value = true
  feedback.value = null
  try {
    await updateProfile({ avatarUrl: url })
  } catch (e: any) {
    feedback.value = { type: 'error', text: e?.message || t('buyerProfile.saveError') }
  } finally {
    savingAvatar.value = false
  }
}

async function handleSubmit() {
  saving.value = true
  feedback.value = null
  try {
    await updateProfile({ fullName: form.fullName, phone: form.phone })
    feedback.value = { type: 'success', text: t('buyerProfile.saveSuccess') }
  } catch (e: any) {
    feedback.value = { type: 'error', text: e?.message || t('buyerProfile.saveError') }
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-tikeo-container px-4 py-6 md:px-6">
    <AccountNav />

    <h1 class="mb-1 text-xl font-bold text-tikeo-black">{{ t('header.profile') }}</h1>
    <p class="mb-6 text-sm text-tikeo-gray-text">{{ t('buyerProfile.subtitle') }}</p>

    <div class="grid gap-8 lg:grid-cols-5">
      <!-- Colonne principale : identité + formulaire -->
      <div class="lg:col-span-3">
        <p
          v-if="feedback"
          class="mb-4 border px-4 py-2 text-sm"
          :class="feedback.type === 'success' ? 'border-green-200 bg-green-50 text-tikeo-success' : 'border-red-200 bg-red-50 text-tikeo-error'"
        >
          {{ feedback.text }}
        </p>

        <!-- Avatar -->
        <div class="mb-6 flex items-center gap-4 border border-tikeo-border bg-tikeo-surface p-4">
          <UserAvatar :avatar-url="form.avatarUrl" :initials="initials" size-class="h-16 w-16" text-class="text-lg" />
          <div class="min-w-0 flex-1">
            <MediaInput
              :model-value="form.avatarUrl"
              folder="avatars"
              compact
              hide-url
              :label="t('buyerProfile.avatarLabel')"
              @update:model-value="handleAvatarChange"
            />
            <p v-if="savingAvatar" class="mt-1 text-xs text-tikeo-gray-text">{{ t('buyerProfile.saving') }}</p>
          </div>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <div>
            <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('buyerProfile.fullName') }}</label>
            <input v-model="form.fullName" type="text" required class="input-field" />
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('buyerProfile.email') }}</label>
            <input :value="user?.email" type="email" disabled class="input-field cursor-not-allowed opacity-60" />
            <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('buyerProfile.emailNote') }}</p>
          </div>

          <div>
            <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('buyerProfile.phone') }}</label>
            <input v-model="form.phone" type="tel" :placeholder="t('buyerProfile.phonePlaceholder')" class="input-field" />
          </div>

          <button type="submit" class="btn-primary" :disabled="saving">
            {{ saving ? t('buyerProfile.saving') : t('buyerProfile.save') }}
          </button>
        </form>
      </div>

      <!-- Colonne secondaire : infos du compte + raccourcis -->
      <div class="space-y-6 lg:col-span-2">
        <div class="border border-tikeo-border bg-tikeo-surface-alt p-4">
          <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerProfile.accountInfoTitle') }}</h2>
          <dl class="space-y-2.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-tikeo-gray-text">{{ t('buyerProfile.accountType') }}</dt>
              <dd class="font-medium text-tikeo-black">{{ roleLabel }}</dd>
            </div>
            <div v-if="memberSince" class="flex items-center justify-between gap-3">
              <dt class="text-tikeo-gray-text">{{ t('buyerProfile.memberSince') }}</dt>
              <dd class="font-medium text-tikeo-black">{{ memberSince }}</dd>
            </div>
          </dl>
        </div>

        <div class="border border-tikeo-border bg-tikeo-surface p-4">
          <h2 class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerProfile.quickLinksTitle') }}</h2>
          <ul class="space-y-2 text-sm">
            <li>
              <NuxtLink to="/mon-espace/parametres" class="font-medium text-tikeo-orange hover:underline">
                {{ t('buyerProfile.goToSettings') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/mon-espace/mes-commandes" class="font-medium text-tikeo-orange hover:underline">
                {{ t('placeholderPages.myOrders') }}
              </NuxtLink>
            </li>
            <li>
              <NuxtLink to="/mon-espace/mes-billets" class="font-medium text-tikeo-orange hover:underline">
                {{ t('header.myTickets') }}
              </NuxtLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>
