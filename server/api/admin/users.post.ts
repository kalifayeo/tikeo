import { sendTransactionalEmail } from '~/server/utils/brevo'
import { requireCsrf } from '~/server/utils/csrf'

const ALLOWED_ROLES = ['buyer', 'organizer', 'agent', 'admin'] as const
type AllowedRole = (typeof ALLOWED_ROLES)[number]

/**
 * POST /api/admin/users
 * Réservé à l'administration (§8.5 / §41 du cahier des charges : "gérer les
 * utilisateurs"). Doit passer par le serveur (clé service_role) car la
 * création d'un compte Supabase Auth n'est pas possible depuis le client.
 */
export default defineEventHandler(async (event) => {
  requireCsrf(event)
  const { adminUserId } = await requireAdmin(event)

  const body = await readBody<{ fullName?: string; email?: string; phone?: string; role?: string }>(event)
  const fullName = body.fullName?.trim()
  const email = body.email?.trim().toLowerCase()
  const phone = body.phone?.trim() || null
  const role = (body.role || 'buyer') as AllowedRole

  if (!fullName || !email) {
    throw createError({ statusCode: 400, statusMessage: "Le nom complet et l'email sont obligatoires." })
  }
  if (!ALLOWED_ROLES.includes(role)) {
    throw createError({ statusCode: 400, statusMessage: 'Rôle invalide.' })
  }

  const supabaseAdmin = useSupabaseAdmin()

  const { data: createdUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, phone },
  })

  if (createUserError || !createdUser.user) {
    throw createError({
      statusCode: 409,
      statusMessage: createUserError?.message || 'Impossible de créer cet utilisateur (email déjà utilisé ?).',
    })
  }

  const newUserId = createdUser.user.id

  // Le trigger on_auth_user_created (0003) crée déjà un profil avec role='buyer'.
  // On l'ajuste ici si un rôle différent a été demandé.
  if (role !== 'buyer') {
    const { error: roleUpdateError } = await supabaseAdmin.from('profiles').update({ role }).eq('user_id', newUserId)
    if (roleUpdateError) {
      throw createError({
        statusCode: 500,
        statusMessage: "Utilisateur créé, mais impossible d'assigner le rôle demandé : " + roleUpdateError.message,
      })
    }
  }

  // Lien de définition de mot de passe (l'utilisateur ne reçoit jamais de
  // mot de passe temporaire en clair par email — plus sûr).
  const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email })
  const actionLink = linkData?.properties?.action_link

  if (actionLink) {
    try {
      await sendTransactionalEmail({
        to: email,
        toName: fullName,
        subject: 'Votre compte Tikeo a été créé',
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color:#FF7A00;">Tikeo</h2>
            <p>Bonjour ${fullName},</p>
            <p>Un compte Tikeo (rôle : ${role}) vient d'être créé pour vous par l'administration.</p>
            <p><a href="${actionLink}" style="color:#0057B8;">Cliquez ici pour définir votre mot de passe</a></p>
          </div>
        `,
      })
    } catch {
      // Non bloquant : le compte existe même si l'email échoue (ex. Brevo non configuré en dev).
    }
  }

  await supabaseAdmin.from('audit_logs').insert({
    user_id: adminUserId,
    action: 'ADMIN_USER_CREATED',
    entity_type: 'profiles',
    entity_id: newUserId,
    metadata: { email, role },
  })

  const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('user_id', newUserId).maybeSingle()

  return { profile }
})
