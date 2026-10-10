export interface TikeoToast {
  id: number
  text: string
  type: 'success' | 'error' | 'info'
}

let seq = 0

/**
 * Mini notifications « toast » (confirmation d'une copie, d'un enregistrement
 * automatique...). État partagé via useState, affichage par <ToastHost />
 * (monté une seule fois dans app.vue).
 */
export function useToast() {
  const toasts = useState<TikeoToast[]>('tikeo-toasts', () => [])

  function dismiss(id: number) {
    toasts.value = toasts.value.filter((x) => x.id !== id)
  }

  function push(text: string, type: TikeoToast['type'] = 'success', ms = 2600) {
    if (!import.meta.client) return
    const id = ++seq
    // 3 toasts maximum à l'écran : on retire le plus ancien.
    toasts.value = [...toasts.value.slice(-2), { id, text, type }]
    setTimeout(() => dismiss(id), ms)
  }

  return {
    toasts,
    dismiss,
    push,
    success: (text: string) => push(text, 'success'),
    error: (text: string) => push(text, 'error', 4200),
    info: (text: string) => push(text, 'info'),
  }
}
