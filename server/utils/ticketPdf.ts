import { jsPDF } from 'jspdf'
import sharp from 'sharp'
import { buildTicketDoc, loadTicketAssets, type TicketAssets, type TicketSheetInput } from '../../utils/ticketPdfDoc'

/**
 * Billets PDF joints à l'email de confirmation (voir server/utils/brevo.ts et
 * les routes server/api/orders/**, server/api/payments/jeko/webhook).
 *
 * Le dessin du billet (carte marine + talon QR, puis conditions d'accès et
 * consignes) est partagé avec le téléchargement de « Mes billets » :
 * voir utils/ticketPdfDoc.ts. Ce fichier ne fait que préparer les données.
 */

interface PdfTicket {
  ticket_number: string
  type_name: string
  price: number
  qr_token?: string | null
}

export interface BuildTicketsPdfOptions {
  orderNumber: string
  total: number
  currency: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  eventCoverImage?: string | null
  /** Nom du titulaire affiché sur chaque billet (l'acheteur). */
  holderName?: string | null
  tickets: PdfTicket[]
}

function toSheets(options: BuildTicketsPdfOptions): TicketSheetInput[] {
  return options.tickets.map((tk, i) => ({
    ticketNumber: tk.ticket_number,
    typeName: tk.type_name,
    price: tk.price,
    currency: options.currency,
    qrToken: tk.qr_token,
    holderName: options.holderName,
    eventTitle: options.eventTitle,
    eventDate: options.eventDate,
    eventLocation: options.eventLocation,
    orderNumber: options.orderNumber,
    index: i + 1,
    count: options.tickets.length,
  }))
}

/**
 * Photo de l'événement pour le PDF envoyé par email.
 *
 * Cause du bug « pas d'image dans le PDF reçu par email » : sur le serveur, seuls
 * JPEG et PNG étaient acceptés, alors que l'affiche peut être en WebP, AVIF, GIF ou
 * SVG (formats proposés à l'import). « Mes billets » fonctionnait car le navigateur
 * convertit tout via un canvas. Ici, sharp fait la même chose côté serveur : toute
 * image est décodée, réduite (1400 px max) et ré-encodée en JPEG (fond blanc pour la
 * transparence) — ce qui allège aussi les pièces jointes.
 * En cas d'échec, on retombe sur l'ancien chemin (JPEG/PNG bruts), puis sur « sans photo ».
 */
async function loadServerCover(url?: string | null): Promise<TicketAssets['cover']> {
  if (!url) return null
  let absolute = url.trim()
  if (absolute.startsWith('//')) absolute = `https:${absolute}`
  if (absolute.startsWith('/')) {
    const root = String(useRuntimeConfig().public.rootDomain || 'tikeo.com')
    absolute = `https://${root}${absolute}`
  }
  try {
    const res = await fetch(absolute, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const input = Buffer.from(await res.arrayBuffer())
    const { data, info } = await sharp(input, { animated: false })
      .rotate()
      .resize({ width: 1400, height: 1400, fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 85 })
      .toBuffer({ resolveWithObject: true })
    return { dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`, format: 'JPEG', width: info.width, height: info.height }
  } catch (e) {
    console.warn(`[ticketPdf] conversion de la photo impossible (${absolute}) :`, e)
    return null
  }
}

async function loadAssets(coverUrl?: string | null): Promise<TicketAssets> {
  const cover = (await loadServerCover(coverUrl)) ?? (await loadTicketAssets(coverUrl))?.cover ?? null
  return { cover }
}

/** Un seul PDF regroupant tous les billets (une page A4 par billet), renvoyé en base64. */
export async function buildTicketsPdf(options: BuildTicketsPdfOptions): Promise<string> {
  const assets = await loadAssets(options.eventCoverImage)
  const doc = await buildTicketDoc(jsPDF as any, toSheets(options), assets)
  return doc.output('datauristring').split(',')[1]
}

/**
 * Un PDF DISTINCT par billet — c'est ce que server/utils/brevo.ts joint à
 * l'email : si l'acheteur a pris N billets, il reçoit N pièces jointes
 * séparées, faciles à transférer ou imprimer individuellement. La photo de
 * l'événement n'est récupérée qu'une seule fois pour tous les billets.
 */
export async function buildIndividualTicketPdfs(
  options: BuildTicketsPdfOptions
): Promise<Array<{ name: string; content: string }>> {
  const assets = await loadAssets(options.eventCoverImage)
  const sheets = toSheets(options)

  const files: Array<{ name: string; content: string }> = []
  for (const sheet of sheets) {
    const doc = await buildTicketDoc(jsPDF as any, [sheet], assets)
    const safeNumber = (sheet.ticketNumber || 'billet').replace(/[^A-Za-z0-9_-]+/g, '-')
    files.push({ name: `billet-${safeNumber}.pdf`, content: doc.output('datauristring').split(',')[1] })
  }
  return files
}
