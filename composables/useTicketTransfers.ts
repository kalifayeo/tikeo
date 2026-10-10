import type { TicketTransfer } from '~/types/database'

async function authHeaders(): Promise<Record<string, string>> {
  const supabase = useSupabase()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

/** Envoyer/annuler un transfert depuis "Mes billets". */
export function useTicketTransferSend() {
  const submitting = ref(false)
  const errorCode = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function send(ticketId: string, toEmail: string, message?: string) {
    submitting.value = true
    errorCode.value = null
    try {
      const res = await $fetch<{ transfer: { token: string; toEmail: string; expiresAt: string } }>(
        `/api/tickets/${ticketId}/transfer`,
        {
          method: 'POST',
          headers: { ...(await authHeaders()), ...(await csrfHeader()) },
          body: { toEmail, message },
        }
      )
      return res.transfer
    } catch (e: any) {
      errorCode.value = e?.data?.data?.code ?? 'TRANSFER_CREATE_FAILED'
      return null
    } finally {
      submitting.value = false
    }
  }

  async function cancel(transferId: string) {
    submitting.value = true
    errorCode.value = null
    try {
      await $fetch(`/api/transfers/${transferId}/cancel`, {
        method: 'POST',
        headers: { ...(await authHeaders()), ...(await csrfHeader()) },
      })
      return true
    } catch (e: any) {
      errorCode.value = e?.data?.data?.code ?? 'TRANSFER_CANCEL_FAILED'
      return false
    } finally {
      submitting.value = false
    }
  }

  return { submitting, errorCode, send, cancel }
}

/** Transferts envoyés par l'acheteur connecté (mon-espace/mes-billets). Lecture directe : RLS "Transferts : expéditeur". */
export function useMySentTransfers() {
  const { user } = useAuth()
  const transfers = ref<(TicketTransfer & { ticket?: { ticket_number: string; event?: { title: string } } })[]>([])
  const loading = ref(true)

  async function fetchTransfers() {
    if (!user.value) {
      transfers.value = []
      loading.value = false
      return
    }
    loading.value = true
    try {
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('ticket_transfers')
        .select('*, ticket:tickets(ticket_number, event:events(title))')
        .eq('from_user_id', user.value.id)
        .order('created_at', { ascending: false })
      if (!error) transfers.value = (data as any) ?? []
    } finally {
      loading.value = false
    }
  }

  if (import.meta.client) {
    watch(user, (u) => (u ? fetchTransfers() : (transfers.value = [])), { immediate: true })
  }

  return { transfers, loading, fetchTransfers }
}

/**
 * Aperçu public d'une invitation de transfert (page /transfert/[token]), et
 * réponse (accepter/refuser) une fois connecté avec l'adresse invitée.
 */
export interface TransferPreview {
  status: string
  expiresAt: string
  message: string | null
  toEmailMasked: string
  senderName: string
  ticketNumber?: string
  ticketType?: string
  event: { title: string; slug: string; startDate: string; coverImage: string | null; location: string | null } | null
}

export function useTicketTransferInbox(token: string) {
  const { data, pending, error, refresh } = useAsyncData<TransferPreview>(`transfer-preview:${token}`, () =>
    $fetch<TransferPreview>(`/api/transfers/${token}`)
  )
  const errorCode = computed<string | null>(() => (error.value as any)?.data?.data?.code ?? null)

  const responding = ref(false)
  const respondError = ref<string | null>(null)
  const { csrfHeader } = useCsrf()

  async function respond(accept: boolean) {
    responding.value = true
    respondError.value = null
    try {
      const res = await $fetch<{ result: { status: string; event_title?: string; event_slug?: string; ticket_number?: string } }>(
        `/api/transfers/${token}/respond`,
        {
          method: 'POST',
          headers: { ...(await authHeaders()), ...(await csrfHeader()) },
          body: { accept },
        }
      )
      return res.result
    } catch (e: any) {
      respondError.value = e?.data?.data?.code ?? 'TRANSFER_RESPOND_FAILED'
      return null
    } finally {
      responding.value = false
    }
  }

  return { preview: data, loading: pending, errorCode, refresh: () => refresh(), respond, responding, respondError }
}
