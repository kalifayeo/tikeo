/**
 * Lecture du journal d'audit (table `audit_logs`, migration 0001), réservée
 * aux admins portant la permission `audit.view` (migration 0030) — la RLS
 * est la seule autorité ici, ce composable ne fait qu'interroger.
 */
export interface AuditLogRow {
  id: string
  user_id: string | null
  action: string
  entity_type: string
  entity_id: string | null
  ip_address: string | null
  metadata: Record<string, unknown>
  created_at: string
  adminName: string | null
  adminEmail: string | null
}

export interface AuditLogFilters {
  action?: string
  entityType?: string
  adminUserId?: string
  dateFrom?: string
  dateTo?: string
}

const PAGE_SIZE = 30

export function useAuditLogs() {
  const rows = ref<AuditLogRow[]>([])
  const loading = ref(true)
  const error = ref('')
  const page = ref(0)
  const hasMore = ref(false)
  const filters = reactive<AuditLogFilters>({})

  async function load(reset = true) {
    loading.value = true
    error.value = ''
    if (reset) page.value = 0
    try {
      const supabase = useSupabase()
      let query = supabase.from('audit_logs').select('*').order('created_at', { ascending: false })

      if (filters.action?.trim()) query = query.ilike('action', `%${filters.action.trim()}%`)
      if (filters.entityType?.trim()) query = query.eq('entity_type', filters.entityType.trim())
      if (filters.adminUserId?.trim()) query = query.eq('user_id', filters.adminUserId.trim())
      if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom)
      if (filters.dateTo) query = query.lte('created_at', filters.dateTo)

      const from = page.value * PAGE_SIZE
      const { data, error: err } = await query.range(from, from + PAGE_SIZE) // +1 pour détecter s'il y a une page suivante
      if (err) throw err

      const page_ = (data ?? []) as any[]
      hasMore.value = page_.length > PAGE_SIZE
      const pageRows = page_.slice(0, PAGE_SIZE)

      // Noms des admins concernés, récupérés à part (pas de FK PostgREST
      // directe entre audit_logs.user_id et profiles : les deux référencent
      // auth.users, mais pas l'un l'autre).
      const ids = [...new Set(pageRows.map((r) => r.user_id).filter(Boolean))]
      const names = new Map<string, { name: string | null; email: string | null }>()
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('user_id, full_name, email').in('user_id', ids)
        for (const p of (profs as any[]) ?? []) names.set(p.user_id, { name: p.full_name, email: p.email })
      }

      const enriched: AuditLogRow[] = pageRows.map((r) => ({
        ...r,
        adminName: r.user_id ? names.get(r.user_id)?.name ?? null : null,
        adminEmail: r.user_id ? names.get(r.user_id)?.email ?? null : null,
      }))
      rows.value = reset ? enriched : [...rows.value, ...enriched]
    } catch (e: any) {
      error.value = e?.message || 'Impossible de charger le journal d\u2019audit.'
    } finally {
      loading.value = false
    }
  }

  async function nextPage() {
    if (!hasMore.value || loading.value) return
    page.value += 1
    await load(false)
  }

  async function applyFilters() {
    await load(true)
  }

  async function resetFilters() {
    Object.keys(filters).forEach((k) => delete (filters as any)[k])
    await load(true)
  }

  onMounted(() => load(true))

  return { rows, loading, error, filters, hasMore, load, nextPage, applyFilters, resetFilters }
}
