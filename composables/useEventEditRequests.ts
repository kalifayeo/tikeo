import type {
  EditableEventFields,
  EditableTicketTypeFields,
  EventEditRequest,
  EventEditRequestChanges,
  EventRecord,
  TicketType,
} from '~/types/database'

const EDITABLE_EVENT_FIELDS: (keyof EditableEventFields)[] = [
  'title',
  'description',
  'cover_image',
  'seating_plan_url',
  'category_id',
  'start_date',
  'end_date',
  'location_name',
  'address',
  'city',
  'country',
]

/**
 * Ne garde que les champs qui ont réellement changé, pour que l'admin voie
 * un diff propre au lieu de recevoir 100% du formulaire à chaque fois.
 */
function diffEventFields(before: EventRecord, after: EditableEventFields): Partial<EditableEventFields> {
  const changed: Partial<EditableEventFields> = {}
  for (const key of EDITABLE_EVENT_FIELDS) {
    if ((before as any)[key] !== (after as any)[key]) {
      ;(changed as any)[key] = (after as any)[key]
    }
  }
  return changed
}

function diffTicketTypes(before: TicketType[], after: EditableTicketTypeFields[]): EditableTicketTypeFields[] {
  const beforeById = new Map(before.map((t) => [t.id, t]))
  const changed: EditableTicketTypeFields[] = []
  for (const t of after) {
    const original = beforeById.get(t.id)
    if (!original) continue
    const isDifferent =
      original.name !== t.name ||
      original.description !== t.description ||
      Number(original.price) !== Number(t.price) ||
      Number(original.quantity) !== Number(t.quantity) ||
      original.sale_start !== t.sale_start ||
      original.sale_end !== t.sale_end
    if (isDifferent) changed.push(t)
  }
  return changed
}

export function useEventEditRequests() {
  const supabase = useSupabase()

  /**
   * Un événement en brouillon se modifie directement (pas de workflow).
   * Un événement déjà publié/en pause/etc. nécessite une demande.
   */
  function requiresApproval(event: Pick<EventRecord, 'status'>) {
    return event.status !== 'draft'
  }

  async function fetchPendingRequestForEvent(eventId: string): Promise<EventEditRequest | null> {
    const { data, error } = await supabase
      .from('event_edit_requests')
      .select('*')
      .eq('event_id', eventId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .maybeSingle()
    if (error) throw error
    return (data as unknown as EventEditRequest) ?? null
  }

  async function fetchRequestsForEvent(eventId: string): Promise<EventEditRequest[]> {
    const { data, error } = await supabase
      .from('event_edit_requests')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data as unknown as EventEditRequest[]) ?? []
  }

  /**
   * Construit et envoie une demande de modification. Ne garde que les
   * champs modifiés (event + types de billets) pour un diff lisible côté
   * admin. Retourne `null` si rien n'a réellement changé.
   */
  async function submitEditRequest(params: {
    event: EventRecord
    organizerId: string
    userId: string
    newEventFields: EditableEventFields
    ticketTypes: TicketType[]
    newTicketTypes: EditableTicketTypeFields[]
    note?: string
  }) {
    const eventChanges = diffEventFields(params.event, params.newEventFields)
    const ticketChanges = diffTicketTypes(params.ticketTypes, params.newTicketTypes)

    if (Object.keys(eventChanges).length === 0 && ticketChanges.length === 0) {
      return null
    }

    const previousTicketSnapshot = params.ticketTypes
      .filter((t) => ticketChanges.some((c) => c.id === t.id))
      .map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        price: t.price,
        quantity: t.quantity,
        sale_start: t.sale_start,
        sale_end: t.sale_end,
      }))

    const previous_snapshot: EventEditRequestChanges = {
      event: Object.fromEntries(Object.keys(eventChanges).map((k) => [k, (params.event as any)[k]])),
      ticket_types: previousTicketSnapshot,
    }
    const changes: EventEditRequestChanges = {
      event: eventChanges,
      ticket_types: ticketChanges,
    }

    const { data, error } = await supabase
      .from('event_edit_requests')
      .insert({
        event_id: params.event.id,
        organizer_id: params.organizerId,
        requested_by: params.userId,
        previous_snapshot,
        changes,
        organizer_note: params.note || null,
      })
      .select('*')
      .single()
    if (error) throw error

    // Meilleur effort : prévenir les admins. Si la policy notifications a
    // été retirée ou qu'aucun admin n'existe, on ignore silencieusement —
    // la demande reste visible dans /admin/demandes de toute façon.
    try {
      const { data: admins } = await supabase.from('profiles').select('user_id').eq('role', 'admin')
      if (admins && admins.length > 0) {
        await supabase.from('notifications').insert(
          admins.map((a: any) => ({
            user_id: a.user_id,
            title: 'Nouvelle demande de modification',
            message: `${params.event.title} — un organisateur souhaite modifier cet événement publié.`,
            type: 'event_edit_request',
          }))
        )
      }
    } catch {
      /* non bloquant */
    }

    return data as unknown as EventEditRequest
  }

  async function cancelRequest(requestId: string) {
    const { error } = await supabase.from('event_edit_requests').update({ status: 'cancelled' }).eq('id', requestId)
    if (error) throw error
  }

  // --------------------------------------------------------------
  // Côté admin
  // --------------------------------------------------------------
  async function fetchPendingRequests(): Promise<EventEditRequest[]> {
    const { data, error } = await supabase
      .from('event_edit_requests')
      .select('*, event:events(id, title, slug, status), organizer:organizers(id, name, slug)')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
    if (error) throw error
    return (data as unknown as EventEditRequest[]) ?? []
  }

  async function fetchAllRequests(): Promise<EventEditRequest[]> {
    const { data, error } = await supabase
      .from('event_edit_requests')
      .select('*, event:events(id, title, slug, status), organizer:organizers(id, name, slug)')
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) throw error
    return (data as unknown as EventEditRequest[]) ?? []
  }

  /**
   * Applique le contenu approuvé sur `events` / `ticket_types`, marque la
   * demande comme approuvée, et notifie l'organisateur. Effectué avec la
   * session admin (les policies "is_admin()" + le trigger laissent passer
   * ces écritures même si l'événement n'est plus en brouillon).
   */
  async function approveRequest(request: EventEditRequest, adminUserId: string, note?: string) {
    if (request.changes.event && Object.keys(request.changes.event).length > 0) {
      const { error } = await supabase.from('events').update(request.changes.event).eq('id', request.event_id)
      if (error) throw error
    }

    if (request.changes.ticket_types && request.changes.ticket_types.length > 0) {
      for (const t of request.changes.ticket_types) {
        const { id, ...fields } = t
        const { error } = await supabase.from('ticket_types').update(fields).eq('id', id)
        if (error) throw error
      }
    }

    const { error: reqError } = await supabase
      .from('event_edit_requests')
      .update({ status: 'approved', reviewed_by: adminUserId, reviewed_at: new Date().toISOString(), admin_note: note || null })
      .eq('id', request.id)
    if (reqError) throw reqError

    await notifyOrganizer(request, true, note)
    await writeAuditLog(adminUserId, 'EVENT_EDIT_APPROVED', request.event_id)
  }

  async function rejectRequest(request: EventEditRequest, adminUserId: string, note: string) {
    const { error } = await supabase
      .from('event_edit_requests')
      .update({ status: 'rejected', reviewed_by: adminUserId, reviewed_at: new Date().toISOString(), admin_note: note })
      .eq('id', request.id)
    if (error) throw error

    await notifyOrganizer(request, false, note)
    await writeAuditLog(adminUserId, 'EVENT_EDIT_REJECTED', request.event_id)
  }

  async function notifyOrganizer(request: EventEditRequest, approved: boolean, note?: string) {
    try {
      await supabase.from('notifications').insert({
        user_id: request.requested_by,
        title: approved ? 'Modification approuvée' : 'Modification refusée',
        message: approved
          ? `Votre demande de modification pour "${request.event?.title ?? "l'événement"}" a été appliquée.`
          : `Votre demande de modification pour "${request.event?.title ?? "l'événement"}" a été refusée.${note ? ' Motif : ' + note : ''}`,
        type: approved ? 'event_edit_approved' : 'event_edit_rejected',
      })
    } catch {
      /* non bloquant */
    }
  }

  async function writeAuditLog(userId: string, action: string, entityId: string) {
    try {
      await supabase.from('audit_logs').insert({ user_id: userId, action, entity_type: 'events', entity_id: entityId })
    } catch {
      /* non bloquant */
    }
  }

  return {
    requiresApproval,
    fetchPendingRequestForEvent,
    fetchRequestsForEvent,
    submitEditRequest,
    cancelRequest,
    fetchPendingRequests,
    fetchAllRequests,
    approveRequest,
    rejectRequest,
  }
}
