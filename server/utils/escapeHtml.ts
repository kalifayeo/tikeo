/**
 * Échappement HTML pour les emails (et tout HTML construit côté serveur).
 *
 * Tout texte saisi par un utilisateur, un organisateur ou stocké en base
 * (nom, titre d'événement, message de transfert, lieu…) DOIT passer par
 * escapeHtml() avant d'être inséré dans un gabarit HTML. Sans cela, un
 * compte malveillant pourrait injecter des liens ou du contenu de phishing
 * dans un email envoyé depuis le domaine de confiance de Tikeo.
 */
const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"'`]/g, (c) => HTML_ESCAPES[c])
}

/** URL http(s) uniquement (refuse javascript:, data:, etc.), déjà échappée pour un attribut HTML. */
export function safeHttpUrl(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!/^https?:\/\//i.test(raw)) return null
  try {
    return escapeHtml(new URL(raw).toString())
  } catch {
    return null
  }
}

/** Chemin interne du site (« /mon-espace/… ») : refuse les URLs absolues et « //hote » (redirection ouverte). */
export function safeInternalPath(value: unknown): string | null {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return null
  return escapeHtml(raw)
}
