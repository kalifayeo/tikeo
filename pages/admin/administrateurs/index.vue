<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: ['admin.manage_admins', 'admin.manage_permissions'] })
import type { Profile } from '~/types/database'

const { t } = useI18n()
const { askConfirm } = useAdminConfirm()
const authStore = useAuthStore()
const {
  loading,
  error,
  roles,
  permissionsByCategory,
  adminUsers,
  roleHasPermission,
  loadAll,
  toggleUserRole,
  toggleRolePermission,
  createRole,
  toggleAdminStatus,
} = useAdminRbac()

const canManageAdmins = computed(() => authStore.isSuperAdmin || authStore.hasPermission('admin.manage_admins'))
const canManagePermissions = computed(() => authStore.isSuperAdmin || authStore.hasPermission('admin.manage_permissions'))

const tab = ref<'admins' | 'roles'>(canManageAdmins.value ? 'admins' : 'roles')

const categoryLabels: Record<string, string> = {
  users: t('adminAdministrators.categoryUsers'),
  organizers: t('adminAdministrators.categoryOrganizers'),
  events: t('adminAdministrators.categoryEvents'),
  tickets: t('adminAdministrators.categoryTickets'),
  orders: t('adminAdministrators.categoryOrders'),
  payments: t('adminAdministrators.categoryPayments'),
  support: t('adminAdministrators.categorySupport'),
  moderation: t('adminAdministrators.categoryModeration'),
  marketing: t('adminAdministrators.categoryMarketing'),
  admin: t('adminAdministrators.categoryAdmin'),
  settings: t('adminAdministrators.categorySettings'),
}

// Rôles affichés dans la matrice (le Super Admin a tout, par définition —
// pas besoin d'une colonne qu'on ne pourrait de toute façon pas décocher).
const assignableRoles = computed(() => roles.value.filter((r) => r.key !== 'super_admin'))

const pendingKey = ref<string | null>(null)
const actionError = ref('')

async function onToggleUserRole(userId: string, roleId: string, checked: boolean) {
  const key = `${userId}:${roleId}`
  pendingKey.value = key
  actionError.value = ''
  try {
    await toggleUserRole(userId, roleId, checked)
  } catch (e: any) {
    actionError.value = e?.message || t('adminAdministrators.errorAssign')
  } finally {
    pendingKey.value = null
  }
}

async function onTogglePermission(roleId: string, permissionId: string, checked: boolean) {
  const key = `perm:${roleId}:${permissionId}`
  pendingKey.value = key
  actionError.value = ''
  try {
    await toggleRolePermission(roleId, permissionId, checked)
  } catch (e: any) {
    actionError.value = e?.message || t('adminAdministrators.errorPermission')
  } finally {
    pendingKey.value = null
  }
}

async function onToggleStatus(u: Profile & { roleKeys: string[] }) {
  actionError.value = ''
  const confirmMsg = u.status === 'suspended' ? t('adminAdministrators.confirmReactivate') : t('adminAdministrators.confirmDeactivate')
  if (!(await askConfirm({ message: confirmMsg }))) return
  try {
    await toggleAdminStatus(u)
  } catch (e: any) {
    actionError.value = e?.message || t('adminAdministrators.errorStatus')
  }
}

// --- Création d'un nouveau rôle (architecture évolutive) ---
const showCreateRole = ref(false)
const creatingRole = ref(false)
const newRole = reactive({ key: '', name: '', description: '' })

function slugifyKey(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}
watch(
  () => newRole.name,
  (name) => {
    newRole.key = slugifyKey(name)
  }
)

async function submitCreateRole() {
  if (!newRole.name.trim()) return
  creatingRole.value = true
  actionError.value = ''
  try {
    await createRole({ key: newRole.key, name: newRole.name.trim(), description: newRole.description.trim() || undefined })
    showCreateRole.value = false
    Object.assign(newRole, { key: '', name: '', description: '' })
  } catch (e: any) {
    actionError.value = e?.message || t('adminAdministrators.errorCreateRole')
  } finally {
    creatingRole.value = false
  }
}

// --- Création d'un nouvel administrateur ---
const showCreateAdmin = ref(false)
const creatingAdmin = ref(false)
const createAdminError = ref('')
const newAdmin = reactive({ fullName: '', email: '', phone: '' })

async function submitCreateAdmin() {
  creatingAdmin.value = true
  createAdminError.value = ''
  try {
    const supabase = useSupabase()
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')

    const { csrfHeader } = useCsrf()
    await $fetch('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
      body: { fullName: newAdmin.fullName, email: newAdmin.email, phone: newAdmin.phone || undefined, role: 'admin' },
    })
    showCreateAdmin.value = false
    Object.assign(newAdmin, { fullName: '', email: '', phone: '' })
    await loadAll()
  } catch (e: any) {
    createAdminError.value = e?.data?.statusMessage || e?.message || t('adminAdministrators.errorCreateAdmin')
  } finally {
    creatingAdmin.value = false
  }
}

onMounted(loadAll)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminAdministrators.title') }}</h1>
        <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminAdministrators.subtitle') }}</p>
      </div>
      <button v-if="canManageAdmins" type="button" class="btn-ink !h-10 !px-4 !text-[13px]" :aria-label="t('adminAdministrators.addAdmin')" @click="showCreateAdmin = true">
        <AppIcon name="user-plus" class="h-[18px] w-[18px]" /><span class="hidden sm:inline">{{ t('adminAdministrators.addAdmin').replace(/^\+\s*/, '') }}</span>
      </button>
    </div>

    <div class="mb-5 flex flex-wrap gap-2">
      <button
        v-if="canManageAdmins"
        type="button"
        class="admin-chip !h-10 !text-[13px]"
        :class="tab === 'admins' ? 'is-active' : ''"
        @click="tab = 'admins'"
      >
        <AppIcon name="shield" class="h-4 w-4" />{{ t('adminAdministrators.tabAdmins') }}
      </button>
      <button
        v-if="canManagePermissions"
        type="button"
        class="admin-chip !h-10 !text-[13px]"
        :class="tab === 'roles' ? 'is-active' : ''"
        @click="tab = 'roles'"
      >
        <AppIcon name="key" class="h-4 w-4" />{{ t('adminAdministrators.tabRoles') }}
      </button>
    </div>

    <p v-if="error || actionError" class="acc-alert-error mb-4">{{ error || actionError }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <!-- Onglet Administrateurs : qui a quel(s) rôle(s) -->
    <template v-else-if="tab === 'admins' && canManageAdmins">
      <div class="overflow-x-auto">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-3">{{ t('adminAdministrators.colAdmin') }}</th>
              <th class="px-3 py-3">{{ t('adminAdministrators.colStatus') }}</th>
              <th v-for="r in assignableRoles" :key="r.id" class="px-3 py-3 text-center" :title="r.description || ''">
                {{ r.name }}
              </th>
              <th class="px-3 py-3">{{ t('adminAdministrators.colAction') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="u in adminUsers" :key="u.id">
              <td class="px-3 py-3">
                <p class="font-medium text-tikeo-black">{{ u.full_name }}</p>
                <p class="text-xs text-tikeo-gray-text">{{ u.email }}</p>
                <StatusPill v-if="u.roleKeys.includes('super_admin')" tone="warning" class="mt-1"><AppIcon name="shield-check" class="h-3.5 w-3.5" />{{ t('adminAdministrators.superAdminBadge') }}</StatusPill>
              </td>
              <td class="px-3 py-3">
                <StatusPill :tone="u.status === 'suspended' ? 'error' : 'success'">
                  {{ u.status === 'suspended' ? t('adminUsers.statusSuspended') : t('adminAdministrators.statusActive') }}
                </StatusPill>
              </td>
              <td v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer accent-[#FF7A00]"
                  :checked="u.roleKeys.includes(r.key)"
                  :disabled="pendingKey === `${u.user_id}:${r.id}` || u.roleKeys.includes('super_admin')"
                  @change="onToggleUserRole(u.user_id, r.id, ($event.target as HTMLInputElement).checked)"
                />
              </td>
              <td class="px-3 py-3">
                <OrgIconButton
                  :icon="u.status === 'suspended' ? 'user-check' : 'ban'"
                  :danger="u.status !== 'suspended'"
                  :label="u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminAdministrators.deactivate')"
                  @click="onToggleStatus(u)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <AdminEmpty v-if="!adminUsers.length" icon="shield" :text="t('adminAdministrators.emptyAdmins')" class="mt-4" />
    </template>

    <!-- Onglet Rôles & permissions : matrice permission x rôle -->
    <template v-else-if="tab === 'roles' && canManagePermissions">
      <div class="mb-4 flex justify-end">
        <button type="button" class="acc-btn-ghost" @click="showCreateRole = true"><AppIcon name="plus" class="h-4 w-4" :stroke="2.2" />{{ t('adminAdministrators.addRole').replace(/^\+\s*/, '') }}</button>
      </div>

      <div v-for="(perms, category) in permissionsByCategory" :key="category" class="mb-6 overflow-x-auto">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-3">{{ categoryLabels[category] || category }}</th>
              <th v-for="r in assignableRoles" :key="r.id" class="px-3 py-3 text-center">{{ r.name }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="perm in perms" :key="perm.id">
              <td class="px-3 py-3 text-tikeo-gray-text">{{ perm.description }}</td>
              <td v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  class="h-4 w-4 cursor-pointer accent-[#FF7A00]"
                  :checked="roleHasPermission(r.id, perm.id)"
                  :disabled="pendingKey === `perm:${r.id}:${perm.id}`"
                  @change="onTogglePermission(r.id, perm.id, ($event.target as HTMLInputElement).checked)"
                />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>

    <!-- Modale : nouveau rôle -->
    <div v-if="showCreateRole" class="fixed inset-0 z-[110] flex items-end justify-center bg-tikeo-ink/60 p-4 backdrop-blur-sm sm:items-center" @click.self="showCreateRole = false">
      <div class="relative w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5 shadow-2xl">
        <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <h2 class="mb-4 flex items-center gap-2 font-display text-base font-extrabold text-tikeo-black"><AppIcon name="key" class="h-5 w-5 text-tikeo-orange" />{{ t('adminAdministrators.newRoleTitle') }}</h2>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateRole">
          <input v-model="newRole.name" type="text" required :placeholder="t('adminAdministrators.roleNamePlaceholder')" class="input-field" />
          <input v-model="newRole.key" type="text" required :placeholder="t('adminAdministrators.roleKeyPlaceholder')" class="input-field" />
          <textarea v-model="newRole.description" rows="2" :placeholder="t('adminAdministrators.roleDescriptionPlaceholder')" class="input-field" />
          <div class="flex gap-2 pt-2">
            <button type="button" class="acc-btn-ghost flex-1" @click="showCreateRole = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-ink flex-1 disabled:opacity-60" :disabled="creatingRole">{{ creatingRole ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modale : nouvel administrateur -->
    <div v-if="showCreateAdmin" class="fixed inset-0 z-[110] flex items-end justify-center bg-tikeo-ink/60 p-4 backdrop-blur-sm sm:items-center" @click.self="showCreateAdmin = false">
      <div class="relative w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5 shadow-2xl">
        <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <h2 class="mb-4 flex items-center gap-2 font-display text-base font-extrabold text-tikeo-black"><AppIcon name="shield-check" class="h-5 w-5 text-tikeo-orange" />{{ t('adminAdministrators.newAdminTitle') }}</h2>
        <p v-if="createAdminError" class="acc-alert-error mb-3 !text-xs">{{ createAdminError }}</p>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateAdmin">
          <input v-model="newAdmin.fullName" type="text" required :placeholder="t('adminUsers.fullNamePlaceholder')" class="input-field" />
          <input v-model="newAdmin.email" type="email" required :placeholder="t('adminUsers.emailPlaceholder')" class="input-field" />
          <input v-model="newAdmin.phone" type="tel" :placeholder="t('adminUsers.phonePlaceholder')" class="input-field" />
          <p class="text-xs text-tikeo-gray-text">{{ t('adminAdministrators.newAdminNote') }}</p>
          <div class="flex gap-2 pt-2">
            <button type="button" class="acc-btn-ghost flex-1" @click="showCreateAdmin = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-ink flex-1 disabled:opacity-60" :disabled="creatingAdmin">{{ creatingAdmin ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
