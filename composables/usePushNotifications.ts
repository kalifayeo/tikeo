async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

/**
 * Activation des notifications push du navigateur (rappels d'événement,
 * liste d'attente, transferts de billet — voir server/api/cron/tick.post.ts).
 * Se contente de masquer le bouton si :
 *   - le navigateur ne supporte pas les Service Workers / Push (Safari < 16, etc.) ;
 *   - aucune clé VAPID publique n'est configurée côté serveur (voir .env.example).
 */
export function usePushNotifications() {
  const config = useRuntimeConfig()
  const supported = computed(
    () => import.meta.client && 'serviceWorker' in navigator && 'PushManager' in window && !!config.public.vapidPublicKey
  )
  const permission = ref<NotificationPermission>(import.meta.client && 'Notification' in window ? Notification.permission : 'default')
  const subscribed = ref(false)
  const loading = ref(false)
  const errorMessage = ref('')
  const { csrfHeader } = useCsrf()

  async function refreshState() {
    if (!supported.value) return
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      subscribed.value = !!sub
    } catch {
      subscribed.value = false
    }
  }

  async function enable() {
    if (!supported.value) return false
    loading.value = true
    errorMessage.value = ''
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm
      if (perm !== 'granted') {
        errorMessage.value = 'Autorisation refusée : activez les notifications dans les réglages du navigateur pour ce site.'
        return false
      }
      const reg = await navigator.serviceWorker.ready
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.public.vapidPublicKey) as BufferSource,
        })
      }
      const json = sub.toJSON()
      await $fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
        body: { endpoint: json.endpoint, keys: json.keys },
      })
      subscribed.value = true
      return true
    } catch (e: any) {
      errorMessage.value = e?.message || "Impossible d'activer les notifications."
      return false
    } finally {
      loading.value = false
    }
  }

  async function disable() {
    if (!supported.value) return
    loading.value = true
    try {
      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        const supabase = useSupabase()
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      subscribed.value = false
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) refreshState()

  return { supported, permission, subscribed, loading, errorMessage, enable, disable }
}
