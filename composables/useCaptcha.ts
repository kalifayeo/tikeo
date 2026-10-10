/**
 * Anti-robots Cloudflare Turnstile — état partagé par les écrans d'auth.
 *
 * Désactivé (aucun effet, aucun bouton bloqué) tant que
 * NUXT_PUBLIC_TURNSTILE_SITE_KEY est vide. Une fois activé, le jeton produit
 * par <TurnstileWidget> est à usage unique : appeler `reset()` après CHAQUE
 * soumission (réussie ou non) pour en obtenir un nouveau.
 *
 * Utilisation :
 *   const { token, widget, ready, onVerify, onExpire, reset } = useCaptcha()
 *   <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />
 */
export function useCaptcha() {
  const config = useRuntimeConfig()
  const enabled = computed(() => !!config.public.turnstileSiteKey)

  const token = ref<string | undefined>(undefined)
  const widget = ref<{ reset: () => void } | null>(null)

  // Vrai quand on peut soumettre : captcha désactivé, ou jeton obtenu.
  const ready = computed(() => !enabled.value || !!token.value)

  function onVerify(value: string) {
    token.value = value
  }
  function onExpire() {
    token.value = undefined
  }
  function reset() {
    token.value = undefined
    widget.value?.reset()
  }

  return { enabled, token, widget, ready, onVerify, onExpire, reset }
}
