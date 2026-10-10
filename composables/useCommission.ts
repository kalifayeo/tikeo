/**
 * Commission Tikeo par paliers de volume (migration 0047).
 *  - `tiers` : paliers publics (table commission_tiers), avec valeurs de repli
 *    identiques à celles insérées par la migration si la lecture échoue.
 *  - `status` : situation de l'organisateur connecté (ventes cumulées, taux
 *    actuel, prochain palier) via la fonction SQL my_commission_status().
 * Le calcul faisant foi est fait en base à chaque commande ; ceci sert à l'affichage.
 */
export interface CommissionTier {
  min_sales: number
  rate: number
}
export interface CommissionStatus {
  sales: number
  rate: number
  custom: boolean
  next_min_sales: number | null
  next_rate: number | null
}

export const DEFAULT_COMMISSION_TIERS: CommissionTier[] = [
  { min_sales: 0, rate: 6 },
  { min_sales: 1_000_000, rate: 5 },
  { min_sales: 5_000_000, rate: 3.5 },
  { min_sales: 20_000_000, rate: 2.5 },
]

export function useCommission() {
  const supabase = useSupabase()
  const tiers = ref<CommissionTier[]>(DEFAULT_COMMISSION_TIERS)
  const status = ref<CommissionStatus | null>(null)

  async function fetchTiers() {
    const { data } = await supabase.from('commission_tiers').select('min_sales, rate').order('min_sales', { ascending: true })
    if (data && data.length) {
      tiers.value = data.map((r: any) => ({ min_sales: Number(r.min_sales), rate: Number(r.rate) }))
    }
    return tiers.value
  }

  async function fetchStatus() {
    const { data } = await supabase.rpc('my_commission_status')
    status.value = (data as unknown as CommissionStatus | null) ?? null
    return status.value
  }

  /** Taux (%) applicable pour un volume de ventes cumulées donné. */
  function rateFor(sales: number) {
    const list = [...tiers.value].sort((a, b) => a.min_sales - b.min_sales)
    let rate = list[0]?.rate ?? 6
    for (const t of list) if (sales >= t.min_sales) rate = t.rate
    return rate
  }

  return { tiers, status, fetchTiers, fetchStatus, rateFor }
}
