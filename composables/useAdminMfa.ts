/**
 * Double authentification (2FA) pour les comptes admin, via l'API MFA
 * native de Supabase Auth (TOTP — Google Authenticator, Authy, etc.).
 * Aucune donnée de secret ne transite par nos propres tables : Supabase gère
 * l'enregistrement, la vérification et l'« assurance level » (AAL) de la
 * session, que middleware/admin.ts consulte pour verrouiller /admin/*.
 */
export interface MfaFactor {
  id: string
  friendlyName: string | null
  status: string
  createdAt: string
}

export function useAdminMfa() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function listFactors(): Promise<MfaFactor[]> {
    const supabase = useSupabase()
    const { data, error: err } = await supabase.auth.mfa.listFactors()
    if (err) throw err
    return (data?.totp ?? []).map((f) => ({ id: f.id, friendlyName: f.friendly_name ?? null, status: f.status, createdAt: f.created_at }))
  }

  /** Démarre l'inscription : renvoie le QR code (data URI) et le secret (saisie manuelle). */
  async function startEnroll(): Promise<{ factorId: string; qrCode: string; secret: string }> {
    const supabase = useSupabase()
    const { data, error: err } = await supabase.auth.mfa.enroll({ factorType: 'totp' })
    if (err) throw err
    return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret }
  }

  /** Confirme l'inscription avec le code à 6 chiffres généré par l'application d'authentification. */
  async function confirmEnroll(factorId: string, code: string) {
    const supabase = useSupabase()
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) throw chErr
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
    if (vErr) throw vErr
  }

  /** Étape de vérification à chaque nouvelle session (facteur déjà enregistré). */
  async function verifySession(factorId: string, code: string) {
    const supabase = useSupabase()
    const { data: challenge, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
    if (chErr) throw chErr
    const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code: code.trim() })
    if (vErr) throw vErr
  }

  /** Désactive le 2FA. Si la session n'a pas encore l'assurance aal2, un code valide est d'abord requis. */
  async function disable(factorId: string, code?: string) {
    const supabase = useSupabase()
    if (code) await verifySession(factorId, code)
    const { error: err } = await supabase.auth.mfa.unenroll({ factorId })
    if (err) throw err
  }

  async function abortEnroll(factorId: string) {
    const supabase = useSupabase()
    await supabase.auth.mfa.unenroll({ factorId }).catch(() => {})
  }

  return { loading, error, listFactors, startEnroll, confirmEnroll, verifySession, disable, abortEnroll }
}
