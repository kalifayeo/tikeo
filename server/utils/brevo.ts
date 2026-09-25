const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email'

interface SendEmailOptions {
  to: string
  toName?: string
  subject: string
  htmlContent: string
}

export async function sendTransactionalEmail(options: SendEmailOptions) {
  const config = useRuntimeConfig()

  if (!config.brevoApiKey) {
    // En dev sans clé Brevo configurée, on log le contenu au lieu d'échouer
    // silencieusement — pratique pour tester le flow OTP en local.
    console.warn('[brevo] BREVO_API_KEY manquant — email non envoyé, contenu :', options)
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
}

interface TicketsEmailOptions {
  orderNumber: string
  total: number
  currency: string
  eventTitle: string
  eventDate: string
  eventLocation: string
  tickets: TicketsEmailTicket[]
}

/**
 * Email envoyé à l'acheteur juste après confirmation d'un paiement
 * (voir supabase/migrations/0019_confirm_order_payment.sql et
 * server/api/orders/[id]/confirm-payment.post.ts). Contient les numéros de
 * billets : c'est la preuve d'achat que l'acheteur présente à l'entrée.
 */
export function ticketsEmailTemplate(options: TicketsEmailOptions) {
  const formattedDate = new Date(options.eventDate).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const rows = options.tickets
    .map(
      (tk) => `
        <tr>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;font-family:monospace;">${tk.ticket_number}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;">${tk.type_name}</td>
          <td style="padding:8px 4px;border-bottom:1px solid #eee;text-align:right;">${tk.price.toLocaleString('fr-FR')} FCFA</td>
        </tr>`
    )
    .join('')

  return {
    subject: `Vos billets Tikeo — ${options.eventTitle}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto;">
        <h2 style="color:#FF7A00;">Tikeo</h2>
        <p>Merci pour votre achat ! Votre paiement a bien été reçu et vos billets sont prêts.</p>
        <div style="background:#F7F7F7;padding:14px 16px;margin:16px 0;">
          <p style="margin:0;font-weight:bold;">${options.eventTitle}</p>
          <p style="margin:4px 0 0;color:#555;">${formattedDate}</p>
          <p style="margin:4px 0 0;color:#555;">${options.eventLocation}</p>
        </div>
        <p style="margin-bottom:4px;">Commande <strong>${options.orderNumber}</strong> — ${options.total.toLocaleString('fr-FR')} ${options.currency}</p>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;font-size:14px;">
          <thead>
            <tr style="text-align:left;color:#888;text-transform:uppercase;font-size:11px;">
              <th style="padding:4px;">N° de billet</th>
              <th style="padding:4px;">Type</th>
              <th style="padding:4px;text-align:right;">Prix</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="margin-top:20px;">Présentez ces numéros de billets (ou cet email) à l'entrée de l'événement.</p>
        <p style="color:#888;font-size:12px;">Si vous n'êtes pas à l'origine de cet achat, contactez notre support.</p>
      </div>
    `,
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
