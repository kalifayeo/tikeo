<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: ['admin.manage_admins', 'admin.manage_permissions'] })
import type { Profile } from '~/types/database'

const { t } = useI18n()
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
  if (!confirm(confirmMsg)) return
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
      <button v-if="canManageAdmins" type="button" class="btn-primary text-sm" @click="showCreateAdmin = true">
        {{ t('adminAdministrators.addAdmin') }}
      </button>
    </div>

    <div class="mb-5 flex gap-1 border-b border-tikeo-border text-sm font-medium">
      <button
        v-if="canManageAdmins"
        type="button"
        class="border-b-2 px-3 py-2"
        :class="tab === 'admins' ? 'border-tikeo-orange text-tikeo-orange' : 'border-transparent text-tikeo-gray-text'"
        @click="tab = 'admins'"
      >
        {{ t('adminAdministrators.tabAdmins') }}
      </button>
      <button
        v-if="canManagePermissions"
        type="button"
        class="border-b-2 px-3 py-2"
        :class="tab === 'roles' ? 'border-tikeo-orange text-tikeo-orange' : 'border-transparent text-tikeo-gray-text'"
        @click="tab = 'roles'"
      >
        {{ t('adminAdministrators.tabRoles') }}
      </button>
    </div>

    <p v-if="error || actionError" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ error || actionError }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <!-- Onglet Administrateurs : qui a quel(s) rôle(s) -->
    <template v-else-if="tab === 'admins' && canManageAdmins">
      <div class="overflow-x-auto border border-tikeo-border">
        <table class="w-full border-collapse text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-2">{{ t('adminAdministrators.colAdmin') }}</th>
              <th class="px-3 py-2">{{ t('adminAdministrators.colStatus') }}</th>
              <th v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center" :title="r.description || ''">
                {{ r.name }}
              </th>
              <th class="px-3 py-2">{{ t('adminAdministrators.colAction') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="u in adminUsers" :key="u.id">
              <td class="px-3 py-2">
                <p class="font-medium text-tikeo-black">{{ u.full_name }}</p>
                <p class="text-xs text-tikeo-gray-text">{{ u.email }}</p>
                <span v-if="u.roleKeys.includes('super_admin')" class="mt-1 inline-block bg-tikeo-orange/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-tikeo-orange">
                  {{ t('adminAdministrators.superAdminBadge') }}
                </span>
              </td>
              <td class="px-3 py-2">
                <span :class="u.status === 'suspended' ? 'text-tikeo-error' : 'text-tikeo-success'">
                  {{ u.status === 'suspended' ? t('adminUsers.statusSuspended') : t('adminAdministrators.statusActive') }}
                </span>
              </td>
              <td v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center">
                <input
                  type="checkbox"
                  :checked="u.roleKeys.includes(r.key)"
                  :disabled="pendingKey === `${u.user_id}:${r.id}` || u.roleKeys.includes('super_admin')"
                  @change="onToggleUserRole(u.user_id, r.id, ($event.target as HTMLInputElement).checked)"
                />
              </td>
              <td class="px-3 py-2">
                <button
                  type="button"
                  class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error"
                  @click="onToggleStatus(u)"
                >
                  {{ u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminAdministrators.deactivate') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p v-if="!adminUsers.length" class="mt-4 border border-dashed border-tikeo-border p-8 text-center text-sm text-tikeo-gray-text">
        {{ t('adminAdministrators.emptyAdmins') }}
      </p>
    </template>

    <!-- Onglet Rôles & permissions : matrice permission x rôle -->
    <template v-else-if="tab === 'roles' && canManagePermissions">
      <div class="mb-4 flex justify-end">
        <button type="button" class="btn-secondary text-sm" @click="showCreateRole = true">{{ t('adminAdministrators.addRole') }}</button>
      </div>

      <div v-for="(perms, category) in permissionsByCategory" :key="category" class="mb-6 overflow-x-auto border border-tikeo-border">
        <table class="w-full border-collapse text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-2">{{ categoryLabels[category] || category }}</th>
              <th v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center">{{ r.name }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="perm in perms" :key="perm.id">
              <td class="px-3 py-2 text-tikeo-gray-text">{{ perm.description }}</td>
              <td v-for="r in assignableRoles" :key="r.id" class="px-3 py-2 text-center">
                <input
                  type="checkbox"
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
    <div v-if="showCreateRole" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h2 class="mb-4 text-sm font-bold text-tikeo-black">{{ t('adminAdministrators.newRoleTitle') }}</h2>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateRole">
          <input v-model="newRole.name" type="text" required :placeholder="t('adminAdministrators.roleNamePlaceholder')" class="input-field" />
          <input v-model="newRole.key" type="text" required :placeholder="t('adminAdministrators.roleKeyPlaceholder')" class="input-field" />
          <textarea v-model="newRole.description" rows="2" :placeholder="t('adminAdministrators.roleDescriptionPlaceholder')" class="input-field" />
          <div class="flex gap-2 pt-2">
            <button type="button" class="btn-secondary flex-1 text-sm" @click="showCreateRole = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-primary flex-1 text-sm" :disabled="creatingRole">{{ creatingRole ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modale : nouvel administrateur -->
    <div v-if="showCreateAdmin" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h2 class="mb-4 text-sm font-bold text-tikeo-black">{{ t('adminAdministrators.newAdminTitle') }}</h2>
        <p v-if="createAdminError" class="mb-3 border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ createAdminError }}</p>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateAdmin">
          <input v-model="newAdmin.fullName" type="text" required :placeholder="t('adminUsers.fullNamePlaceholder')" class="input-field" />
          <input v-model="newAdmin.email" type="email" required :placeholder="t('adminUsers.emailPlaceholder')" class="input-field" />
          <input v-model="newAdmin.phone" type="tel" :placeholder="t('adminUsers.phonePlaceholder')" class="input-field" />
          <p class="text-xs text-tikeo-gray-text">{{ t('adminAdministrators.newAdminNote') }}</p>
          <div class="flex gap-2 pt-2">
            <button type="button" class="btn-secondary flex-1 text-sm" @click="showCreateAdmin = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-primary flex-1 text-sm" :disabled="creatingAdmin">{{ creatingAdmin ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
