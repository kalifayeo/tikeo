import type { AdminRole, Permission, Profile } from '~/types/database'

export interface AdminUserRow extends Profile {
  roleKeys: string[]
}

/**
 * Administration du RBAC (supabase/migrations/0021_admin_rbac_and_suspension_fix.sql) :
 * catalogue des rôles/permissions, affectation des rôles à un compte admin,
 * attribution des permissions à un rôle. Toute écriture est protégée par la
 * RLS des tables admin_roles / admin_role_permissions / admin_user_roles
 * (permissions admin.manage_permissions / admin.manage_admins) — ce
 * composable ne fait qu'exposer une API pratique côté interface, il ne
 * décide jamais lui-même de ce qui est autorisé.
 */
export function useAdminRbac() {
  const loading = ref(true)
  const error = ref('')

  const roles = ref<AdminRole[]>([])
  const permissions = ref<Permission[]>([])
  // Set de "roleId:permissionId" pour un lookup O(1) dans le template.
  const rolePermissionPairs = ref<Set<string>>(new Set())
  const adminUsers = ref<AdminUserRow[]>([])

  const permissionsByCategory = computed(() => {
    const groups: Record<string, Permission[]> = {}
    for (const p of permissions.value) {
      ;(groups[p.category] ||= []).push(p)
    }
    return groups
  })

  function roleHasPermission(roleId: string, permissionId: string) {
    return rolePermissionPairs.value.has(`${roleId}:${permissionId}`)
  }

  async function loadAll() {
    loading.value = true
    error.value = ''
    try {
      const supabase = useSupabase()
      const [rolesRes, permsRes, mapRes, profilesRes, userRolesRes] = await Promise.all([
        supabase.from('admin_roles').select('*').order('is_system', { ascending: false }).order('name'),
        supabase.from('permissions').select('*').order('category').order('key'),
        supabase.from('admin_role_permissions').select('role_id, permission_id'),
        supabase.from('profiles').select('*').eq('role', 'admin').order('created_at', { ascending: false }),
        supabase.from('admin_user_roles').select('user_id, role_id'),
      ])
      if (rolesRes.error) throw rolesRes.error
      if (permsRes.error) throw permsRes.error
      if (mapRes.error) throw mapRes.error
      if (profilesRes.error) throw profilesRes.error
      if (userRolesRes.error) throw userRolesRes.error

      roles.value = (rolesRes.data as unknown as AdminRole[]) ?? []
      permissions.value = (permsRes.data as unknown as Permission[]) ?? []
      rolePermissionPairs.value = new Set(
        (mapRes.data ?? []).map((r: any) => `${r.role_id}:${r.permission_id}`)
      )

      const roleIdToKey = new Map(roles.value.map((r) => [r.id, r.key]))
      const rolesByUser = new Map<string, string[]>()
      for (const ur of (userRolesRes.data ?? []) as Array<{ user_id: string; role_id: string }>) {
        const key = roleIdToKey.get(ur.role_id)
        if (!key) continue
        const list = rolesByUser.get(ur.user_id) ?? []
        list.push(key)
        rolesByUser.set(ur.user_id, list)
      }

      adminUsers.value = ((profilesRes.data as unknown as Profile[]) ?? []).map((p) => ({
        ...p,
        roleKeys: rolesByUser.get(p.user_id) ?? [],
      }))
    } catch (e: any) {
      error.value = e?.message || 'Impossible de charger les données RBAC.'
    } finally {
      loading.value = false
    }
  }

  /** Assigne ou retire un rôle administrateur à un compte. */
  async function toggleUserRole(userId: string, roleId: string, assign: boolean) {
    const supabase = useSupabase()
    if (assign) {
      const { error: err } = await supabase.from('admin_user_roles').insert({ user_id: userId, role_id: roleId })
      if (err) throw err
    } else {
      const { error: err } = await supabase.from('admin_user_roles').delete().eq('user_id', userId).eq('role_id', roleId)
      if (err) throw err
    }
    const user = adminUsers.value.find((u) => u.user_id === userId)
    const roleKey = roles.value.find((r) => r.id === roleId)?.key
    if (user && roleKey) {
      user.roleKeys = assign ? [...new Set([...user.roleKeys, roleKey])] : user.roleKeys.filter((k) => k !== roleKey)
    }
  }

  /** Ajoute ou retire une permission d'un rôle (rôle système exclu par la RLS). */
  async function toggleRolePermission(roleId: string, permissionId: string, grant: boolean) {
    const supabase = useSupabase()
    if (grant) {
      const { error: err } = await supabase.from('admin_role_permissions').insert({ role_id: roleId, permission_id: permissionId })
      if (err) throw err
      rolePermissionPairs.value = new Set(rolePermissionPairs.value).add(`${roleId}:${permissionId}`)
    } else {
      const { error: err } = await supabase.from('admin_role_permissions').delete().eq('role_id', roleId).eq('permission_id', permissionId)
      if (err) throw err
      const next = new Set(rolePermissionPairs.value)
      next.delete(`${roleId}:${permissionId}`)
      rolePermissionPairs.value = next
    }
  }

  /** Crée un nouveau sous-rôle administrateur (ex: futur "Admin Juridique"). */
  async function createRole(input: { key: string; name: string; description?: string }) {
    const supabase = useSupabase()
    const { data, error: err } = await supabase
      .from('admin_roles')
      .insert({ key: input.key, name: input.name, description: input.description || null })
      .select('*')
      .single()
    if (err) throw err
    roles.value.push(data as unknown as AdminRole)
    return data as unknown as AdminRole
  }

  async function toggleAdminStatus(user: AdminUserRow) {
    const supabase = useSupabase()
    const next = user.status === 'suspended' ? 'active' : 'suspended'
    const { error: err } = await supabase.from('profiles').update({ status: next }).eq('id', user.id)
    if (err) throw err
    user.status = next
  }

  return {
    loading,
    error,
    roles,
    permissions,
    permissionsByCategory,
    adminUsers,
    roleHasPermission,
    loadAll,
    toggleUserRole,
    toggleRolePermission,
    createRole,
    toggleAdminStatus,
  }
}
