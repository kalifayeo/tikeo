<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'users.view' })
import type { Profile, UserRole } from '~/types/database'

const { t } = useI18n()
const supabase = useSupabase()
const authStore = useAuthStore()
const loading = ref(true)
const users = ref<Profile[]>([])
const errorMessage = ref('')
const savingRoleFor = ref<string | null>(null)
const togglingStatusFor = ref<string | null>(null)

// RBAC (migration 0021) : suspendre et réactiver sont deux permissions
// distinctes (un rôle peut avoir l'une sans l'autre), tout comme changer le
// rôle applicatif d'un compte. Ces vérifications sont un confort d'UI :
// même si quelqu'un forçait l'action depuis les DevTools, la RLS/le
// trigger de verrouillage (0021) refuseraient la requête côté base.
const canSuspend = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.suspend'))
const canReactivate = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.reactivate'))
const canManageRoles = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.manage_roles'))
const canCreate = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.create'))

function canToggleStatus(u: Profile) {
  return u.status === 'suspended' ? canReactivate.value : canSuspend.value
}

const roleOptions = computed<{ value: UserRole; label: string }[]>(() => [
  { value: 'buyer', label: t('adminUsers.roleBuyer') },
  { value: 'organizer', label: t('adminUsers.roleOrganizer') },
  { value: 'agent', label: t('adminUsers.roleAgent') },
  { value: 'admin', label: t('adminUsers.roleAdmin') },
])

async function load() {
  loading.value = true
  errorMessage.value = ''
  try {
    const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
    if (error) throw error
    users.value = (data as unknown as Profile[]) ?? []
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminUsers.errorLoad')
  } finally {
    loading.value = false
  }
}

// ------------------------------------------------------------
// Correctif "Suspendre un utilisateur" :
//   - l'erreur n'était jamais montrée à l'admin (le bouton semblait ne
//     "rien faire" en cas d'échec RLS/réseau) -> on l'affiche désormais ;
//   - aucune confirmation avant une action destructrice -> ajoutée ;
//   - aucun état de chargement par ligne -> ajouté (évite le double-clic) ;
//   - surtout, la suspension elle-même n'avait aucun effet réel ailleurs
//     dans l'application (voir supabase/migrations/0021_*.sql pour le
//     correctif de fond, au niveau RLS/triggers, pas seulement ici).
// ------------------------------------------------------------
async function toggleSuspend(u: Profile) {
  const next = u.status === 'suspended' ? 'active' : 'suspended'
  const confirmMsg = next === 'suspended' ? t('adminUsers.confirmSuspend', { name: u.full_name }) : t('adminUsers.confirmReactivate', { name: u.full_name })
  if (!confirm(confirmMsg)) return

  togglingStatusFor.value = u.id
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id).select('id').single()
    if (error) throw error
    u.status = next
    await supabase.from('audit_logs').insert({
      action: next === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entity_type: 'profiles',
      entity_id: u.user_id,
      metadata: { email: u.email },
    })
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminUsers.errorStatus')
  } finally {
    togglingStatusFor.value = null
  }
}

// ------------------------------------------------------------
// Gestion des rôles directement depuis le panneau admin.
// Autorisé par la policy "Admin modifie tous les profils" + la permission
// RBAC users.manage_roles (migration 0021) : pas besoin d'une route
// serveur, l'admin a déjà les droits nécessaires si le trigger l'accepte.
// ------------------------------------------------------------
async function changeRole(u: Profile, newRole: UserRole) {
  if (newRole === u.role) return
  if (!canManageRoles.value) {
    errorMessage.value = t('adminUsers.errorPermissionRole')
    return
  }
  savingRoleFor.value = u.id
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', u.id)
    if (error) throw error
    const previousRole = u.role
    u.role = newRole
    // Journal d'audit best-effort (policy d'insertion admin ajoutée en 0009).
    await supabase.from('audit_logs').insert({
      action: 'USER_ROLE_CHANGED',
      entity_type: 'profiles',
      entity_id: u.user_id,
      metadata: { from: previousRole, to: newRole },
    })
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminUsers.errorRole')
  } finally {
    savingRoleFor.value = null
  }
}

// ------------------------------------------------------------
// Création d'un utilisateur (y compris un admin) depuis le panneau admin.
// Doit passer par le serveur : créer un compte Supabase Auth nécessite la
// clé service_role, jamais exposée au client (§54 du cahier des charges).
// ------------------------------------------------------------
const showCreateModal = ref(false)
const creating = ref(false)
const createError = ref('')
const createForm = reactive({ fullName: '', email: '', phone: '', role: 'buyer' as UserRole })

function openCreateModal() {
  Object.assign(createForm, { fullName: '', email: '', phone: '', role: 'buyer' })
  createError.value = ''
  showCreateModal.value = true
}

async function submitCreateUser() {
  creating.value = true
  createError.value = ''
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')

    const { csrfHeader } = useCsrf()
    const response = await $fetch<{ profile: Profile }>('/api/admin/users', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
      body: {
        fullName: createForm.fullName,
        email: createForm.email,
        phone: createForm.phone || undefined,
        role: createForm.role,
      },
    })

    if (response.profile) users.value.unshift(response.profile)
    showCreateModal.value = false
  } catch (e: any) {
    createError.value = e?.data?.statusMessage || e?.message || t('adminUsers.errorCreate')
  } finally {
    creating.value = false
  }
}

onMounted(load)
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminUsers.title') }}</h1>
      <button v-if="canCreate" type="button" class="btn-primary text-sm" @click="openCreateModal">{{ t('adminUsers.addUser') }}</button>
    </div>

    <p v-if="errorMessage" class="mb-4 border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{{ errorMessage }}</p>

    <template v-if="!loading && users.length">
      <!-- Cartes empilées : lisibles sans défilement horizontal sur mobile/petit écran -->
      <div class="flex flex-col gap-3 md:hidden">
        <div v-for="u in users" :key="u.id" class="border border-tikeo-border bg-tikeo-surface p-3">
          <p class="truncate font-semibold text-tikeo-black">{{ u.full_name }}</p>
          <p class="truncate text-xs text-tikeo-gray-text">{{ u.email }}</p>
          <p class="mt-1 text-xs text-tikeo-gray-text">
            {{ t('adminUsers.colStatus') }} :
            <span :class="u.status === 'suspended' ? 'font-semibold text-tikeo-error' : 'text-tikeo-success'">{{ u.status === 'suspended' ? t('adminUsers.statusSuspended') : t('adminAdministrators.statusActive') }}</span>
          </p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <select
              class="border border-tikeo-border bg-transparent px-1.5 py-1 text-xs text-tikeo-black"
              :value="u.role"
              :disabled="savingRoleFor === u.id || !canManageRoles"
              @change="changeRole(u, ($event.target as HTMLSelectElement).value as any)"
            >
              <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <button
              v-if="canToggleStatus(u)"
              type="button"
              class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error disabled:opacity-50"
              :disabled="togglingStatusFor === u.id"
              @click="toggleSuspend(u)"
            >
              {{ togglingStatusFor === u.id ? t('adminUsers.updating') : u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend') }}
            </button>
          </div>
        </div>
      </div>

      <!-- Tableau classique : à partir de md, l'écran est assez large pour toutes les colonnes -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-2">{{ t('adminUsers.colName') }}</th>
              <th class="px-3 py-2">{{ t('adminUsers.colEmail') }}</th>
              <th class="px-3 py-2">{{ t('adminUsers.colRole') }}</th>
              <th class="px-3 py-2">{{ t('adminUsers.colStatus') }}</th>
              <th class="px-3 py-2">{{ t('adminUsers.colAction') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="u in users" :key="u.id">
              <td class="px-3 py-2 font-medium text-tikeo-black">{{ u.full_name }}</td>
              <td class="px-3 py-2 text-tikeo-gray-text">{{ u.email }}</td>
              <td class="px-3 py-2">
                <select
                  class="border border-tikeo-border bg-transparent px-1.5 py-1 text-xs text-tikeo-black"
                  :value="u.role"
                  :disabled="savingRoleFor === u.id || !canManageRoles"
                  @change="changeRole(u, ($event.target as HTMLSelectElement).value as any)"
                >
                  <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </td>
              <td class="px-3 py-2">
                <span :class="u.status === 'suspended' ? 'font-semibold text-tikeo-error' : 'text-tikeo-success'">
                  {{ u.status === 'suspended' ? t('adminUsers.statusSuspended') : t('adminAdministrators.statusActive') }}
                </span>
              </td>
              <td class="px-3 py-2">
                <button
                  v-if="canToggleStatus(u)"
                  type="button"
                  class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error disabled:opacity-50"
                  :disabled="togglingStatusFor === u.id"
                  @click="toggleSuspend(u)"
                >
                  {{ togglingStatusFor === u.id ? t('adminUsers.updating') : u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend') }}
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
    <div v-else-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <div v-else class="border border-dashed border-tikeo-border p-10 text-center text-sm text-tikeo-gray-text">{{ t('adminUsers.empty') }}</div>

    <!-- Modale de création -->
    <div v-if="showCreateModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h2 class="mb-4 text-sm font-bold text-tikeo-black">{{ t('adminUsers.modalTitle') }}</h2>
        <p v-if="createError" class="mb-3 border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-600">{{ createError }}</p>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateUser">
          <input v-model="createForm.fullName" type="text" required :placeholder="t('adminUsers.fullNamePlaceholder')" class="input-field" />
          <input v-model="createForm.email" type="email" required :placeholder="t('adminUsers.emailPlaceholder')" class="input-field" />
          <input v-model="createForm.phone" type="tel" :placeholder="t('adminUsers.phonePlaceholder')" class="input-field" />
          <select v-model="createForm.role" class="input-field">
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="text-xs text-tikeo-gray-text">{{ t('adminUsers.passwordLinkNote') }}</p>
          <div class="flex gap-2 pt-2">
            <button type="button" class="btn-secondary flex-1 text-sm" @click="showCreateModal = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-primary flex-1 text-sm" :disabled="creating">{{ creating ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
