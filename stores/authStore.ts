import { defineStore } from 'pinia'
import type { User } from '@supabase/supabase-js'
import type { AdminContext, PermissionKey, Profile } from '~/types/database'

const EMPTY_ADMIN_CONTEXT: AdminContext = { isAdmin: false, isSuperAdmin: false, roles: [], permissions: [] }

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as User | null,
    profile: null as Profile | null,
    loading: false,
    adminContext: null as AdminContext | null,
    // Renseigné juste avant la déconnexion forcée d'un compte suspendu, pour
    // que l'écran de connexion puisse afficher un message clair (voir
    // pages/connexion/index.vue). Remis à false dès qu'on le consulte.
    justSuspended: false,
  }),
  getters: {
    isAuthenticated: (state) => !!state.user,
    role: (state) => state.profile?.role ?? 'visitor',
    isSuperAdmin: (state) => state.adminContext?.isSuperAdmin ?? false,
    adminPermissions: (state) => state.adminContext?.permissions ?? [],
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
          this.adminContext = null
          return
        }

        this.user = user
        await this.fetchProfile()
      } catch {
        this.user = null
        this.profile = null
        this.adminContext = null
      } finally {
        this.loading = false
      }
    },

    async fetchProfile() {
      if (!this.user) {
        this.profile = null
        this.adminContext = null
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

      // ------------------------------------------------------------
      // Correctif "Suspendre un utilisateur" : jusqu'ici, un compte déjà
      // connecté au moment de sa suspension gardait un accès complet tant
      // que son jeton restait valide (rien ne le déconnectait). On coupe
      // la session dès qu'on détecte status = 'suspended', qu'il vienne
      // d'une connexion tout juste réussie ou d'une session déjà ouverte
      // (ce getter est appelé par tous les middlewares de page). La
      // véritable protection reste néanmoins la RLS/les triggers côté base
      // (migration 0021) : ceci n'est qu'un confort d'interface.
      // ------------------------------------------------------------
      if (this.profile?.status === 'suspended') {
        await this.forceSignOutSuspended()
        return
      }

      if (this.profile?.role === 'admin') {
        await this.fetchAdminContext()
      } else {
        this.adminContext = null
      }
    },

    /** Charge les rôles/permissions RBAC de l'admin connecté (migration 0021, fonction get_admin_context). */
    async fetchAdminContext() {
      if (!this.user || this.profile?.role !== 'admin') {
        this.adminContext = null
        return
      }
      const supabase = useSupabase()
      const { data, error } = await supabase.rpc('get_admin_context')
      if (error) {
        console.error('[authStore] Impossible de charger les permissions admin :', error.message)
        this.adminContext = EMPTY_ADMIN_CONTEXT
        return
      }
      this.adminContext = (data as AdminContext) ?? EMPTY_ADMIN_CONTEXT
    },

    /** Vrai si l'admin connecté est Super Admin ou porte la permission demandée. */
    hasPermission(key: PermissionKey): boolean {
      if (!this.adminContext?.isAdmin) return false
      if (this.adminContext.isSuperAdmin) return true
      return this.adminContext.permissions.includes(key)
    },

    async forceSignOutSuspended() {
      const supabase = useSupabase()
      try {
        await supabase.auth.signOut()
      } catch {
        // best-effort : même si l'appel réseau échoue, on efface l'état local.
      }
      this.user = null
      this.profile = null
      this.adminContext = null
      this.justSuspended = true
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
      this.adminContext = null
    },
  },
})
