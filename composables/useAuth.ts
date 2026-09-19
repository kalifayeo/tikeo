import { storeToRefs } from 'pinia'
import { useAuthStore } from '~/stores/authStore'

type OtpPurpose = 'signup' | 'login' | 'reset_password'

/**
 * Authentification Tikeo — 100% Supabase Auth.
 * Les emails (confirmation, code de connexion, réinitialisation) sont
 * envoyés par Supabase via le SMTP Brevo configuré dans le dashboard
 * (Project Settings > Authentication > SMTP Settings).
 *
 * Pour que les emails contiennent un code à 6 chiffres (au lieu d'un simple
 * lien), pensez à activer/adapter les templates dans Authentication > Email
 * Templates en y incluant la variable {{ .Token }}.
 */
export function useAuth() {
  const store = useAuthStore()
  const { user, profile, loading, isAuthenticated, role } = storeToRefs(store)

  async function register(payload: { fullName: string; email: string; phone?: string; password?: string }) {
    const supabase = useSupabase()
    const email = payload.email.trim().toLowerCase()
    const metadata = { full_name: payload.fullName.trim(), phone: payload.phone || null }

    if (payload.password) {
      const { error } = await supabase.auth.signUp({
        email,
        password: payload.password,
        options: { data: metadata },
      })
      if (error) throw error
    } else {
      // Compte "sans mot de passe" : Supabase crée le compte et envoie
      // directement un code de connexion par email (OTP).
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { shouldCreateUser: true, data: metadata },
      })
      if (error) throw error
    }

    return { success: true }
  }

  async function loginWithPassword(email: string, password: string) {
    const supabase = useSupabase()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) throw error
    store.setUser(data.user)
    await store.fetchProfile()
    return data
  }

  async function requestOtp(email: string, purpose: OtpPurpose) {
    const supabase = useSupabase()
    const cleanEmail = email.trim().toLowerCase()

    if (purpose === 'reset_password') {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail)
      if (error) throw error
      return { success: true }
    }

    // purpose === 'login' : on ne crée jamais de compte depuis l'écran de connexion.
    const { error } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: { shouldCreateUser: false },
    })
    if (error) throw error
    return { success: true }
  }

  async function verifyOtp(email: string, code: string, purpose: OtpPurpose) {
    const supabase = useSupabase()
    const type = purpose === 'signup' ? 'signup' : purpose === 'reset_password' ? 'recovery' : 'email'

    const { data, error } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type,
    })
    if (error) throw error

    if (data.user) {
      store.setUser(data.user)
      await store.fetchProfile()
    }

    // Pour 'reset_password', la vérification du code ouvre déjà une session :
    // l'écran suivant peut appeler updateUser({ password }) directement.
    return { user: data.user, session: data.session }
  }

  async function resetPassword(newPassword: string) {
    const supabase = useSupabase()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) throw error
    return { success: true }
  }

  /** Change l'email du compte : Supabase envoie un lien de confirmation à la nouvelle adresse avant d'appliquer le changement. */
  async function updateEmail(newEmail: string) {
    const supabase = useSupabase()
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim().toLowerCase() })
    if (error) throw error
  }

  async function updateProfile(patch: { fullName?: string; phone?: string | null; avatarUrl?: string | null }) {
    return store.updateProfile({
      ...(patch.fullName !== undefined ? { full_name: patch.fullName.trim() } : {}),
      ...(patch.phone !== undefined ? { phone: patch.phone || null } : {}),
      ...(patch.avatarUrl !== undefined ? { avatar_url: patch.avatarUrl || null } : {}),
    })
  }

  /** Préférences de notifications (page Paramètres) : sauvegarde immédiate, pas de bouton dédié. */
  async function updateNotificationPrefs(patch: { notifyEmail?: boolean; notifySms?: boolean; notifyPromotions?: boolean }) {
    return store.updateProfile({
      ...(patch.notifyEmail !== undefined ? { notify_email: patch.notifyEmail } : {}),
      ...(patch.notifySms !== undefined ? { notify_sms: patch.notifySms } : {}),
      ...(patch.notifyPromotions !== undefined ? { notify_promotions: patch.notifyPromotions } : {}),
    })
  }

  /** Déconnecte le compte de tous les appareils/navigateurs (invalide toutes les sessions actives). */
  async function signOutEverywhere() {
    const supabase = useSupabase()
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    if (error) throw error
    store.$patch({ user: null, profile: null })
  }

  return {
    user,
    profile,
    loading,
    isAuthenticated,
    role,
    register,
    loginWithPassword,
    requestOtp,
    verifyOtp,
    resetPassword,
    updateEmail,
    updateProfile,
    updateNotificationPrefs,
    signOutEverywhere,
    signOut: store.signOut,
    fetchSession: store.fetchSession,
  }
}
