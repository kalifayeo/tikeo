<script setup lang="ts">
/**
 * Widget Cloudflare Turnstile (alternative respectueuse de la vie privée à
 * reCAPTCHA). N'affiche rien et ne charge aucun script tant que
 * NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide.
 *
 * Émet `verify(token)` quand le visiteur est validé et `expire` quand le
 * jeton expire ou en cas d'erreur. Expose `reset()` pour redemander un jeton.
 */
const emit = defineEmits<{ (e: 'verify', token: string): void; (e: 'expire'): void }>()

const config = useRuntimeConfig()
const { locale } = useI18n()
const siteKey = computed(() => String(config.public.turnstileSiteKey || ''))

const container = ref<HTMLElement | null>(null)
let widgetId: string | undefined

const SCRIPT_ID = 'cf-turnstile-script'
const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'

function loadScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).turnstile) return resolve()
    const existing = document.getElementById(SCRIPT_ID)
    if (existing) {
      existing.addEventListener('load', () => resolve())
      existing.addEventListener('error', () => reject(new Error('turnstile')))
      return
    }
    const script = document.createElement('script')
    script.id = SCRIPT_ID
    script.src = SCRIPT_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('turnstile'))
    document.head.appendChild(script)
  })
}

onMounted(async () => {
  if (!siteKey.value || !container.value) return
  try {
    await loadScript()
    widgetId = (window as any).turnstile.render(container.value, {
      sitekey: siteKey.value,
      language: locale.value,
      theme: 'auto',
      callback: (token: string) => emit('verify', token),
      'expired-callback': () => emit('expire'),
      'error-callback': () => emit('expire'),
    })
  } catch {
    // Script bloqué (bloqueur de pub, réseau) : le bouton restera désactivé
    // et le message « captchaRequired » s'affichera à la soumission.
    emit('expire')
  }
})

onBeforeUnmount(() => {
  if (widgetId !== undefined) (window as any).turnstile?.remove(widgetId)
})

function reset() {
  if (widgetId !== undefined) (window as any).turnstile?.reset(widgetId)
}

defineExpose({ reset })
</script>

<template>
  <div v-if="siteKey" ref="container" class="flex min-h-[65px] justify-center" />
</template>
