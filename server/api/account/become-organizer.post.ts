import { requireCsrf } from '~/server/utils/csrf'
import { checkRateLimit } from '~/server/utils/rateLimit'

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * POST /api/account/become-organizer
 *
 * Corrige un parcours cassé en deux endroits à la fois :
 *   1. Les boutons "Créer un événement" / "Publier un événement" pointaient
 *      vers une page réservée aux organisateurs (middleware `organizer`) :
 *      un simple acheteur connecté s'y voyait silencieusement renvoyé vers
 *      l'accueil, sans aucune explication.
 *   2. Même en contournant ça, l'auto-promotion prévue dans
 *      composables/useOrganizer.ts (`ensureOrganizer`) faisait un
 *      `update({ role: 'organizer' })` directement depuis le client : ça a
 *      cessé de fonctionner dès la migration 0021 (verrou de sécurité sur
 *      les changements de rôle, qui exige la permission users.manage_roles
 *      — normal pour empêcher qu'un compte se donne lui-même un rôle
 *      admin/agent, mais ça a bloqué au passage cette auto-promotion
 *      pourtant légitime et voulue par le produit).
 *
 * Il n'y a plus de forfait à choisir : la commission dépend des ventes
 * cumulées (paliers, migration 0047), pas d'un choix à l'inscription.
 *
 * Cette route fait la même chose que l'ancien code, mais côté serveur avec
 * la clé service_role (qui contourne ce verrou), donc de façon fiable :
 * elle crée l'espace organisateur (table organizers) et fait passer le
 * profil en rôle "organizer" — immédiatement, sans validation préalable
 * d'un admin (c'est le comportement déjà voulu à l'origine, cf. §65 du
 * cahier des charges : « Créer un compte → Créer un événement »). Le champ
 * organizers.status reste à 'pending' à titre informatif pour
 * l'administration (page /admin/organisateurs), mais ne conditionne
 * aujourd'hui aucun droit dans l'application.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  await checkRateLimit(event, { key: 'become-organizer', max: 10, windowMs: 60 * 60 * 1000 })

  const { userId, email } = await requireUser(event)
  const supabaseAdmin = useSupabaseAdmin()

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('full_name, role, status')
    .eq('user_id', userId)
    .maybeSingle()

  if (profileError) {
    throw createError({ statusCode: 500, statusMessage: profileError.message })
  }
  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profil introuvable.' })
  }
  if (profile.status !== 'active') {
    throw createError({ statusCode: 403, statusMessage: 'Ce compte ne peut pas devenir organisateur pour le moment.' })
  }

  // Idempotent : si l'espace existe déjà, on le renvoie tel quel plutôt que
  // d'échouer (le bouton "Devenir organisateur" peut être cliqué plusieurs
  // fois, par ex. après un rafraîchissement de page).
  const { data: existing, error: existingError } = await supabaseAdmin
    .from('organizers')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  if (existingError) {
    throw createError({ statusCode: 500, statusMessage: existingError.message })
  }

  let organizer = existing

  if (!organizer) {
    const baseName = profile.full_name || email?.split('@')[0] || 'Organisateur'
    const baseSlug = slugify(baseName) || 'organisateur'
    const uniqueSlug = `${baseSlug}-${userId.slice(0, 6)}`

    const { data: created, error: insertError } = await supabaseAdmin
      .from('organizers')
      .insert({
        user_id: userId,
        name: baseName,
        slug: uniqueSlug,
        email: email || null,
        status: 'pending',
      })
      .select('*')
      .single()

    if (insertError) {
      throw createError({ statusCode: 500, statusMessage: "Impossible de créer l'espace organisateur : " + insertError.message })
    }
    organizer = created
  }

  let promoted = false
  if (profile.role === 'buyer') {
    const { error: roleError } = await supabaseAdmin.from('profiles').update({ role: 'organizer' }).eq('user_id', userId)
    if (roleError) {
      throw createError({ statusCode: 500, statusMessage: "Espace organisateur créé mais rôle non mis à jour : " + roleError.message })
    }
    promoted = true
  }

  return { organizer, promoted }
})
