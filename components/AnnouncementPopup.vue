<script setup lang="ts">
/**
 * Pop-up d'annonce (promo, information...) géré par l'admin
 * (/admin/popups) : image ou bandeau de marque, titre, message et bouton
 * d'action optionnel.
 */
import type { Popup } from '~/types/database'

const props = defineProps<{ popup: Popup }>()
const emit = defineEmits<{ (e: 'close'): void }>()
const { t } = useI18n()
const router = useRouter()

// Seuls les chemins internes et les liens http(s) sont suivis : jamais
// « javascript: » ou autre schéma, même si un contenu admin en contenait.
function resolveCta(url: string | null): { kind: 'internal' | 'external'; href: string } | null {
  const u = (url || '').trim()
  if (!u) return null
  if (u.startsWith('/') && !u.startsWith('//')) return { kind: 'internal', href: u }
  if (/^https?:\/\//i.test(u)) return { kind: 'external', href: u }
  return null
}
const cta = computed(() => (props.popup.cta_label ? resolveCta(props.popup.cta_url) : null))

function onCta() {
  if (!cta.value) return
  emit('close')
  if (cta.value.kind === 'internal') router.push(cta.value.href)
  else window.open(cta.value.href, '_blank', 'noopener,noreferrer')
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.body.style.overflow = 'hidden'
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKey)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[105] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" @click.self="emit('close')">
      <div class="popup-in relative w-full max-w-md overflow-hidden bg-tikeo-surface shadow-2xl" role="dialog" aria-modal="true" :aria-label="popup.title">
        <button
          type="button"
          class="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center bg-black/30 text-white backdrop-blur transition hover:bg-black/50"
          :aria-label="t('engagement.close')"
          @click="emit('close')"
        >
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        <!-- Visuel -->
        <div class="relative aspect-[16/9] w-full overflow-hidden bg-tikeo-brand">
          <img v-if="popup.image_url" :src="popup.image_url" :alt="popup.title" class="h-full w-full object-cover" />
          <template v-else>
            <div class="pointer-events-none absolute -left-8 -top-8 h-40 w-40 rounded-full bg-white/15 blur-2xl" />
            <div class="pointer-events-none absolute -bottom-10 -right-6 h-48 w-48 rounded-full bg-white/20 blur-3xl" />
            <div class="absolute inset-0 flex items-center justify-center text-7xl drop-shadow-lg">📣</div>
          </template>
        </div>

        <div class="px-6 pb-6 pt-5 text-center">
          <h2 class="text-xl font-extrabold leading-tight text-tikeo-black">{{ popup.title }}</h2>
          <p v-if="popup.message" class="mt-2 whitespace-pre-line text-sm leading-relaxed text-tikeo-gray-text">{{ popup.message }}</p>
          <div class="mt-5 flex flex-col gap-2">
            <button v-if="cta" type="button" class="btn-primary w-full" @click="onCta">{{ popup.cta_label }}</button>
            <button type="button" class="w-full py-2 text-xs font-semibold text-tikeo-gray-text hover:text-tikeo-orange" @click="emit('close')">
              {{ cta ? t('engagement.later') : t('engagement.gotIt') }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.popup-in {
  animation: popup-in 0.28s cubic-bezier(0.2, 0.9, 0.3, 1.1);
}
@keyframes popup-in {
  from { opacity: 0; transform: translateY(16px) scale(0.96); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  .popup-in { animation: none; }
}
</style>
