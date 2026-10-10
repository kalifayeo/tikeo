import type { jsPDF } from 'jspdf'
import QRCode from 'qrcode'
import { TICKET_LOGO_DATA_URL } from './ticketLogo'

/**
 * Dessin du billet PDF Tikeo — UNE SEULE implémentation, partagée par :
 *   - le serveur (pièce jointe de l'email de confirmation : server/utils/ticketPdf.ts) ;
 *   - le navigateur (téléchargement dans « Mes billets »).
 *
 * Page A4 portrait : le billet en haut (carte marine, talon détachable avec
 * QR code, prix, titulaire…), puis, juste en dessous, les conditions d'accès
 * et consignes à respecter, présentées en blocs numérotés.
 *
 * Ce module n'importe jsPDF que comme TYPE : l'appelant fournit le
 * constructeur (import statique côté serveur, import dynamique côté client
 * pour ne pas alourdir le bundle).
 */

export interface TicketSheetInput {
  ticketNumber: string
  typeName: string
  price: number
  currency: string
  qrToken?: string | null
  /** Nom du titulaire (acheteur ou destinataire du transfert). */
  holderName?: string | null
  eventTitle: string
  /** Date ISO de début de l'événement. */
  eventDate: string
  eventLocation: string
  orderNumber: string
  /** Rang du billet dans la commande (1-based) et nombre total de billets de la commande. */
  index?: number
  count?: number
}

export interface TicketAssets {
  cover: { dataUrl: string; format: 'JPEG' | 'PNG'; width: number; height: number } | null
}

type RGB = [number, number, number]
type JsPdfCtor = new (options?: any) => jsPDF

// --- Palette (identité Tikeo : encre marine + orange de marque) ---------------
const INK: RGB = [10, 26, 52]
const INK_DEEP: RGB = [6, 17, 36]
const INK_SOFT: RGB = [22, 48, 90]
const ORANGE: RGB = [255, 122, 0]
const ORANGE_LIGHT: RGB = [255, 154, 61]
const GOLD: RGB = [255, 200, 120]
const BLUE: RGB = [0, 87, 184]
const WHITE: RGB = [255, 255, 255]
const MUTED: RGB = [176, 190, 212]
const TEXT: RGB = [17, 24, 39]
const GRAY: RGB = [84, 92, 107]
const LINE: RGB = [226, 230, 238]

// --- Géométrie (mm) ---------------------------------------------------------
const PAGE_W = 210
const PAGE_H = 297
const CARD = { x: 10, y: 14, w: 190, h: 90, r: 4 }
const STUB_W = 52

// --- Conditions affichées sous le billet -------------------------------------
const CONDITIONS: Array<{ title: string; body: string }> = [
  {
    title: 'Présentez votre billet',
    body: 'Affichez le QR code sur votre téléphone (luminosité au maximum) ou imprimez cette page. Gardez-le prêt avant d’arriver à l’entrée pour fluidifier le passage.',
  },
  {
    title: 'Un billet, une seule entrée',
    body: 'Chaque QR code est unique et ne peut être validé qu’une seule fois. Ne le partagez jamais (réseaux sociaux, groupes de discussion) : seule la première personne qui le présente est admise.',
  },
  {
    title: 'Pièce d’identité',
    body: 'Le nom du titulaire figure sur le billet. Une pièce d’identité peut vous être demandée à l’entrée ; l’organisateur peut refuser l’accès si les informations ne correspondent pas.',
  },
  {
    title: 'Horaires d’arrivée',
    body: 'Arrivez en avance pour passer les contrôles sans stress. L’accès peut être limité ou fermé une fois l’événement commencé, selon les règles de l’organisateur.',
  },
  {
    title: 'Règlement et sécurité',
    body: 'Respectez le règlement du lieu et les consignes du personnel (fouille, objets interdits, âge minimum, tenue). L’organisateur peut refuser l’accès à toute personne qui ne s’y conforme pas.',
  },
  {
    title: 'Transfert et revente',
    body: 'Vous pouvez offrir ce billet depuis Mon compte > Mes billets (transfert possible jusqu’à 3 fois). La revente à un prix supérieur à celui payé est interdite.',
  },
  {
    title: 'Annulation ou report',
    body: 'Si l’événement est annulé ou reporté, vous en serez informé par email et par notification. Les remboursements suivent les conditions générales de vente de Tikeo.',
  },
  {
    title: 'Perte et assistance',
    body: 'Retrouvez votre billet à tout moment dans Mon compte > Mes billets. Un souci ? Contactez-nous depuis la page Contact du site Tikeo, nous vous répondrons rapidement.',
  },
]

// --- Utilitaires ----------------------------------------------------------------
function formatAmount(n: number, currency: string) {
  // Espace normal : la police standard du PDF ne rend pas U+202F / U+00A0.
  const amount = Number(n).toLocaleString('fr-FR').replace(/[\u00A0\u202F]/g, ' ')
  return `${amount} ${currency === 'XOF' ? 'FCFA' : currency}`
}

function formatEventDate(iso: string) {
  const d = new Date(iso)
  const day = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${day} à ${hh}h${mm}`
}

function capitalize(s: string) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}

function setAlpha(doc: jsPDF, opacity: number) {
  doc.setGState(new (doc as any).GState({ opacity, 'stroke-opacity': opacity }))
}

/** Réduit la taille de police jusqu'à ce que le texte tienne dans `maxW`. */
function fitText(doc: jsPDF, text: string, maxW: number, size: number, min = 6) {
  let s = size
  doc.setFontSize(s)
  while (s > min && doc.getTextWidth(text) > maxW) {
    s -= 0.4
    doc.setFontSize(s)
  }
  return s
}

/** Tronque avec « … » si le texte dépasse encore `maxW` à la taille courante. */
function ellipsize(doc: jsPDF, text: string, maxW: number) {
  if (doc.getTextWidth(text) <= maxW) return text
  let t = text
  while (t.length > 1 && doc.getTextWidth(t + '…') > maxW) t = t.slice(0, -1)
  return t.trimEnd() + '…'
}

function poly(doc: jsPDF, pts: Array<[number, number]>, style: 'F' | 'S' | 'FD' = 'F') {
  const [first, ...rest] = pts
  const rel = rest.map((p, i) => [p[0] - (i === 0 ? first[0] : rest[i - 1][0]), p[1] - (i === 0 ? first[1] : rest[i - 1][1])])
  doc.lines(rel as any, first[0], first[1], [1, 1], style, true)
}

/**
 * Voile dégradé sans coutures : des couches translucides CUMULATIVES, chacune
 * partant d'un bord et s'arrêtant un peu plus loin. L'opacité cumulée vaut
 * `total` au bord et tombe à 0 à `size` mm du bord (h = hauteur du bloc) (pas de bandes visibles).
 */
function edgeShade(doc: jsPDF, x: number, y: number, w: number, h: number, size: number, color: RGB, total: number, from: 'top' | 'bottom', steps = 28) {
  const a = 1 - Math.pow(1 - total, 1 / steps)
  doc.setFillColor(...color)
  setAlpha(doc, a)
  for (let i = 0; i < steps; i++) {
    const len = size * (1 - i / steps)
    if (from === 'top') doc.rect(x, y, w, len, 'F')
    else doc.rect(x, y + h - len, w, len, 'F')
  }
  setAlpha(doc, 1)
}

function dashedVLine(doc: jsPDF, x: number, y1: number, y2: number, color: RGB, opacity: number) {
  setAlpha(doc, opacity)
  doc.setDrawColor(...color)
  doc.setLineWidth(0.4)
  let y = y1
  while (y < y2) {
    doc.line(x, y, x, Math.min(y + 2, y2))
    y += 3.4
  }
  setAlpha(doc, 1)
}

// --- Petites icônes vectorielles (dans un carré orange de 8 mm) ----------------
type IconName = 'calendar' | 'pin' | 'user' | 'ticket'
function drawIcon(doc: jsPDF, name: IconName, x: number, y: number) {
  const s = 8
  doc.setFillColor(...ORANGE)
  doc.roundedRect(x, y, s, s, 1.2, 1.2, 'F')
  doc.setDrawColor(...INK)
  doc.setFillColor(...INK)
  doc.setLineWidth(0.5)
  const cx = x + s / 2
  const cy = y + s / 2
  if (name === 'calendar') {
    doc.roundedRect(cx - 2.6, cy - 2.2, 5.2, 4.8, 0.6, 0.6, 'S')
    doc.line(cx - 2.6, cy - 0.5, cx + 2.6, cy - 0.5)
    doc.line(cx - 1.3, cy - 3, cx - 1.3, cy - 1.7)
    doc.line(cx + 1.3, cy - 3, cx + 1.3, cy - 1.7)
  } else if (name === 'pin') {
    doc.circle(cx, cy - 0.8, 1.9, 'S')
    poly(doc, [[cx - 1.7, cy + 0.4], [cx + 1.7, cy + 0.4], [cx, cy + 3]], 'F')
    doc.setFillColor(...ORANGE)
    doc.circle(cx, cy - 0.8, 0.7, 'F')
  } else if (name === 'user') {
    doc.circle(cx, cy - 1.2, 1.5, 'F')
    doc.ellipse(cx, cy + 2.4, 2.6, 1.8, 'F')
  } else {
    doc.roundedRect(cx - 3, cy - 2, 6, 4, 0.6, 0.6, 'S')
    doc.line(cx - 1, cy - 1.2, cx - 1, cy + 1.2)
    doc.line(cx + 0.4, cy - 0.7, cx + 2, cy - 0.7)
    doc.line(cx + 0.4, cy + 0.7, cx + 2, cy + 0.7)
  }
}

// --- Récupération de la photo de l'événement ---------------------------------------
/**
 * Charge la photo de couverture en data URI JPEG/PNG exploitable par jsPDF.
 * Serveur : fetch + Buffer (JPEG/PNG uniquement). Navigateur : fetch + canvas
 * (convertit aussi WebP/AVIF en JPEG). Toute erreur (CORS, format…) renvoie
 * null : le billet utilise alors son fond marine décoratif, sans photo.
 */
export async function loadCoverImage(url?: string | null): Promise<TicketAssets['cover']> {
  if (!url) return null
  try {
    const res = await fetch(url)
    if (!res.ok) return null

    if (typeof window === 'undefined') {
      // Repli serveur (sans conversion) : on reconnaît le format par les octets, pas par
      // l'en-tête Content-Type (souvent absent ou générique). Les autres formats (WebP, AVIF,
      // GIF, SVG) sont convertis par loadServerCover() de server/utils/ticketPdf.ts.
      const buf = Buffer.from(await res.arrayBuffer())
      const isPng = buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
      const isJpeg = buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8
      if (!isPng && !isJpeg) return null
      const dataUrl = `data:${isPng ? 'image/png' : 'image/jpeg'};base64,${buf.toString('base64')}`
      const dim = readImageSize(buf, isPng)
      if (!dim) return null
      return { dataUrl, format: isPng ? 'PNG' : 'JPEG', ...dim }
    }

    const blob = await res.blob()
    const bitmapUrl = URL.createObjectURL(blob)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image()
        el.onload = () => resolve(el)
        el.onerror = reject
        el.src = bitmapUrl
      })
      const maxSide = 1400
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      if (!ctx) return null
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), format: 'JPEG', width: canvas.width, height: canvas.height }
    } finally {
      URL.revokeObjectURL(bitmapUrl)
    }
  } catch (e) {
    console.warn('[ticketPdf] photo de couverture ignorée :', e)
    return null
  }
}

/** Dimensions d'un PNG / JPEG lues dans les octets (côté serveur, sans dépendance). */
function readImageSize(buf: Buffer, isPng: boolean): { width: number; height: number } | null {
  try {
    if (isPng) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
    let i = 2
    while (i < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const marker = buf[i + 1]
      const len = buf.readUInt16BE(i + 2)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) }
      }
      i += 2 + len
    }
  } catch { /* image illisible : pas de photo */ }
  return null
}

export async function loadTicketAssets(coverUrl?: string | null): Promise<TicketAssets> {
  return { cover: await loadCoverImage(coverUrl) }
}

async function makeQr(token?: string | null): Promise<string | null> {
  if (!token) return null
  try {
    return await QRCode.toDataURL(token, { margin: 0, width: 420, errorCorrectionLevel: 'M', color: { dark: '#0A1A34', light: '#FFFFFFFF' } })
  } catch (e) {
    console.error('[ticketPdf] échec génération QR code :', e)
    return null
  }
}

// --- Le billet (carte) ----------------------------------------------------------------
function drawCard(doc: jsPDF, tk: TicketSheetInput, qr: string | null, assets: TicketAssets) {
  const { x, y, w, h, r } = CARD
  const mainW = w - STUB_W
  const xs = x + mainW // abscisse de la perforation
  const isFree = Number(tk.price) === 0

  doc.saveGraphicsState()
  doc.roundedRect(x, y, w, h, r, r, null as any)
  doc.clip()
  ;(doc as any).discardPath?.()

  // ---------- Fond marine ----------
  doc.setFillColor(...INK)
  doc.rect(x, y, w, h, 'F')

  // ---------- Photo + voile marine ----------
  if (assets.cover) {
    const { dataUrl, format, width: iw, height: ih } = assets.cover
    const scale = Math.max(mainW / iw, h / ih)
    const dw = iw * scale
    const dh = ih * scale
    doc.saveGraphicsState()
    doc.rect(x, y, mainW, h, null as any)
    doc.clip()
    ;(doc as any).discardPath?.()
    doc.addImage(dataUrl, format, x + (mainW - dw) / 2, y + (h - dh) / 2, dw, dh, undefined, 'FAST')
    doc.restoreGraphicsState()
    // Voile marine général, renforcé en haut (logo, ruban, titre) et en bas (infos).
    doc.setFillColor(...INK)
    setAlpha(doc, 0.42)
    doc.rect(x, y, mainW, h, 'F')
    setAlpha(doc, 1)
    edgeShade(doc, x, y, mainW, h, h * 0.5, INK, 0.88, 'top')
    edgeShade(doc, x, y, mainW, h, h * 0.6, INK, 0.92, 'bottom')
  } else {
    edgeShade(doc, x, y, mainW, h, h, INK_SOFT, 0.55, 'top')
    // Halos orange très discrets, façon projecteurs.
    doc.setFillColor(...ORANGE)
    for (let i = 0; i < 6; i++) {
      setAlpha(doc, 0.05)
      doc.circle(x + mainW - 8, y + h * 0.5, 14 + i * 11, 'F')
    }
    setAlpha(doc, 1)
  }

  // ---------- Talon (fond plus profond) ----------
  doc.setFillColor(...INK_DEEP)
  doc.rect(xs, y, STUB_W, h, 'F')
  edgeShade(doc, xs, y, STUB_W, h, h, INK_SOFT, 0.5, 'top')

  // Coin décoratif haut-droit du talon : bandes bleue + orange.
  doc.setFillColor(...BLUE)
  poly(doc, [[x + w - 20, y], [x + w, y], [x + w, y + 20]])
  doc.setFillColor(...ORANGE)
  poly(doc, [[x + w - 12, y], [x + w - 8, y], [x + w, y + 8], [x + w, y + 12]])

  // Bandes décoratives en bas à gauche du billet (orange + bleu).
  doc.setFillColor(...ORANGE)
  poly(doc, [[x, y + h - 3.2], [x + 74, y + h - 3.2], [x + 68, y + h], [x, y + h]])
  doc.setFillColor(...BLUE)
  poly(doc, [[x + 77, y + h - 3.2], [x + 112, y + h - 3.2], [x + 106, y + h], [x + 71, y + h]])

  // ---------- Logo ----------
  doc.addImage(TICKET_LOGO_DATA_URL, 'PNG', x + 7, y + 4.5, 31, 31 * (135 / 420))

  // ---------- Ruban : type de billet ----------
  const rx0 = x + 52
  const rx1 = x + mainW
  const rh = 13
  doc.setFillColor(...ORANGE)
  poly(doc, [[rx0 + 6, y], [rx1, y], [rx1, y + rh], [rx0, y + rh]])
  setAlpha(doc, 0.28)
  doc.setFillColor(...GOLD)
  poly(doc, [[rx0 + 6, y], [rx1, y], [rx1, y + rh * 0.42], [rx0 + 4.4, y + rh * 0.42]])
  setAlpha(doc, 1)
  const typeLabel = (tk.typeName || 'Billet').toUpperCase()
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...INK)
  const typeW = rx1 - rx0 - 14
  fitText(doc, typeLabel, typeW, 12, 6.5)
  doc.text(ellipsize(doc, typeLabel, typeW), (rx0 + 4 + rx1) / 2, y + rh / 2 + 1.5, { align: 'center' })

  // ---------- Titre ----------
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...WHITE)
  const titleMaxW = mainW - 16
  const title = (tk.eventTitle || '').toUpperCase()
  let titleSize = 19
  doc.setFontSize(titleSize)
  let titleLines: string[] = doc.splitTextToSize(title, titleMaxW)
  if (titleLines.length > 1) {
    // Deux lignes : on essaie d'abord de tout tenir sur une ligne un peu plus petite.
    const oneLine = fitText(doc, title, titleMaxW, 19, 14.5)
    if (doc.getTextWidth(title) <= titleMaxW) {
      titleSize = oneLine
      titleLines = [title]
    } else {
      titleSize = 14.5
      doc.setFontSize(titleSize)
      const all: string[] = doc.splitTextToSize(title, titleMaxW)
      titleLines = all.slice(0, 2)
      if (all.length > 2) {
        let last = titleLines[1]
        while (last.length > 1 && doc.getTextWidth(last + '…') > titleMaxW) last = last.slice(0, -1)
        titleLines[1] = last.trimEnd() + '…'
      }
    }
  }
  doc.setFontSize(titleSize)
  const lineH = titleSize * 0.4
  const titleTop = y + 26
  titleLines.forEach((l, i) => doc.text(l, x + 8, titleTop + i * lineH))
  const titleBottom = titleTop + (titleLines.length - 1) * lineH
  doc.setFillColor(...ORANGE)
  doc.rect(x + 8, titleBottom + 2.4, 34, 0.9, 'F')

  // ---------- Informations ----------
  const gridTop = titleBottom + 8
  const gridBottom = y + h - 7
  const rowH = Math.min(13.5, (gridBottom - gridTop) / 3)
  const textX = x + 8 + 11
  const valueMaxW = mainW - 8 - 11 - 8

  const field = (icon: IconName, label: string, value: string, fx: number, fy: number, maxW: number) => {
    drawIcon(doc, icon, fx, fy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(...ORANGE_LIGHT)
    doc.text(label, fx + 11, fy + 2.7, { charSpace: 0.4 })
    doc.setTextColor(...WHITE)
    fitText(doc, value, maxW, 10.5, 7.5)
    doc.text(ellipsize(doc, value, maxW), fx + 11, fy + 7.1)
  }

  field('calendar', 'DATE & HEURE', capitalize(formatEventDate(tk.eventDate)), x + 8, gridTop, valueMaxW)
  field('pin', 'LIEU', tk.eventLocation || 'Lieu communiqué par l’organisateur', x + 8, gridTop + rowH, valueMaxW)
  const halfW = (mainW - 16) / 2
  field('user', 'TITULAIRE', (tk.holderName || '—').toUpperCase(), x + 8, gridTop + rowH * 2, halfW - 14)
  field('ticket', 'N° DE BILLET', tk.ticketNumber, x + 8 + halfW, gridTop + rowH * 2, halfW - 14)
  void textX

  // ---------- Talon : contenu ----------
  const cx = xs + STUB_W / 2
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(...ORANGE_LIGHT)
  doc.text('BILLET ÉLECTRONIQUE', cx - 3, y + 8.5, { align: 'center', charSpace: 0.35 })

  // Cadre doré + QR sur fond blanc
  const fy = y + 12
  doc.setFillColor(...ORANGE_LIGHT)
  doc.roundedRect(cx - 20, fy, 40, 40, 2.6, 2.6, 'F')
  doc.setFillColor(...INK_DEEP)
  doc.roundedRect(cx - 19.2, fy + 0.8, 38.4, 38.4, 2.1, 2.1, 'F')
  doc.setFillColor(...WHITE)
  doc.roundedRect(cx - 17.8, fy + 2.2, 35.6, 35.6, 1.6, 1.6, 'F')
  if (qr) {
    doc.addImage(qr, 'PNG', cx - 15.5, fy + 4.5, 31, 31)
  } else {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6)
    doc.setTextColor(...GRAY)
    doc.text('QR indisponible', cx, fy + 20, { align: 'center' })
  }

  doc.setFont('courier', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...MUTED)
  doc.text(ellipsize(doc, tk.ticketNumber, STUB_W - 8), cx, fy + 45, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(6.2)
  doc.setTextColor(...MUTED)
  doc.text('PRIX', cx, fy + 52, { align: 'center', charSpace: 0.8 })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(...ORANGE_LIGHT)
  const priceText = isFree ? 'GRATUIT' : formatAmount(tk.price, tk.currency)
  fitText(doc, priceText, STUB_W - 10, 14, 8)
  doc.text(priceText, cx, fy + 59, { align: 'center' })

  if (tk.count && tk.count > 0) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.2)
    doc.setTextColor(...WHITE)
    doc.text(`BILLET ${tk.index ?? 1} / ${tk.count}`, cx, y + h - 6.2, { align: 'center', charSpace: 0.4 })
  }

  // Texte vertical le long de la perforation
  setAlpha(doc, 0.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5)
  doc.setTextColor(...WHITE)
  doc.text('TIKEO · BILLET ÉLECTRONIQUE', xs + 4.1, y + h - 9, { angle: 90, charSpace: 0.5 })
  setAlpha(doc, 1)

  // Perforation pointillée
  dashedVLine(doc, xs, y + 5, y + h - 5, WHITE, 0.55)

  doc.restoreGraphicsState()

  // Liseré orange autour de la carte
  doc.setDrawColor(...ORANGE_LIGHT)
  doc.setLineWidth(0.45)
  doc.roundedRect(x, y, w, h, r, r, 'S')

  // Encoches (couleur du papier) sur la perforation
  doc.setFillColor(...WHITE)
  doc.setDrawColor(...ORANGE_LIGHT)
  doc.circle(xs, y, 3.6, 'F')
  doc.circle(xs, y + h, 3.6, 'F')
}

// --- Conditions (sous le billet) ----------------------------------------------------------
function drawConditions(doc: jsPDF, tk: TicketSheetInput) {
  const left = CARD.x
  const fullW = CARD.w
  let y = CARD.y + CARD.h + 15

  // Titre de section
  doc.setFillColor(...ORANGE)
  doc.rect(left, y - 5.6, 2.4, 11, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(15)
  doc.setTextColor(...INK)
  doc.text('Conditions d’accès & consignes', left + 6, y + 0.2)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(...GRAY)
  doc.text('À lire avant de vous rendre à l’événement. En présentant ce billet, vous acceptez ces règles.', left + 6, y + 5.2)
  y += 13

  // Grille 2 colonnes d'éléments numérotés
  const gap = 8
  const colW = (fullW - gap) / 2
  const textW = colW - 12
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  const rows: number[] = []
  const wrapped = CONDITIONS.map((c) => doc.splitTextToSize(c.body, textW) as string[])
  for (let i = 0; i < CONDITIONS.length; i += 2) {
    const lines = Math.max(wrapped[i].length, wrapped[i + 1]?.length ?? 0)
    rows.push(8.4 + lines * 3.7 + 4)
  }

  let rowY = y
  rows.forEach((rowH, r) => {
    ;[0, 1].forEach((c) => {
      const idx = r * 2 + c
      if (!CONDITIONS[idx]) return
      const ix = left + c * (colW + gap)
      // Pastille numérotée
      doc.setFillColor(...INK)
      doc.rect(ix, rowY, 8, 8, 'F')
      doc.setFillColor(...ORANGE)
      doc.rect(ix, rowY + 8, 8, 0.9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(...WHITE)
      doc.text(String(idx + 1), ix + 4, rowY + 5.5, { align: 'center' })
      // Titre + texte
      doc.setFontSize(9.2)
      doc.setTextColor(...TEXT)
      doc.text(CONDITIONS[idx].title, ix + 11.5, rowY + 3.2)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.setTextColor(...GRAY)
      doc.text(wrapped[idx], ix + 11.5, rowY + 8.2, { lineHeightFactor: 1.32 })
    })
    rowY += rowH
    if (r < rows.length - 1) {
      doc.setDrawColor(...LINE)
      doc.setLineWidth(0.25)
      doc.line(left, rowY - 2.4, left + fullW, rowY - 2.4)
    }
  })

  // Encadré « À retenir »
  const boxY = rowY + 2
  const boxH = 17
  doc.setFillColor(...INK)
  doc.rect(left, boxY, fullW, boxH, 'F')
  doc.setFillColor(...ORANGE)
  doc.rect(left, boxY, 2.4, boxH, 'F')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ORANGE_LIGHT)
  doc.text('À RETENIR', left + 8, boxY + 5.6, { charSpace: 0.6 })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.6)
  doc.setTextColor(...WHITE)
  const note = doc.splitTextToSize(
    'Ce billet est personnel et ne vaut que pour une seule entrée. Toute copie, photo ou capture d’écran diffusée peut empêcher votre propre accès.',
    fullW - 16
  )
  doc.text(note, left + 8, boxY + 10.6, { lineHeightFactor: 1.3 })

  // Pied de page
  const footY = PAGE_H - 12
  doc.setDrawColor(...LINE)
  doc.setLineWidth(0.3)
  doc.line(left, footY - 4.5, left + fullW, footY - 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(...INK)
  doc.text('Tikeo', left, footY)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...GRAY)
  doc.text('— La billetterie simple et intelligente', left + 9.2, footY)
  const right = `Commande ${tk.orderNumber}${tk.count ? `  ·  Billet ${tk.index ?? 1}/${tk.count}` : ''}`
  doc.text(right, left + fullW, footY, { align: 'right' })
}

// --- API publique -------------------------------------------------------------------------------
/** Dessine UNE page (billet + conditions) sur la page courante du document. */
export async function drawTicketSheet(doc: jsPDF, tk: TicketSheetInput, assets: TicketAssets) {
  const qr = await makeQr(tk.qrToken)
  doc.setFillColor(...WHITE)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  drawCard(doc, tk, qr, assets)
  drawConditions(doc, tk)
}

/** Construit un document A4 portrait : une page par billet. */
export async function buildTicketDoc(JsPDF: JsPdfCtor, tickets: TicketSheetInput[], assets: TicketAssets): Promise<jsPDF> {
  const doc = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true })
  for (let i = 0; i < tickets.length; i++) {
    if (i > 0) doc.addPage('a4', 'portrait')
    await drawTicketSheet(doc, tickets[i], assets)
  }
  return doc
}
