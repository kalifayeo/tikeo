import { jsPDF } from 'jspdf'
import QRCode from 'qrcode'

/**
 * Génération des billets en PDF (un billet = une page), utilisée pour la
 * pièce jointe de l'email de confirmation (voir server/utils/brevo.ts et
 * les routes server/api/orders/**). Le rendu reprend l'identité visuelle
 * Tikeo (orange #FF7A00, cadre arrondi, talon détachable avec QR code) afin
 * que le billet imprimé/affiché à l'entrée ait une vraie tenue graphique,
 * au lieu d'un PDF texte brut.
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
  tickets: PdfTicket[]
}

const ORANGE: [number, number, number] = [255, 122, 0]
const ORANGE_STRONG: [number, number, number] = [230, 100, 0]
const INK: [number, number, number] = [17, 17, 17]
const GRAY: [number, number, number] = [110, 110, 110]
const GRAY_LIGHT: [number, number, number] = [235, 235, 235]
const WHITE: [number, number, number] = [255, 255, 255]

function formatAmount(n: number, currency: string) {
  // Espace normal (pas d'espace insécable fine) : la police standard du PDF
  // ne rend pas correctement U+202F, ce qui casse l'affichage du montant.
  const amount = Number(n)
    .toLocaleString('fr-FR')
    .replace(/[\u00A0\u202F]/g, ' ')
  return `${amount} ${currency === 'XOF' ? 'F CFA' : currency}`
}

/** Récupère une image distante et la renvoie en data URI base64 exploitable par jsPDF#addImage. */
async function fetchImageAsDataUrl(url?: string | null): Promise<{ dataUrl: string; format: 'JPEG' | 'PNG' } | null> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const contentType = res.headers.get('content-type') || ''
    const format: 'JPEG' | 'PNG' = contentType.includes('png') ? 'PNG' : 'JPEG'
    const buf = Buffer.from(await res.arrayBuffer())
    return { dataUrl: `data:${contentType || 'image/jpeg'};base64,${buf.toString('base64')}`, format }
  } catch (e) {
    console.error('[ticketPdf] échec récupération de la photo de couverture :', e)
    return null
  }
}

async function qrDataUrl(token?: string | null): Promise<string | null> {
  if (!token) return null
  try {
    return await QRCode.toDataURL(token, { margin: 0, width: 320, color: { dark: '#111111', light: '#FFFFFFFF' } })
  } catch (e) {
    console.error('[ticketPdf] échec génération QR code :', e)
    return null
  }
}

/** Dessine des pointillés simples (compatibles toutes versions de jsPDF) entre deux points verticaux. */
function dashedVLine(doc: jsPDF, x: number, y1: number, y2: number) {
  const dash = 2.2
  const gap = 1.6
  let y = y1
  doc.setDrawColor(...GRAY_LIGHT)
  doc.setLineWidth(0.4)
  while (y < y2) {
    const yEnd = Math.min(y + dash, y2)
    doc.line(x, y, x, yEnd)
    y += dash + gap
  }
}

const PAGE_W = 190
const PAGE_H = 95

/**
 * Dessine un billet complet (carte + talon détachable) sur la page COURANTE
 * du document jsPDF fourni. Factorisé pour être appelé soit plusieurs fois
 * sur le même document (billets « groupés », une page par billet — voir
 * buildTicketsPdf), soit une seule fois sur un document dédié à un seul
 * billet (voir buildIndividualTicketPdfs, utilisé pour joindre CHAQUE billet
 * séparément à l'email de confirmation).
 */
async function drawTicketPage(
  doc: jsPDF,
  tk: PdfTicket,
  options: Pick<BuildTicketsPdfOptions, 'orderNumber' | 'total' | 'currency' | 'eventTitle' | 'eventDate' | 'eventLocation'>,
  cover: { dataUrl: string; format: 'JPEG' | 'PNG' } | null
) {
  const formattedDate = new Date(options.eventDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
  const formattedTime = new Date(options.eventDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const isFree = Number(options.total) === 0

  const M = 5 // marge externe
  const cardW = PAGE_W - M * 2
  const cardH = PAGE_H - M * 2
  const STUB_W = 56
  const mainW = cardW - STUB_W
  const stubX = M + mainW

  {
    // --- Carte : fond blanc + ombre légère simulée par un cadre gris clair
    doc.setFillColor(...WHITE)
    doc.setDrawColor(...GRAY_LIGHT)
    doc.setLineWidth(0.3)
    doc.roundedRect(M, M, cardW, cardH, 5, 5, 'FD')

    // ================= Section principale (gauche) =================
    const bannerH = 26
    if (cover) {
      // Pas de clip disque dispo dans jsPDF : les coins de l'image restent
      // carrés, masqués par le cadre arrondi de la carte au-dessus/dessous.
      doc.addImage(cover.dataUrl, cover.format, M, M, mainW, bannerH, undefined, 'FAST')
      // Voile sombre en bas de bannière pour garder le badge Tikeo lisible.
      doc.setGState(new (doc as any).GState({ opacity: 0.28 }))
      doc.setFillColor(0, 0, 0)
      doc.rect(M, M, mainW, bannerH, 'F')
      doc.setGState(new (doc as any).GState({ opacity: 1 }))
    } else {
      doc.setFillColor(...ORANGE)
      doc.rect(M, M, mainW, bannerH, 'F')
    }
    // Logo Tikeo en médaillon, à cheval sur la bannière
    doc.setFillColor(...WHITE)
    doc.circle(M + 12, M + bannerH, 6, 'F')
    doc.setDrawColor(...ORANGE)
    doc.setLineWidth(0.6)
    doc.circle(M + 12, M + bannerH, 6, 'S')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    doc.setTextColor(...ORANGE)
    doc.text('T', M + 12, M + bannerH + 1.4, { align: 'center' })

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...WHITE)
    doc.text('TIKEO', M + mainW - 4, M + 6, { align: 'right' })
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.5)
    doc.text('BILLET ÉLECTRONIQUE', M + mainW - 4, M + 10, { align: 'right' })

    let y = M + bannerH + 10

    // Titre de l'événement
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...INK)
    const titleLines = doc.splitTextToSize(options.eventTitle || '', mainW - 12)
    doc.text(titleLines.slice(0, 2), M + 6, y)
    y += Math.min(titleLines.length, 2) * 5.6 + 3

    // Date / heure / lieu
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(...GRAY)
    doc.setFillColor(...ORANGE)
    doc.circle(M + 7, y - 1.3, 0.9, 'F')
    doc.text(`${formattedDate} à ${formattedTime}`, M + 10, y)
    y += 5.5
    if (options.eventLocation) {
      doc.setFillColor(...ORANGE)
      doc.circle(M + 7, y - 1.3, 0.9, 'F')
      const locLines = doc.splitTextToSize(options.eventLocation, mainW - 16)
      doc.text(locLines.slice(0, 1), M + 10, y)
      y += 5.5
    }

    // Ligne de séparation
    const sepY = cardH + M - 22
    doc.setDrawColor(...GRAY_LIGHT)
    doc.setLineWidth(0.3)
    doc.line(M + 6, sepY, M + mainW - 6, sepY)

    // Bloc infos billet (type / numéro / prix)
    const infoY = sepY + 7
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...GRAY)
    doc.text('TYPE DE BILLET', M + 6, infoY)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(tk.type_name || '—', M + 6, infoY + 5)

    const midX = M + mainW * 0.52
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...GRAY)
    doc.text('N° DE BILLET', midX, infoY)
    doc.setFont('courier', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...INK)
    doc.text(tk.ticket_number, midX, infoY + 5)

    // Badge prix / gratuit, en bas à droite de la section principale
    const badgeLabel = isFree ? 'GRATUIT' : formatAmount(tk.price, options.currency)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    const badgeW = doc.getTextWidth(badgeLabel) + 8
    const badgeX = M + mainW - badgeW - 6
    const badgeY = cardH + M - 9
    if (isFree) {
      doc.setFillColor(233, 249, 239)
      doc.setTextColor(27, 138, 76)
    } else {
      doc.setFillColor(255, 244, 232)
      doc.setTextColor(...ORANGE_STRONG)
    }
    doc.roundedRect(badgeX, badgeY, badgeW, 6.5, 3.2, 3.2, 'F')
    doc.text(badgeLabel, badgeX + badgeW / 2, badgeY + 4.4, { align: 'center' })

    // Commande, en bas à gauche
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.setTextColor(...GRAY)
    doc.text(`Commande ${options.orderNumber}`, M + 6, cardH + M - 5.5)

    // ================= Talon détachable (droite) =================
    // Encoches façon billet de cinéma : deux demi-cercles couleur fond de
    // page, superposés sur la ligne pointillée verticale.
    doc.setFillColor(250, 250, 250)
    doc.circle(stubX, M, 3.2, 'F')
    doc.circle(stubX, M + cardH, 3.2, 'F')
    dashedVLine(doc, stubX, M + 6, M + cardH - 6)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...GRAY)
    doc.text('ACCÈS', stubX + STUB_W / 2, M + 8, { align: 'center' })

    const qr = await qrDataUrl(tk.qr_token)
    const qrSize = 34
    const qrX = stubX + (STUB_W - qrSize) / 2
    const qrY = M + 12
    doc.setDrawColor(...GRAY_LIGHT)
    doc.setFillColor(...WHITE)
    doc.roundedRect(qrX - 2, qrY - 2, qrSize + 4, qrSize + 4, 2, 2, 'FD')
    if (qr) {
      doc.addImage(qr, 'PNG', qrX, qrY, qrSize, qrSize)
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(6)
      doc.setTextColor(...GRAY)
      doc.text('QR indisponible', stubX + STUB_W / 2, qrY + qrSize / 2, { align: 'center' })
    }

    doc.setFont('courier', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(...INK)
    doc.text(tk.ticket_number, stubX + STUB_W / 2, qrY + qrSize + 7, { align: 'center' })

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    const hint = doc.splitTextToSize('Présentez ce QR code à l’entrée', STUB_W - 8)
    doc.text(hint, stubX + STUB_W / 2, qrY + qrSize + 12, { align: 'center' })
  }
}

/**
 * Construit UN SEUL PDF regroupant tous les billets (une page par billet) et
 * le renvoie en base64. Conservé pour un éventuel usage « tout télécharger »
 * (voir aussi le téléchargement groupé côté client dans
 * pages/mon-espace/mes-billets/index.vue, qui a sa propre implémentation).
 */
export async function buildTicketsPdf(options: BuildTicketsPdfOptions): Promise<string> {
  const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'landscape', compress: true })
  const cover = await fetchImageAsDataUrl(options.eventCoverImage)

  for (let i = 0; i < options.tickets.length; i++) {
    if (i > 0) doc.addPage([PAGE_W, PAGE_H], 'landscape')
    await drawTicketPage(doc, options.tickets[i], options, cover)
  }

  return doc.output('datauristring').split(',')[1]
}

/**
 * Construit UN PDF DISTINCT par billet (au lieu d'un seul PDF multi-pages) —
 * c'est ce que server/utils/brevo.ts joint désormais à l'email de
 * confirmation : si l'acheteur a pris 2, 3 ou N billets, il reçoit N pièces
 * jointes séparées (une par billet), plus faciles à transférer/imprimer
 * individuellement (ex. pour donner un seul billet à un ami).
 *
 * La photo de couverture n'est récupérée qu'une seule fois et réutilisée
 * pour chaque billet, afin de ne pas multiplier les appels réseau.
 */
export async function buildIndividualTicketPdfs(
  options: BuildTicketsPdfOptions
): Promise<Array<{ name: string; content: string }>> {
  const cover = await fetchImageAsDataUrl(options.eventCoverImage)

  const files: Array<{ name: string; content: string }> = []
  for (const tk of options.tickets) {
    const doc = new jsPDF({ unit: 'mm', format: [PAGE_W, PAGE_H], orientation: 'landscape', compress: true })
    await drawTicketPage(doc, tk, options, cover)
    const safeNumber = (tk.ticket_number || 'billet').replace(/[^A-Za-z0-9_-]+/g, '-')
    files.push({ name: `billet-${safeNumber}.pdf`, content: doc.output('datauristring').split(',')[1] })
  }
  return files
}
