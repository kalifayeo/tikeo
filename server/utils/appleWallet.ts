import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import forge from 'node-forge'
import JSZip from 'jszip'

/**
 * Construit un fichier .pkpass (Apple Wallet) pour un billet.
 *
 * Un .pkpass est une archive ZIP contenant :
 *   - pass.json               le contenu du billet (type eventTicket) ;
 *   - icon.png / icon@2x.png / logo.png / logo@2x.png   les visuels (voir plus bas) ;
 *   - manifest.json           l'empreinte SHA-1 de chacun des fichiers ci-dessus ;
 *   - signature               la signature PKCS#7 DÉTACHÉE du manifest, produite
 *                             avec le certificat de Pass Type + le certificat
 *                             intermédiaire Apple WWDR (voir .env.example).
 *
 * Sans ces certificats (délivrés uniquement via un compte Apple Developer
 * payant), la génération est impossible — Apple vérifie la signature avant
 * d'accepter d'ouvrir un pass, il n'existe aucun moyen de la contourner ni de
 * la simuler. `isAppleWalletConfigured()` permet de masquer le bouton tant
 * que ces variables ne sont pas renseignées.
 */

interface AppleWalletTicketInput {
  ticketId: string
  ticketNumber: string
  qrToken: string
  eventTitle: string
  eventStartDate: string // ISO
  venueName?: string | null
  address?: string | null
  ticketTypeName: string
}

export function isAppleWalletConfigured(): boolean {
  const c = useRuntimeConfig()
  return !!(c.appleWalletTeamId && c.appleWalletPassTypeId && c.appleWalletCertBase64 && c.appleWalletKeyBase64 && c.appleWalletWwdrBase64)
}

function sha1(buf: Buffer): string {
  return createHash('sha1').update(buf).digest('hex')
}

async function loadIconBuffer(): Promise<Buffer> {
  // Réutilise l'icône PWA existante (192×192) pour les 4 visuels requis par
  // Apple ; ce n'est pas la résolution exacte recommandée pour chaque rôle,
  // mais un pass fonctionnel et lisible plutôt qu'un jeu d'images sur mesure.
  try {
    return await readFile(new URL('../../public/icon-192.png', import.meta.url))
  } catch {
    return await readFile(new URL('../../public/logo-tikeo.png', import.meta.url))
  }
}

function formatDateTimeFr(iso: string): string {
  return new Date(iso).toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export async function buildApplePkpass(input: AppleWalletTicketInput): Promise<Buffer> {
  const config = useRuntimeConfig()
  if (!isAppleWalletConfigured()) {
    throw createError({ statusCode: 501, statusMessage: 'APPLE_WALLET_NOT_CONFIGURED' })
  }

  const passJson = {
    formatVersion: 1,
    passTypeIdentifier: config.appleWalletPassTypeId,
    serialNumber: input.ticketId,
    teamIdentifier: config.appleWalletTeamId,
    organizationName: 'Tikeo',
    description: `Billet — ${input.eventTitle}`,
    logoText: 'Tikeo',
    foregroundColor: 'rgb(255,255,255)',
    backgroundColor: 'rgb(255,122,0)',
    labelColor: 'rgb(255,255,255)',
    relevantDate: input.eventStartDate,
    eventTicket: {
      primaryFields: [{ key: 'event', label: 'ÉVÉNEMENT', value: input.eventTitle }],
      secondaryFields: [
        { key: 'date', label: 'DATE', value: formatDateTimeFr(input.eventStartDate) },
        ...(input.venueName || input.address
          ? [{ key: 'venue', label: 'LIEU', value: input.venueName || input.address || '' }]
          : []),
      ],
      auxiliaryFields: [{ key: 'type', label: 'BILLET', value: input.ticketTypeName }],
      backFields: [
        { key: 'ticketNumber', label: 'Numéro de billet', value: input.ticketNumber },
        { key: 'terms', label: 'Conditions', value: 'Billet nominatif, non remboursable. Voir tikeo.com/conditions.' },
      ],
    },
    barcodes: [{ format: 'PKBarcodeFormatQR', message: input.qrToken, messageEncoding: 'iso-8859-1', altText: input.ticketNumber }],
  }

  const iconBuffer = await loadIconBuffer()

  const files: Record<string, Buffer> = {
    'pass.json': Buffer.from(JSON.stringify(passJson), 'utf8'),
    'icon.png': iconBuffer,
    'icon@2x.png': iconBuffer,
    'logo.png': iconBuffer,
    'logo@2x.png': iconBuffer,
  }

  const manifest: Record<string, string> = {}
  for (const [name, buf] of Object.entries(files)) manifest[name] = sha1(buf)
  const manifestBuffer = Buffer.from(JSON.stringify(manifest), 'utf8')

  const certPem = Buffer.from(config.appleWalletCertBase64, 'base64').toString('utf8')
  const keyPemRaw = Buffer.from(config.appleWalletKeyBase64, 'base64').toString('utf8')
  const wwdrPem = Buffer.from(config.appleWalletWwdrBase64, 'base64').toString('utf8')

  const privateKey = config.appleWalletKeyPassphrase
    ? forge.pki.decryptRsaPrivateKey(keyPemRaw, config.appleWalletKeyPassphrase)
    : forge.pki.privateKeyFromPem(keyPemRaw)
  if (!privateKey) {
    throw createError({ statusCode: 500, statusMessage: 'APPLE_WALLET_BAD_KEY' })
  }

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(manifestBuffer.toString('binary'))
  p7.addCertificate(certPem)
  p7.addCertificate(wwdrPem)
  p7.addSigner({
    key: privateKey,
    certificate: certPem,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  })
  p7.sign({ detached: true })
  const signatureBuffer = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary')

  const zip = new JSZip()
  for (const [name, buf] of Object.entries(files)) zip.file(name, buf)
  zip.file('manifest.json', manifestBuffer)
  zip.file('signature', signatureBuffer)

  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
}
