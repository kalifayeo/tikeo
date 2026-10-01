import QRCode from 'qrcode'

/**
 * Génère et met en cache les QR codes (data URL PNG) des billets affichés
 * dans l'espace acheteur (mon-espace/mes-billets), à partir de
 * tickets.qr_token — le même jeton que celui encodé dans l'email de
 * confirmation (voir server/utils/brevo.ts : ticketsEmailTemplate).
 */
export function useTicketQr() {
  const cache = ref<Record<string, string>>({})
  const pending = new Set<string>()

  async function ensure(ticketId: string, token: string | null | undefined) {
    if (!token || cache.value[ticketId] || pending.has(ticketId)) return
    pending.add(ticketId)
    try {
      cache.value[ticketId] = await QRCode.toDataURL(token, { margin: 1, width: 200, color: { dark: '#111111', light: '#FFFFFFFF' } })
    } catch (e) {
      console.error('[useTicketQr] échec génération QR code :', e)
    } finally {
      pending.delete(ticketId)
    }
  }

  /** À appeler avec la liste des billets courante (ex. dans un `watch`) : génère les QR manquants. */
  function ensureAll(list: Array<{ id: string; qr_token?: string | null }>) {
    for (const tk of list) ensure(tk.id, tk.qr_token)
  }

  return { qrCache: cache, ensure, ensureAll }
}
