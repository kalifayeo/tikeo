/**
 * Informations de profil complémentaires (bio, ville, date de naissance,
 * centres d'intérêt, préférences de rappels...). Elles sont stockées dans les
 * métadonnées du compte Supabase Auth (`user_metadata.tikeo_profile`) : aucune
 * migration SQL n'est nécessaire, et elles suivent l'utilisateur sur tous ses
 * appareils.
 */
export interface ProfileExtras {
  bio: string
  city: string
  birthdate: string
  interests: string[]
  useCityOnHome: boolean
  remindDayBefore: boolean
  notifyNewInCity: boolean
  notifyWaitlist: boolean
  showNameOnReviews: boolean
}

export const DEFAULT_PROFILE_EXTRAS: ProfileExtras = {
  bio: '',
  city: '',
  birthdate: '',
  interests: [],
  useCityOnHome: false,
  remindDayBefore: true,
  notifyNewInCity: false,
  notifyWaitlist: true,
  showNameOnReviews: true,
}

export function useProfileExtras() {
  const { user } = useAuth()
  const supabase = useSupabase()

  const extras = computed<ProfileExtras>(() => {
    const raw = ((user.value as any)?.user_metadata?.tikeo_profile ?? {}) as Partial<ProfileExtras>
    return {
      ...DEFAULT_PROFILE_EXTRAS,
      ...raw,
      interests: Array.isArray(raw.interests) ? raw.interests : [],
    }
  })

  async function saveExtras(patch: Partial<ProfileExtras>) {
    const next = { ...extras.value, ...patch }
    const { data, error } = await supabase.auth.updateUser({ data: { tikeo_profile: next } })
    if (error) throw error
    // Met à jour l'utilisateur local sans attendre l'évènement USER_UPDATED.
    if (data?.user) useAuthStore().setUser(data.user)
    return next
  }

  return { extras, saveExtras }
}
