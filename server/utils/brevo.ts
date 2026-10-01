import QRCode from 'qrcode'
import { buildIndividualTicketPdfs } from './ticketPdf'

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

interface EmailAttachment {
  /** Nom de fichier affiché au destinataire (ex. "billets-TIK-2026-0001.pdf"). */
  name: string
  /** Contenu du fichier encodé en base64 (format attendu par l'API Brevo). */
  content: string
}

interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  htmlContent: string
  attachments?: EmailAttachment[]
}

export async function sendTransactionalEmail(options: SendEmailOptions) {
  const config = useRuntimeConfig()

  if (!config.brevoApiKey) {
    // En dev sans clé Brevo configurée, on log le contenu au lieu d'échouer
    // silencieusement — pratique pour tester le flow OTP en local.
    console.warn('[brevo] BREVO_API_KEY manquant — email non envoyé, contenu :', {
      ...options,
      attachments: options.attachments?.map((a) => ({ name: a.name, bytes: a.content.length })),
    })
    return
  }

  const response = await $fetch.raw(BREVO_API_URL, {
    method: 'POST',
    headers: {
      'api-key': config.brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: {
      sender: { name: config.brevoSenderName, email: config.brevoSenderEmail },
      to: [{ email: options.to, name: options.toName || options.to }],
      subject: options.subject,
      htmlContent: options.htmlContent,
      ...(options.attachments?.length ? { attachment: options.attachments.map((a) => ({ name: a.name, content: a.content })) } : {}),
    },
    ignoreResponseError: true,
  })

  if (response.status >= 400) {
    console.error('[brevo] Échec envoi email', response.status, response._data)
    throw createError({ statusCode: 502, statusMessage: "Échec de l'envoi de l'email via Brevo." })
  }
}

interface TicketsEmailTicket {
  ticket_number: string
  type_name: string
  price: number
  /** Jeton unique du billet (colonne tickets.qr_token) — encodé dans le QR affiché sur le billet. */
  qr_token?: string | null
}

interface TicketsEmailOptions {
  orderNumber: string
  total: number
  currency: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  /** Photo de couverture de l'événement (events.cover_image) — bandeau en haut du billet. */
  eventCoverImage?: string | null
  tickets: TicketsEmailTicket[]
}

function formatAmount(n: number, currency: string) {
  return `${n.toLocaleString('fr-FR')} ${currency === 'XOF' ? 'F CFA' : currency}`
}

/** Bandeau de secours quand l'événement n'a pas de photo de couverture (dégradé Tikeo + titre). */
function coverBannerHtml(eventTitle: string, coverImage?: string | null) {
  if (coverImage) {
    return `<img src="${coverImage}" width="560" alt="${eventTitle}" style="display:block;width:100%;max-width:560px;height:170px;object-fit:cover;background:#111;" />`
  }
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;">
      <tr>
        <td height="170" align="center" valign="middle" style="height:170px;background:linear-gradient(135deg,#FF7A00,#FF9D45);">
          <span style="font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#fff;">Tikeo</span>
        </td>
      </tr>
    </table>`
}

/** Génère un QR code (PNG en data URI) à partir du jeton du billet — fallback discret si la génération échoue. */
async function qrDataUrl(token: string | null | undefined): Promise<string | null> {
  if (!token) return null
  try {
    return await QRCode.toDataURL(token, { margin: 1, width: 220, color: { dark: '#111111', light: '#FFFFFFFF' } })
  } catch (e) {
    console.error('[brevo] échec génération QR code billet :', e)
    return null
  }
}

/**
 * Email envoyé à l'acheteur juste après confirmation d'un paiement — ou
 * juste après récupération d'un billet gratuit sans paiement (voir
 * supabase/migrations/0019 & 0025_confirm_order_payment_ticket_visuals.sql,
 * server/api/orders/[id]/confirm-payment.post.ts et
 * server/api/orders/[id]/claim-free.post.ts).
 *
 * Chaque billet est rendu comme une carte soignée : photo de l'événement,
 * infos essentielles, et QR code (encodant tickets.qr_token) — c'est la
 * preuve d'achat scannée à l'entrée.
 */
export async function ticketsEmailTemplate(options: TicketsEmailOptions) {
  const isFree = Number(options.total) === 0

  // Les billets « officiels », avec un vrai design (talon détachable, QR
  // code, logo Tikeo), sont générés en PDF et joints à l'email — voir
  // server/utils/ticketPdf.ts. Le corps HTML ci-dessous reste un aperçu
  // rapide ; le(s) PDF joint(s) sont la version à imprimer / présenter à
  // l'entrée.
  //
  // IMPORTANT : chaque billet est joint en tant que PDF SÉPARÉ (et non plus
  // un seul PDF multi-pages regroupant toute la commande). Si l'acheteur a
  // pris 2, 3 ou N billets, l'email contient donc N pièces jointes
  // distinctes — plus simples à transférer ou imprimer individuellement,
  // par exemple pour donner un seul billet à un proche.
  let pdfAttachments: { name: string; content: string }[] = []
  try {
    pdfAttachments = await buildIndividualTicketPdfs({
      orderNumber: options.orderNumber,
      total: options.total,
      currency: options.currency,
      eventTitle: options.eventTitle,
      eventDate: options.eventDate,
      eventLocation: options.eventLocation,
      eventCoverImage: options.eventCoverImage,
      tickets: options.tickets,
    })
  } catch (e) {
    console.error('[brevo] échec génération des PDF des billets (email envoyé sans pièce jointe) :', e)
  }
  const formattedDate = new Date(options.eventDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const banner = coverBannerHtml(options.eventTitle, options.eventCoverImage)

  const ticketCards = (
    await Promise.all(
      options.tickets.map(async (tk) => {
        const qr = await qrDataUrl(tk.qr_token)
        const priceBadge = isFree
          ? `<span style="display:inline-block;padding:2px 10px;background:#E9F9EF;color:#1B8A4C;font-size:11px;font-weight:700;border-radius:999px;text-transform:uppercase;letter-spacing:0.5px;">Gratuit</span>`
          : `<span style="font-size:13px;color:#555;">${formatAmount(tk.price, options.currency)}</span>`

        return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="width:100%;max-width:560px;margin:0 auto 18px;border:1px solid #ECECEC;border-radius:14px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;">
        <tr><td>${banner}</td></tr>
        <tr>
          <td style="padding:18px 22px 4px;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1px;color:#FF7A00;text-transform:uppercase;">Billet Tikeo</p>
            <h1 style="margin:0 0 10px;font-size:19px;line-height:1.3;color:#111;">${options.eventTitle}</h1>
            <p style="margin:0 0 3px;font-size:13px;color:#555;">📅&nbsp; ${formattedDate}</p>
            <p style="margin:0;font-size:13px;color:#555;">📍&nbsp; ${options.eventLocation || 'Lieu communiqué par l’organisateur'}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:14px 22px 0;">
            <div style="border-top:1px dashed #DDDDDD;"></div>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 22px 20px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="vertical-align:middle;">
                  <p style="margin:0;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Type de billet</p>
                  <p style="margin:2px 0 12px;font-size:15px;font-weight:700;color:#111;">${tk.type_name}</p>
                  <p style="margin:0;font-size:10px;font-weight:700;color:#999;text-transform:uppercase;letter-spacing:0.5px;">N° de billet</p>
                  <p style="margin:2px 0 10px;font-family:'Courier New',monospace;font-size:15px;font-weight:700;color:#111;letter-spacing:0.5px;">${tk.ticket_number}</p>
                  ${priceBadge}
                </td>
                <td width="112" style="width:112px;text-align:center;vertical-align:middle;">
                  ${
                    qr
                      ? `<img src="${qr}" width="100" height="100" alt="QR code du billet ${tk.ticket_number}" style="display:block;width:100px;height:100px;border:1px solid #ECECEC;border-radius:10px;padding:6px;background:#fff;" />`
                      : `<span style="display:inline-block;width:100px;height:100px;line-height:100px;text-align:center;font-size:10px;color:#999;border:1px dashed #DDD;border-radius:10px;">QR code</span>`
                  }
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`
      })
    )
  ).join('')

  const introText = isFree
    ? 'Bonne nouvelle : votre billet gratuit est confirmé, sans aucun paiement. Présentez le QR code ci-dessous — ou le PDF joint à cet email — à l’entrée.'
    : 'Merci pour votre achat ! Votre paiement a bien été reçu et vos billets sont prêts. Présentez le QR code de chaque billet — ou le PDF joint à cet email — à l’entrée.'

  const totalLine = isFree ? 'Gratuit' : formatAmount(options.total, options.currency)

  const pdfNotice =
    pdfAttachments.length === 1
      ? `<p style="margin:14px 0 0;padding:10px 14px;background:#FFF6EE;border:1px solid #FFE1C2;border-radius:10px;font-size:12.5px;color:#8A4B00;">📎 Votre billet est aussi joint à cet email au format PDF (<strong>${pdfAttachments[0].name}</strong>), prêt à imprimer.</p>`
      : pdfAttachments.length > 1
        ? `<p style="margin:14px 0 0;padding:10px 14px;background:#FFF6EE;border:1px solid #FFE1C2;border-radius:10px;font-size:12.5px;color:#8A4B00;">📎 Vos ${pdfAttachments.length} billets sont aussi joints à cet email, chacun dans un PDF séparé, prêts à imprimer ou à transmettre individuellement.</p>`
        : ''

  return {
    subject: isFree ? `Votre billet gratuit Tikeo — ${options.eventTitle}` : `Vos billets Tikeo — ${options.eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 8px;">
        <h2 style="color:#FF7A00;margin:0 0 4px;">Tikeo</h2>
        <p style="color:#333;">${introText}</p>
        ${pdfNotice}
        ${ticketCards}
        <p style="margin:18px 0 4px;font-size:13px;color:#555;">Commande <strong style="color:#111;">${options.orderNumber}</strong> — ${totalLine}</p>
        <p style="margin-top:16px;font-size:13px;color:#333;">Retrouvez aussi vos billets à tout moment dans votre espace Tikeo, rubrique « Mes billets ».</p>
        <p style="color:#888;font-size:12px;margin-top:20px;">Si vous n'êtes pas à l'origine de cette réservation, contactez notre support.</p>
      </div>
    `,
    attachments: pdfAttachments,
  }
}

export function otpEmailTemplate(code: string, purpose: 'signup' | 'login' | 'reset_password') {
  const intro: Record<typeof purpose, string> = {
    signup: 'Voici votre code pour confirmer la création de votre compte Tikeo :',
    login: 'Voici votre code de connexion à Tikeo :',
    reset_password: 'Voici votre code pour réinitialiser votre mot de passe Tikeo :',
  } as const

  return {
    subject: 'Votre code de vérification Tikeo',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
        <h2 style="color:#FF7A00;">Tikeo</h2>
        <p>${intro[purpose]}</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; margin: 24px 0;">${code}</p>
        <p>Ce code expire dans quelques minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      </div>
    `,
  }
}
