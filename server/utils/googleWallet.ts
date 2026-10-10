import { createSign } from 'node:crypto'

/**
 * Génère le lien « Ajouter au Google Wallet » d'un billet.
 *
 * Contrairement à Apple Wallet, Google Wallet n'exige pas de fichier signé :
 * on construit un JWT « Save to Wallet » (RS256, signé avec la clé privée du
 * compte de service) qui contient la CLASSE et l'OBJET du billet directement
 * dans son payload — Google les crée/actualise lui-même à l'ouverture du lien,
 * sans appel API préalable depuis notre serveur.
 *
 * Configuration requise (voir .env.example) :
 *   GOOGLE_WALLET_ISSUER_ID            identifiant de l'émetteur (Wallet Console)
 *   GOOGLE_WALLET_SERVICE_ACCOUNT_JSON JSON de la clé du compte de service (une ligne)
 *
 * Tant qu'un émetteur Google Wallet n'a pas été approuvé pour la production,
 * les classes restent en « reviewStatus: underReview » : le lien fonctionne
 * pour les comptes testeurs déclarés dans la Wallet Console, pas pour le grand
 * public — c'est une limite du programme Google, pas de cette intégration.
 */

interface ServiceAccountJson {
  client_email: string
  private_key: string
}

interface GoogleWalletTicketInput {
  ticketId: string
  ticketNumber: string
  qrToken: string
  eventTitle: string
  eventStartDate: string // ISO
  eventEndDate?: string | null
  venueName?: string | null
  address?: string | null
  ticketTypeName: string
  holderName: string
}

function base64url(input: Buffer | string): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function safeId(value: string): string {
  // Google exige un identifiant sans caractères spéciaux au-delà de . _ - dans le suffixe.
  return value.replace(/[^A-Za-z0-9_-]/g, '_')
}

export function isGoogleWalletConfigured(): boolean {
  const config = useRuntimeConfig()
  return !!(config.googleWalletIssuerId && config.googleWalletServiceAccountJson)
}

export function buildGoogleWalletSaveUrl(input: GoogleWalletTicketInput): string {
  const config = useRuntimeConfig()
  if (!config.googleWalletIssuerId || !config.googleWalletServiceAccountJson) {
    throw createError({ statusCode: 501, statusMessage: 'GOOGLE_WALLET_NOT_CONFIGURED' })
  }

  let account: ServiceAccountJson
  try {
    account = JSON.parse(config.googleWalletServiceAccountJson)
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'GOOGLE_WALLET_BAD_SERVICE_ACCOUNT' })
  }

  const issuerId = config.googleWalletIssuerId
  const classSuffix = safeId(input.ticketNumber.split('-').slice(0, 2).join('_')) || 'event'
  const classId = `${issuerId}.tikeo_${classSuffix}`
  const objectId = `${issuerId}.ticket_${safeId(input.ticketId)}`

  const eventTicketClass = {
    id: classId,
    issuerName: 'Tikeo',
    reviewStatus: 'underReview',
    eventName: { defaultValue: { language: 'fr-FR', value: input.eventTitle } },
    ...(input.venueName || input.address
      ? {
          venue: {
            name: { defaultValue: { language: 'fr-FR', value: input.venueName || '' } },
            address: { defaultValue: { language: 'fr-FR', value: input.address || '' } },
          },
        }
      : {}),
    dateTime: {
      start: input.eventStartDate,
      ...(input.eventEndDate ? { end: input.eventEndDate } : {}),
    },
    hexBackgroundColor: '#FF7A00',
  }

  const eventTicketObject = {
    id: objectId,
    classId,
    state: 'active',
    ticketHolderName: input.holderName,
    ticketNumber: input.ticketNumber,
    ticketType: { defaultValue: { language: 'fr-FR', value: input.ticketTypeName } },
    barcode: { type: 'QR_CODE', value: input.qrToken, alternateText: input.ticketNumber },
  }

  const payload = {
    iss: account.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [] as string[],
    payload: {
      eventTicketClasses: [eventTicketClass],
      eventTicketObjects: [eventTicketObject],
    },
  }

  const header = { alg: 'RS256', typ: 'JWT' }
  const data = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`
  const signer = createSign('RSA-SHA256')
  signer.update(data)
  signer.end()
  const signature = signer.sign(account.private_key)
  const jwt = `${data}.${base64url(signature)}`

  return `https://pay.google.com/gp/v/save/${jwt}`
}
