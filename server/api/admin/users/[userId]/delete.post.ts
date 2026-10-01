import { requireCsrf } from '~/server/utils/csrf'

/**
 * POST /api/admin/users/:userId/delete
 *
 * Jusqu'ici, "Supprimer mon compte" (pages/mon-espace/parametres) envoyait
 * juste un message dans contact_messages : l'admin ne pouvait que répondre
 * par email ou archiver, le compte restait actif et le site continuait de
 * fonctionner normalement pour la personne concernée. Cette route fait la
 * vraie suppression, déclenchée par l'admin (permission users.delete).
 *
 * Pourquoi une ANONYMISATION plutôt qu'un vrai DELETE de la ligne profiles /
 * auth.users : le schéma (0001_init.sql) a des ON DELETE CASCADE en chaîne
 * (orders.user_id -> orders -> order_items/tickets -> payments, et pour un
 * organisateur : organizers -> events -> ticket_types). Supprimer purement
 * et simplement le compte auth effacerait donc aussi tout l'historique de
 * commandes/paiements de cette personne (mauvais pour la compta et les
 * litiges), et si elle est organisatrice, ENTRAÎNERAIT LA DISPARITION de ses
 * événements et des billets d'autres acheteurs. On préfère donc :
 *   1. Verrouiller la connexion côté Supabase Auth (ban) et libérer l'email.
 *   2. Effacer les informations personnelles du profil (nom, téléphone,
 *      avatar, email) et marquer status = 'deleted'.
 * Les commandes/billets/paiements restent en base, rattachés à un compte
 * anonymisé et injoignable — ce qui satisfait le droit à l'oubli sans
 * casser l'intégrité comptable ni les données d'autres utilisateurs.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)

  const targetUserId = getRouterParam(event, 'userId')
  if (!targetUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Identifiant de compte manquant.' })
  }

  const { adminUserId } = await requirePermission(event, 'users.delete')

  if (targetUserId === adminUserId) {
    throw createError({ statusCode: 400, statusMessage: 'Vous ne pouvez pas supprimer votre propre compte depuis cet écran.' })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: targetProfile, error: fetchError } = await supabaseAdmin.from('profiles').select('*').eq('user_id', targetUserId).maybeSingle()
  if (fetchError) {
    throw createError({ statusCode: 500, statusMessage: fetchError.message })
  }
  if (!targetProfile) {
    throw createError({ statusCode: 404, statusMessage: 'Ce compte est introuvable (peut-être déjà supprimé).' })
  }
  if (targetProfile.status === 'deleted') {
    throw createError({ statusCode: 409, statusMessage: 'Ce compte a déjà été supprimé.' })
  }

  // Supprimer un compte admin est un acte distinct (même logique que sa
  // création, cf. server/api/admin/users.post.ts) : il exige la permission
  // dédiée à la gestion des administrateurs, pas seulement users.delete.
  if (targetProfile.role === 'admin') {
    await requirePermission(event, 'admin.manage_admins')
  }

  const anonymizedEmail = `compte-supprime+${targetUserId}@tikeo.invalid`
  const previousEmail = targetProfile.email

  // 1) Supabase Auth : bannir la connexion (durée ~ 100 ans = permanent en
  // pratique) et libérer l'adresse email (au cas où la personne recréerait
  // un compte plus tard avec la même adresse).
  const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
    email: anonymizedEmail,
    email_confirm: true,
    user_metadata: {},
    ban_duration: '876000h',
  })
  if (authError) {
    throw createError({ statusCode: 500, statusMessage: "Impossible de verrouiller la connexion de ce compte : " + authError.message })
  }

  // 2) Effacer les informations personnelles du profil applicatif. On NE
  // supprime PAS la ligne (voir l'explication en tête de fichier).
  const { error: profileError } = await supabaseAdmin
    .from('profiles')
    .update({
      full_name: 'Compte supprimé',
      phone: null,
      avatar_url: null,
      email: anonymizedEmail,
      status: 'deleted',
    })
    .eq('user_id', targetUserId)

  if (profileError) {
    // Le compte est déjà verrouillé côté Auth à ce stade : la personne ne
    // peut plus se connecter, mais le profil garde ses infos. On le signale
    // clairement plutôt que de laisser croire à un échec total.
    throw createError({
      statusCode: 500,
      statusMessage: "Le compte a été verrouillé mais le profil n'a pas pu être anonymisé : " + profileError.message,
    })
  }

  // 3) Marquer comme traitées les éventuelles demandes de suppression en
  // attente pour ce compte, pour que l'écran /admin/messages reflète l'état réel.
  await supabaseAdmin
    .from('contact_messages')
    .update({ status: 'archived' })
    .eq('user_id', targetUserId)
    .eq('request_type', 'account_deletion')
    .neq('status', 'archived')

  await supabaseAdmin.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'ADMIN_USER_DELETED',
    entity_type: 'profiles',
    entity_id: targetUserId,
    metadata: { previousEmail },
  })

  return { success: true }
})
