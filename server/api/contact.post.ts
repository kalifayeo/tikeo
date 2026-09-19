import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

/**
 * POST /api/contact
 * Le formulaire de contact (page publique /contact) passait auparavant par
 * un insert Supabase direct depuis le client (clé anon). Ça reste un
 * insert simple, mais on l'a fait transiter par le serveur pour ajouter
 * trois couches de protection qu'on ne peut pas mettre côté client :
 *   1. CSRF (double-submit cookie, cf. ~/server/utils/csrf.ts) — empêche
 *      un site tiers de soumettre le formulaire à l'insu du visiteur.
 *   2. Limite de débit par IP — dissuade les scripts de spam en masse.
 *   3. Honeypot — un champ caché que seuls les bots remplissent ; si
 *      rempli, on répond succès sans rien écrire, pour ne pas leur
 *      révéler qu'ils ont été détectés.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  checkRateLimit(event, { key: 'contact', max: 5, windowMs: 10 * 60 * 1000 })

  const body = await readBody<{
    fullName?: string
    email?: string
    subject?: string
    message?: string
    website?: string // honeypot : doit toujours rester vide pour un humain
  }>(event)

  // Bot détecté : on fait semblant que tout s'est bien passé.
  if (body.website) {
    return { success: true }
  }

  const fullName = body.fullName?.trim()
  const email = body.email?.trim().toLowerCase()
  const subject = body.subject?.trim()
  const message = body.message?.trim()

  if (!fullName || !email || !subject || !message) {
    throw createError({ statusCode: 400, statusMessage: 'Tous les champs sont obligatoires.' })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({ statusCode: 400, statusMessage: 'Adresse email invalide.' })
  }

  // Le détail technique (ex. clé service_role absente/mal configurée) ne doit
  // jamais atteindre le client : il part dans les logs serveur (Vercel >
  // Deployments > Functions, ou le terminal en local), et l'utilisateur ne
  // voit qu'un message générique — quoi qu'il arrive dans ce bloc.
  try {
    const supabaseAdmin = useSupabaseAdmin()
    const { error } = await supabaseAdmin.from('contact_messages').insert({ full_name: fullName, email, subject, message })
    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error('[api/contact] échec envoi du message :', err)
    throw createError({ statusCode: 500, statusMessage: "Impossible d'envoyer le message pour le moment." })
  }
})
