/**
 * Test d'un code promo par l'acheteur, AVANT de passer commande.
 * Appelle validate_promo_code() (SECURITY DEFINER, migration 0029) qui ne
 * révèle jamais la liste des codes d'un événement — seulement si LE code
 * saisi est valable. La réduction réelle est de toute façon recalculée et
 * appliquée en base par create_order() au moment de la commande : ceci ne
 * sert qu'à afficher un aperçu immédiat sans attendre la validation finale.
 */
export interface PromoPreview {
  code: string
  discountType: 'percent' | 'fixed'
  discountValue: number
}

export function usePromoCode() {
  const checking = ref(false)
  const applied = ref<PromoPreview | null>(null)
  const errorCode = ref<string | null>(null)

  async function check(eventId: string, rawCode: string) {
    const code = rawCode.trim()
    errorCode.value = null
    if (!code) {
      errorCode.value = 'PROMO_EMPTY'
      return
    }
    checking.value = true
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase.rpc('validate_promo_code', { p_event_id: eventId, p_code: code })
      if (error) throw error
      if (data?.valid) {
        applied.value = { code: data.code, discountType: data.discount_type, discountValue: Number(data.discount_value) }
      } else {
        applied.value = null
        errorCode.value = data?.error || 'PROMO_INVALID'
      }
    } catch {
      applied.value = null
      errorCode.value = 'PROMO_INVALID'
    } finally {
      checking.value = false
    }
  }

  function clear() {
    applied.value = null
    errorCode.value = null
  }

  /** Réduction estimée sur ce sous-total (le montant définitif vient toujours du serveur). */
  function estimateDiscount(subtotal: number): number {
    if (!applied.value) return 0
    return applied.value.discountType === 'percent'
      ? Math.round((subtotal * applied.value.discountValue) / 100)
      : Math.min(applied.value.discountValue, subtotal)
  }

  return { checking, applied, errorCode, check, clear, estimateDiscount }
}
