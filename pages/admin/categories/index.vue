<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'moderation.manage' })
import { CATEGORY_ICONS, categoryIconPath } from '~/composables/useCategoriesList'
import type { Category } from '~/types/database'

const { t } = useI18n()
const { categories, loading, error, slugify, createCategory, updateCategory, deleteCategory, countEventsUsingCategory } =
  useAdminCategories()

const iconKeys = Object.keys(CATEGORY_ICONS)

// --- Formulaire de création ---
const showCreateForm = ref(false)
const creating = ref(false)
const createError = ref('')
const newCategory = reactive({ name: '', slug: '', icon: iconKeys[0], status: 'active' as 'active' | 'inactive' })
const slugTouched = ref(false)

watch(
  () => newCategory.name,
  (name) => {
    if (!slugTouched.value) newCategory.slug = slugify(name)
  }
)

async function handleCreate() {
  createError.value = ''
  if (!newCategory.name.trim()) return
  creating.value = true
  try {
    await createCategory({ ...newCategory })
    await writeAuditLog({ action: 'CATEGORY_CREATED', entityType: 'categories', metadata: { name: newCategory.name } })
    newCategory.name = ''
    newCategory.slug = ''
    newCategory.icon = iconKeys[0]
    newCategory.status = 'active'
    slugTouched.value = false
    showCreateForm.value = false
  } catch (e: any) {
    createError.value = e?.message || t('adminCategories.errorSave')
  } finally {
    creating.value = false
  }
}

// --- Édition inline ---
const editingId = ref<string | null>(null)
const editForm = reactive({ name: '', slug: '', icon: '', status: 'active' as 'active' | 'inactive' })
const savingEdit = ref(false)
const editError = ref('')

function startEdit(cat: Category) {
  editingId.value = cat.id
  editForm.name = cat.name
  editForm.slug = cat.slug
  editForm.icon = cat.icon || iconKeys[0]
  editForm.status = cat.status as 'active' | 'inactive'
  editError.value = ''
}
function cancelEdit() {
  editingId.value = null
}
async function saveEdit(id: string) {
  editError.value = ''
  savingEdit.value = true
  try {
    await updateCategory(id, { ...editForm })
    await writeAuditLog({ action: 'CATEGORY_UPDATED', entityType: 'categories', entityId: id, metadata: { name: editForm.name } })
    editingId.value = null
  } catch (e: any) {
    editError.value = e?.message || t('adminCategories.errorSave')
  } finally {
    savingEdit.value = false
  }
}

// --- Réordonnancement (flèches haut/bas, s'appuie sur `position`) ---
async function move(cat: Category, direction: -1 | 1) {
  const sorted = [...categories.value].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
  const index = sorted.findIndex((c) => c.id === cat.id)
  const targetIndex = index + direction
  if (targetIndex < 0 || targetIndex >= sorted.length) return
  const other = sorted[targetIndex]
  const catPos = cat.position ?? 0
  const otherPos = other.position ?? 0
  await Promise.all([updateCategory(cat.id, { position: otherPos }), updateCategory(other.id, { position: catPos })])
}

// --- Suppression (avec avertissement si des événements y sont rattachés) ---
const deletingId = ref<string | null>(null)
const confirmDelete = ref<{ id: string; name: string; count: number } | null>(null)

async function askDelete(cat: Category) {
  deletingId.value = cat.id
  const count = await countEventsUsingCategory(cat.id)
  deletingId.value = null
  confirmDelete.value = { id: cat.id, name: cat.name, count }
}
async function performDelete() {
  if (!confirmDelete.value) return
  const target = confirmDelete.value
  await deleteCategory(target.id)
  await writeAuditLog({ action: 'CATEGORY_DELETED', entityType: 'categories', entityId: target.id, metadata: { name: target.name, events: target.count } })
  confirmDelete.value = null
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminCategories.title') }}</h1>
        <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminCategories.subtitle') }}</p>
      </div>
      <button type="button" class="btn-ink !h-10 !px-4 !text-[13px] shrink-0" :aria-label="showCreateForm ? t('common.cancel') : t('adminCategories.addButton')" @click="showCreateForm = !showCreateForm">
        <AppIcon :name="showCreateForm ? 'close' : 'plus'" class="h-[18px] w-[18px]" :stroke="2.2" />
        <span class="hidden sm:inline">{{ showCreateForm ? t('common.cancel') : t('adminCategories.addButton').replace(/^\+\s*/, '') }}</span>
      </button>
    </div>

    <!-- Formulaire de création -->
    <form v-if="showCreateForm" class="org-panel relative mb-6 p-5" @submit.prevent="handleCreate">
      <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
      <h2 class="mb-4 font-display text-base font-extrabold text-tikeo-black">{{ t('adminCategories.addButton').replace(/^\+\s*/, '') }}</h2>
      <p v-if="createError" class="acc-alert-error mb-3 !text-xs">{{ createError }}</p>
      <div class="grid gap-3 sm:grid-cols-2">
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminCategories.colName') }}</label>
          <input v-model="newCategory.name" type="text" required class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminCategories.colSlug') }}</label>
          <input v-model="newCategory.slug" type="text" required class="input-field w-full" @input="slugTouched = true" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminCategories.colIcon') }}</label>
          <select v-model="newCategory.icon" class="input-field w-full">
            <option v-for="key in iconKeys" :key="key" :value="key">{{ key }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminCategories.colStatus') }}</label>
          <select v-model="newCategory.status" class="input-field w-full">
            <option value="active">{{ t('adminCategories.statusActive') }}</option>
            <option value="inactive">{{ t('adminCategories.statusInactive') }}</option>
          </select>
        </div>
      </div>
      <div class="mt-4 flex items-center gap-3">
        <span class="flex h-10 w-10 items-center justify-center border border-tikeo-border bg-tikeo-surface-alt text-tikeo-orange">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIconPath(newCategory.icon)" />
          </svg>
        </span>
        <button type="submit" class="btn-ink disabled:opacity-60" :disabled="creating"><AppIcon name="save" class="h-[18px] w-[18px]" />{{ creating ? t('common.saving') : t('common.save') }}</button>
      </div>
    </form>

    <p v-if="error" class="acc-alert-error mb-4">{{ error }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else class="org-panel divide-y divide-tikeo-border">
      <div v-for="(cat, i) in categories" :key="cat.id" class="p-4">
        <!-- Ligne en lecture -->
        <div v-if="editingId !== cat.id" class="flex flex-wrap items-center gap-3">
          <div class="flex flex-col">
            <button type="button" class="text-tikeo-gray-text transition-colors hover:text-tikeo-orange disabled:opacity-30" :disabled="i === 0" :aria-label="t('adminCommon.moveUp')" @click="move(cat, -1)"><AppIcon name="chevron-down" class="h-4 w-4 rotate-180" :stroke="2.4" /></button>
            <button type="button" class="text-tikeo-gray-text transition-colors hover:text-tikeo-orange disabled:opacity-30" :disabled="i === categories.length - 1" :aria-label="t('adminCommon.moveDown')" @click="move(cat, 1)"><AppIcon name="chevron-down" class="h-4 w-4" :stroke="2.4" /></button>
          </div>
          <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-tikeo-ink text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIconPath(cat.icon)" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ cat.name }}</p>
            <p class="truncate text-xs text-tikeo-gray-text">/{{ cat.slug }}</p>
          </div>
          <StatusPill :tone="cat.status === 'active' ? 'success' : 'neutral'">{{ cat.status === 'active' ? t('adminCategories.statusActive') : t('adminCategories.statusInactive') }}</StatusPill>
          <OrgIconButton icon="edit" :label="t('common.edit')" @click="startEdit(cat)" />
          <OrgIconButton icon="trash" danger :label="t('common.delete')" :loading="deletingId === cat.id" @click="askDelete(cat)" />
        </div>

        <!-- Ligne en édition -->
        <div v-else class="grid gap-3 sm:grid-cols-2">
          <input v-model="editForm.name" type="text" class="input-field w-full" :placeholder="t('adminCategories.colName')" />
          <input v-model="editForm.slug" type="text" class="input-field w-full" :placeholder="t('adminCategories.colSlug')" />
          <select v-model="editForm.icon" class="input-field w-full">
            <option v-for="key in iconKeys" :key="key" :value="key">{{ key }}</option>
          </select>
          <select v-model="editForm.status" class="input-field w-full">
            <option value="active">{{ t('adminCategories.statusActive') }}</option>
            <option value="inactive">{{ t('adminCategories.statusInactive') }}</option>
          </select>
          <p v-if="editError" class="acc-alert-error !text-xs sm:col-span-2">{{ editError }}</p>
          <div class="flex gap-2 sm:col-span-2">
            <OrgIconButton icon="save" :label="t('common.save')" :loading="savingEdit" @click="saveEdit(cat.id)" />
            <OrgIconButton icon="close" :label="t('common.cancel')" @click="cancelEdit" />
          </div>
        </div>
      </div>

      <AdminEmpty v-if="categories.length === 0" icon="tag" :text="t('adminCategories.empty')" class="!border-0" />
    </div>

    <!-- Confirmation de suppression -->
    <ConfirmDeleteModal
      :open="!!confirmDelete"
      :title="t('adminCategories.confirmDeleteTitle')"
      :message="confirmDelete ? (confirmDelete.count > 0 ? t('adminCategories.confirmDeleteWithEvents', { count: confirmDelete.count, name: confirmDelete.name }) : t('adminCategories.confirmDeleteEmpty', { name: confirmDelete.name })) : ''"
      :confirm-label="t('common.delete')"
      @confirm="performDelete"
      @cancel="confirmDelete = null"
    />
  </div>
</template>
