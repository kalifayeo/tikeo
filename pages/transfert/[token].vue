<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const token = route.params.token as string

const { isAuthenticated, user } = useAuth()
const { preview, loading, errorCode, respond, responding, respondError } = useTicketTransferInbox(token)

const responded = ref<{ status: string } | null>(null)

async function handleRespond(accept: boolean) {
  const result = await respond(accept)
  if (result) responded.value = result
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="mx-auto max-w-md px-4 py-10">
    <div class="card p-6 text-center">
      <img src="/logo-tikeo.png" alt="Tikeo" class="mx-auto mb-4 h-8" />

      <p v-if="loading" class="text-sm text-tikeo-gray-text">{{ t('transferPage.loading') }}</p>

      <template v-else-if="errorCode">
        <p class="text-sm font-semibold text-tikeo-black">{{ t('transferPage.notFound') }}</p>
      </template>

      <template v-else-if="responded">
        <p v-if="responded.status === 'accepted'" class="text-sm font-semibold text-tikeo-success">{{ t('transferPage.accepted') }}</p>
        <p v-else class="text-sm font-semibold text-tikeo-black">{{ t('transferPage.declined') }}</p>
        <NuxtLink v-if="responded.status === 'accepted'" to="/mon-espace/mes-billets" class="btn-primary mt-4 inline-block">
          {{ t('transferPage.goToMyTickets') }}
        </NuxtLink>
      </template>

      <template v-else-if="preview">
        <p v-if="preview.status === 'expired'" class="text-sm text-tikeo-error">{{ t('transferPage.expired') }}</p>
        <p v-else-if="preview.status === 'cancelled'" class="text-sm text-tikeo-error">{{ t('transferPage.cancelled') }}</p>
        <p v-else-if="preview.status === 'declined' || preview.status === 'accepted'" class="text-sm text-tikeo-gray-text">
          {{ t('transferPage.alreadyResponded') }}
        </p>

        <template v-else>
          <img v-if="preview.event?.coverImage" :src="preview.event.coverImage" :alt="preview.event.title" class="mb-4 h-32 w-full rounded object-cover" />
          <h1 class="mb-1 text-base font-bold text-tikeo-black">{{ t('transferPage.title') }}</h1>
          <p class="mb-4 text-sm text-tikeo-gray-text">
            {{ t('transferPage.from') }} <strong class="text-tikeo-black">{{ preview.senderName }}</strong>
            {{ t('transferPage.forEvent') }} <strong class="text-tikeo-black">{{ preview.event?.title }}</strong>
          </p>
          <p v-if="preview.event" class="mb-1 text-xs text-tikeo-gray-text">{{ formatDate(preview.event.startDate) }}</p>
          <p v-if="preview.event?.location" class="mb-4 text-xs text-tikeo-gray-text">{{ preview.event.location }}</p>
          <p v-if="preview.message" class="mb-4 border-l-2 border-tikeo-orange bg-tikeo-surface-alt p-3 text-left text-xs italic text-tikeo-black">
            « {{ preview.message }} »
          </p>
          <p class="mb-4 text-xs text-tikeo-gray-text">{{ t('transferPage.ticketNumber') }} : <span class="font-mono">{{ preview.ticketNumber }}</span> — {{ preview.ticketType }}</p>

          <template v-if="!isAuthenticated">
            <p class="mb-3 text-xs text-tikeo-gray-text">{{ t('transferPage.loginPrompt', { email: preview.toEmailMasked }) }}</p>
            <NuxtLink :to="`/connexion?redirect=${encodeURIComponent(route.fullPath)}`" class="btn-primary block">{{ t('auth.login') }}</NuxtLink>
          </template>
          <template v-else>
            <p v-if="respondError === 'TRANSFER_WRONG_RECIPIENT'" class="mb-3 text-xs text-tikeo-error">{{ t('transferPage.wrongAccount') }}</p>
            <div class="flex gap-2">
              <button type="button" class="btn-secondary flex-1 text-sm" :disabled="responding" @click="handleRespond(false)">
                {{ t('transferPage.decline') }}
              </button>
              <button type="button" class="btn-primary flex-1 text-sm" :disabled="responding" @click="handleRespond(true)">
                {{ t('transferPage.accept') }}
              </button>
            </div>
          </template>
        </template>
      </template>
    </div>
  </div>
</template>
