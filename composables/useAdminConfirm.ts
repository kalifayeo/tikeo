/**
 * Confirmation « maison » pour l'administration : remplace le confirm() natif
 * du navigateur par la fenêtre du site (ConfirmDeleteModal, montée une seule
 * fois dans layouts/admin.vue).
 *
 *   if (!(await askConfirm({ title: '…', message: '…', confirmLabel: '…' }))) return
 */
interface ConfirmOptions {
  title?: string
  message: string
  confirmLabel?: string
}

const state = reactive({ open: false, title: '', message: '', confirmLabel: '' })
let resolver: ((ok: boolean) => void) | null = null

export function useAdminConfirm() {
  const { t } = useI18n()

  function askConfirm(opts: ConfirmOptions): Promise<boolean> {
    // Une confirmation déjà ouverte est considérée comme refusée.
    resolver?.(false)
    state.title = opts.title ?? t('adminCommon.confirmTitle')
    state.message = opts.message
    state.confirmLabel = opts.confirmLabel ?? t('adminCommon.confirm')
    state.open = true
    return new Promise<boolean>((resolve) => {
      resolver = resolve
    })
  }

  function answer(ok: boolean) {
    state.open = false
    const r = resolver
    resolver = null
    r?.(ok)
  }

  return { confirmState: state, askConfirm, answer }
}
