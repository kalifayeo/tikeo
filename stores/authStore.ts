import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '~/types/database'

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    profile: null as Profile | null,
    loading: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    role: (state) => state.profile?.role ?? 'visitor',
  },
  actions: {
    /**
     * Recharge la session Supabase Auth active (si l'utilisateur a déjà un
     * cookie/token valide) ainsi que son profil applicatif.
     */
    async fetchSession() {
      this.loading = true
      try {
        const supabase = useSupabase()
        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          this.user = null
          this.profile = null
          return
        }

        this.user = user
        await this.fetchProfile()
      } catch {
        this.user = null
        this.profile = null
      } finally {
        this.loading = false
      }
    },

    async fetchProfile() {
      if (!this.user) {
        this.profile = null
        return
      }
      const supabase = useSupabase()
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', this.user.id).maybeSingle()
      if (error) {
        // On ne masque plus l'erreur : sans ce log, un souci RLS/réseau se
        // traduisait silencieusement par role = 'visitor' (donc un admin
        // légitime se faisait renvoyer vers "/" sans aucune explication).
        console.error('[authStore] Impossible de charger le profil :', error.message)
      }
      this.profile = data ? (data as unknown as Profile) : null
    },

    setUser(user: User | null) {
      this.user = user
    },

    /** Met à jour le profil applicatif (nom, téléphone, avatar, préférences...) et rafraîchit l'état local. */
    async updateProfile(
      patch: Partial<Pick<Profile, 'full_name' | 'phone' | 'avatar_url' | 'notify_email' | 'notify_sms' | 'notify_promotions'>>
    ) {
      if (!this.user) throw new Error('Utilisateur non connecté')
      const supabase = useSupabase()
      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('user_id', this.user.id)
        .select('*')
        .single()
      if (error) throw error
      this.profile = data as unknown as Profile
      return this.profile
    },

    async signOut() {
      const supabase = useSupabase()
      await supabase.auth.signOut()
      this.user = null
      this.profile = null
    },
  },
})
