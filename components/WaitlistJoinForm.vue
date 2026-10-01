<script setup lang="ts">
/**
 * Formulaire « Rejoindre la liste d'attente », affiché sur la page d'un
 * événement complet (voir allSoldOut dans pages/e/[slug].vue). Mêmes
 * protections anti-abus que le formulaire de contact : CSRF, Turnstile,
 * honeypot — gérées côté serveur dans server/api/waitlist/join.post.ts.
 */
const props = defineProps<{ eventId: string }>()
const { t } = useI18n()
const { csrfHeader } = useCsrf()
const { token: captchaToken, widget, ready: captchaReady, onVerify, onExpire, reset: resetCaptcha } = useCaptcha()

const STORAGE_KEY = `tikeo:waitlist-joined:${props.eventId}`
function alreadyJoinedOnDevice() {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

const email = ref('')
const quantity = ref(1)
const website = ref('') // honeypot
const sending = ref(false)
const joined = ref(alreadyJoinedOnDevice())
const errorMessage = ref('')

async function submit() {
  errorMessage.value = ''
  if (!website.value && !captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  sending.value = true
  try {
    const res = await $fetch<{ success: boolean; alreadyJoined?: boolean }>('/api/waitlist/join', {
      method: 'POST',
      headers: await csrfHeader(),
      body: {
        eventId: props.eventId,
        email: email.value.trim(),
        quantity: quantity.value,
        website: website.value,
        captchaToken: captchaToken.value,
      },
    })
    if (res.success) {
      joined.value = true
      try {
        localStorage.setItem(STORAGE_KEY, '1')
      } catch {
        /* ignoré */
      }
    }
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage === 'INVALID_EMAIL' ? t('waitlist.invalidEmail') : t('waitlist.error')
  } finally {
    sending.value = false
    resetCaptcha()
  }
}
</script>

<template>
  <div class="border border-tikeo-border bg-tikeo-surface p-5">
    <div v-if="joined" class="flex items-start gap-3">
      <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-green-600 text-white">✓</span>
      <div>
        <p class="text-sm font-bold text-tikeo-black">{{ t('waitlist.joinedTitle') }}</p>
        <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('waitlist.joinedBody') }}</p>
      </div>
    </div>
    <form v-else class="space-y-3" @submit.prevent="submit">
      <div>
        <p class="text-sm font-bold text-tikeo-black">{{ t('waitlist.title') }}</p>
        <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('waitlist.subtitle') }}</p>
      </div>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input v-model="email" type="email" required :placeholder="t('waitlist.emailPlaceholder')" class="input-field flex-1" />
        <select v-model.number="quantity" class="input-field sm:w-32">
          <option v-for="n in 10" :key="n" :value="n">{{ t('waitlist.ticketsCount', { n }) }}</option>
        </select>
      </div>
      <input v-model="website" type="text" tabindex="-1" autocomplete="off" class="sr-only" aria-hidden="true" />
      <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />
      <p v-if="errorMessage" class="text-xs font-medium text-tikeo-error">{{ errorMessage }}</p>
      <button type="submit" class="btn-primary w-full" :disabled="sending">{{ sending ? t('waitlist.sending') : t('waitlist.submit') }}</button>
    </form>
  </div>
</template>
