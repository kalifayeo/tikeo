/**
 * Numéros mobiles ivoiriens, au format exigé par l'API Jèko :
 * indicatif 225 + 01 / 05 / 07 + 8 chiffres (ex. +2250765432108).
 *
 * Accepte les saisies courantes : « 07 65 43 21 08 », « 0765432108 »,
 * « +225 07 65 43 21 08 », « 2250765432108 », « 00225… ».
 * Renvoie `null` si le numéro n'est pas exploitable (ancien format à 8 chiffres inclus :
 * on ne devine jamais le préfixe d'un opérateur).
 */
export function normalizeIvorianPhone(input: unknown): string | null {
  if (typeof input !== 'string') return null
  let digits = input.replace(/\D+/g, '')
  if (digits.startsWith('00225')) digits = digits.slice(2)
  if (digits.length === 10 && digits.startsWith('0')) digits = `225${digits}`
  return /^225(01|05|07)\d{8}$/.test(digits) ? `+${digits}` : null
}

/** « +2250765432108 » → « +225 07 •• •• 21 08 » (affichage sans exposer le numéro complet). */
export function maskIvorianPhone(e164: string): string {
  const d = e164.replace(/\D+/g, '')
  if (d.length !== 13) return ''
  return `+225 ${d.slice(3, 5)} •• •• ${d.slice(9, 11)} ${d.slice(11, 13)}`
}
