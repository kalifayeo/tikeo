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
const canDelete = computed(() => authStore.isSuperAdmin || authStore.hasPermission('users.delete'))
const deletingFor = ref<string | null>(null)

function canToggleStatus(u: Profile) {
  if (u.status === 'deleted') return false
  return u.status === 'suspended' ? canReactivate.value : canSuspend.value
}

const roleOptions = computed<{ value: UserRole; label: string }[]>(() => [
  { value: 'buyer', label: t('adminUsers.roleBuyer') },
  { value: 'organizer', label: t('adminUsers.roleOrganizer') },
  { value: 'agent', label: t('adminUsers.roleAgent') },
  { value: 'admin', label: t('adminUsers.roleAdmin') },
])

function statusLabel(u: Profile) {
  if (u.status === 'deleted') return t('adminUsers.statusDeleted')
  if (u.status === 'suspended') return t('adminUsers.statusSuspended')
  return t('adminAdministrators.statusActive')
}

function statusTone(u: Profile) {
  if (u.status === 'deleted') return 'neutral'
  if (u.status === 'suspended') return 'error'
  return 'success'
}

const search = ref('')
const roleFilter = ref<'all' | UserRole>('all')
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return users.value.filter((u) => {
    if (roleFilter.value !== 'all' && u.role !== roleFilter.value) return false
    if (!q) return true
    return [u.full_name, u.email, u.phone].some((v) => (v || '').toString().toLowerCase().includes(q))
  })
})
const roleChips = computed(() => [
  { value: 'all', label: t('adminCommon.all'), count: users.value.length },
  ...roleOptions.value.map((o) => ({ value: o.value, label: o.label, count: users.value.filter((u) => u.role === o.value).length })),
])

// Confirmations (fenêtre du site, plus de confirm() natif du navigateur)
const pendingSuspend = ref<Profile | null>(null)
const pendingDelete = ref<Profile | null>(null)

// "Membre depuis" (demandé pour les 3 panneaux : admin, organisateur,
// acheteur — voir aussi pages/mon-espace/profil/index.vue et
// pages/organisateur/parametres/index.vue). profiles.created_at existe déjà
// depuis la création du compte, il ne manquait que l'affichage ici.
function memberSince(u: Profile) {
  return new Date(u.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })
}

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

  togglingStatusFor.value = u.id
  errorMessage.value = ''
  try {
    const { error } = await supabase.from('profiles').update({ status: next }).eq('id', u.id).select('id').single()
    if (error) throw error
    u.status = next
    await writeAuditLog({
      action: next === 'suspended' ? 'USER_SUSPENDED' : 'USER_REACTIVATED',
      entityType: 'profiles',
      entityId: u.user_id,
      metadata: { email: u.email, name: u.full_name },
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
    await writeAuditLog({
      action: 'USER_ROLE_CHANGED',
      entityType: 'profiles',
      entityId: u.user_id,
      metadata: { email: u.email, from: previousRole, to: newRole },
    })
  } catch (e: any) {
    errorMessage.value = e?.message || t('adminUsers.errorRole')
  } finally {
    savingRoleFor.value = null
  }
}

// ------------------------------------------------------------
// Suppression réelle d'un compte (permission users.delete, jusqu'ici
// définie mais jamais utilisée nulle part dans l'application). Anonymise le
// profil et bloque la connexion côté Supabase Auth sans toucher aux
// commandes/paiements déjà enregistrés — voir
// server/api/admin/users/[userId]/delete.post.ts pour le détail complet.
// ------------------------------------------------------------
async function deleteUser(u: Profile) {
  deletingFor.value = u.id
  errorMessage.value = ''
  try {
    const {
      data: { session },
    } = await supabase.auth.getSession()
    if (!session) throw new Error('Session expirée, reconnectez-vous.')

    const { csrfHeader } = useCsrf()
    await $fetch(`/api/admin/users/${u.user_id}/delete`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}`, ...(await csrfHeader()) },
    })
    u.status = 'deleted'
    u.full_name = 'Compte supprimé'
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || t('adminUsers.errorDelete')
  } finally {
    deletingFor.value = null
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

async function confirmSuspendAction() {
  const u = pendingSuspend.value
  pendingSuspend.value = null
  if (u) await toggleSuspend(u)
}
async function confirmDeleteAction() {
  const u = pendingDelete.value
  pendingDelete.value = null
  if (u) await deleteUser(u)
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-center justify-between">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminUsers.title') }}</h1>
      <button v-if="canCreate" type="button" class="btn-ink !h-10 !px-4 !text-[13px]" :aria-label="t('adminUsers.addUser')" @click="openCreateModal">
        <AppIcon name="user-plus" class="h-[18px] w-[18px]" /><span class="hidden sm:inline">{{ t('adminUsers.addUser').replace(/^\+\s*/, '') }}</span>
      </button>
    </div>

    <p v-if="errorMessage" class="acc-alert-error mb-4">{{ errorMessage }}</p>

    <template v-if="!loading && users.length">
      <div class="admin-toolbar">
        <AdminSearch v-model="search" :placeholder="t('adminUsers.search')" />
        <div class="flex flex-wrap gap-2">
          <button v-for="c in roleChips" :key="c.value" type="button" class="admin-chip" :class="roleFilter === c.value ? 'is-active' : ''" @click="roleFilter = c.value as any">
            {{ c.label }} <span class="opacity-60">{{ c.count }}</span>
          </button>
        </div>
      </div>
      <AdminEmpty v-if="filtered.length === 0" icon="search" :text="t('adminCommon.noResults')" />
      <template v-else>
      <!-- Cartes empilées : lisibles sans défilement horizontal sur mobile/petit écran -->
      <div class="flex flex-col gap-3 md:hidden">
        <div v-for="u in filtered" :key="u.id" class="org-panel p-3">
          <p class="truncate font-semibold text-tikeo-black">{{ u.full_name }}</p>
          <p class="truncate text-xs text-tikeo-gray-text">{{ u.email }}</p>
          <p class="mt-2"><StatusPill :tone="statusTone(u)" :strike="u.status === 'deleted'">{{ statusLabel(u) }}</StatusPill></p>
          <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ t('adminUsers.colMemberSince') }} : {{ memberSince(u) }}</p>
          <div class="mt-3 flex flex-wrap items-center gap-2">
            <select
              class="h-9 border border-tikeo-border bg-tikeo-surface px-2 text-xs font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none disabled:opacity-60"
              :value="u.role"
              :disabled="savingRoleFor === u.id || !canManageRoles || u.status === 'deleted'"
              @change="changeRole(u, ($event.target as HTMLSelectElement).value as any)"
            >
              <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
            <OrgIconButton
              v-if="canToggleStatus(u)"
              :icon="u.status === 'suspended' ? 'user-check' : 'ban'"
              :danger="u.status !== 'suspended'"
              :label="u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend')"
              :loading="togglingStatusFor === u.id"
              @click="pendingSuspend = u"
            />
            <OrgIconButton
              v-if="canDelete && u.status !== 'deleted'"
              icon="trash"
              danger
              :label="t('adminUsers.delete')"
              :loading="deletingFor === u.id"
              @click="pendingDelete = u"
            />
          </div>
        </div>
      </div>

      <!-- Tableau classique : à partir de md, l'écran est assez large pour toutes les colonnes -->
      <div class="hidden overflow-x-auto md:block">
        <table class="w-full border border-tikeo-border text-left text-sm">
          <thead class="bg-tikeo-surface-alt text-xs uppercase text-tikeo-gray-text">
            <tr>
              <th class="px-3 py-3">{{ t('adminUsers.colName') }}</th>
              <th class="px-3 py-3">{{ t('adminUsers.colEmail') }}</th>
              <th class="px-3 py-3">{{ t('adminUsers.colRole') }}</th>
              <th class="px-3 py-3">{{ t('adminUsers.colStatus') }}</th>
              <th class="px-3 py-3">{{ t('adminUsers.colMemberSince') }}</th>
              <th class="px-3 py-3 text-right">{{ t('adminUsers.colAction') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-tikeo-border">
            <tr v-for="u in filtered" :key="u.id">
              <td class="px-3 py-3 font-medium text-tikeo-black">{{ u.full_name }}</td>
              <td class="px-3 py-3 text-tikeo-gray-text">{{ u.email }}</td>
              <td class="px-3 py-3">
                <select
                  class="h-9 border border-tikeo-border bg-tikeo-surface px-2 text-xs font-semibold text-tikeo-black focus:border-[#FF7A00] focus:outline-none disabled:opacity-60"
                  :value="u.role"
                  :disabled="savingRoleFor === u.id || !canManageRoles || u.status === 'deleted'"
                  @change="changeRole(u, ($event.target as HTMLSelectElement).value as any)"
                >
                  <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </td>
              <td class="px-3 py-3">
                <StatusPill :tone="statusTone(u)" :strike="u.status === 'deleted'">{{ statusLabel(u) }}</StatusPill>
              </td>
              <td class="px-3 py-3 text-tikeo-gray-text">{{ memberSince(u) }}</td>
              <td class="px-3 py-3">
                <div class="flex items-center justify-end gap-1.5">
                  <OrgIconButton
              v-if="canToggleStatus(u)"
              :icon="u.status === 'suspended' ? 'user-check' : 'ban'"
              :danger="u.status !== 'suspended'"
              :label="u.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend')"
              :loading="togglingStatusFor === u.id"
              @click="pendingSuspend = u"
            />
                  <OrgIconButton
              v-if="canDelete && u.status !== 'deleted'"
              icon="trash"
              danger
              :label="t('adminUsers.delete')"
              :loading="deletingFor === u.id"
              @click="pendingDelete = u"
            />
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      </template>
    </template>
    <div v-else-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-12 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <AdminEmpty v-else icon="users" :text="t('adminUsers.empty')" />

    <!-- Modale de création -->
    <div v-if="showCreateModal" class="fixed inset-0 z-[110] flex items-end justify-center bg-tikeo-ink/60 p-4 backdrop-blur-sm sm:items-center" @click.self="showCreateModal = false">
      <div class="relative w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5 shadow-2xl">
        <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
        <h2 class="mb-4 flex items-center gap-2 font-display text-base font-extrabold text-tikeo-black"><AppIcon name="user-plus" class="h-5 w-5 text-tikeo-orange" />{{ t('adminUsers.modalTitle') }}</h2>
        <p v-if="createError" class="acc-alert-error mb-3 !text-xs">{{ createError }}</p>
        <form class="flex flex-col gap-3" @submit.prevent="submitCreateUser">
          <input v-model="createForm.fullName" type="text" required :placeholder="t('adminUsers.fullNamePlaceholder')" class="input-field" />
          <input v-model="createForm.email" type="email" required :placeholder="t('adminUsers.emailPlaceholder')" class="input-field" />
          <input v-model="createForm.phone" type="tel" :placeholder="t('adminUsers.phonePlaceholder')" class="input-field" />
          <select v-model="createForm.role" class="input-field">
            <option v-for="opt in roleOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <p class="text-xs text-tikeo-gray-text">{{ t('adminUsers.passwordLinkNote') }}</p>
          <div class="flex gap-2 pt-2">
            <button type="button" class="acc-btn-ghost flex-1" @click="showCreateModal = false">{{ t('adminUsers.cancel') }}</button>
            <button type="submit" class="btn-ink flex-1 disabled:opacity-60" :disabled="creating">{{ creating ? t('adminUsers.creating') : t('adminUsers.create') }}</button>
          </div>
        </form>
      </div>
    </div>

    <ConfirmDeleteModal
      :open="!!pendingSuspend"
      :title="pendingSuspend?.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend')"
      :message="pendingSuspend ? (pendingSuspend.status === 'suspended' ? t('adminUsers.confirmReactivate', { name: pendingSuspend.full_name }) : t('adminUsers.confirmSuspend', { name: pendingSuspend.full_name })) : ''"
      :confirm-label="pendingSuspend?.status === 'suspended' ? t('adminUsers.reactivate') : t('adminUsers.suspend')"
      @confirm="confirmSuspendAction"
      @cancel="pendingSuspend = null"
    />
    <ConfirmDeleteModal
      :open="!!pendingDelete"
      :title="t('adminUsers.delete')"
      :message="pendingDelete ? t('adminUsers.confirmDelete', { name: pendingDelete.full_name }) : ''"
      :confirm-label="t('adminUsers.delete')"
      @confirm="confirmDeleteAction"
      @cancel="pendingDelete = null"
    />
  </div>
</template>
