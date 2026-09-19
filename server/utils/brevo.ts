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
