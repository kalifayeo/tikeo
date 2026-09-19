<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
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
  await deleteCategory(confirmDelete.value.id)
  confirmDelete.value = null
}
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-8 md:px-6">
    <div class="mb-6 flex items-center justify-between">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminCategories.title') }}</h1>
        <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminCategories.subtitle') }}</p>
      </div>
      <button type="button" class="btn-primary" @click="showCreateForm = !showCreateForm">
        {{ showCreateForm ? t('common.cancel') : t('adminCategories.addButton') }}
      </button>
    </div>

    <!-- Formulaire de création -->
    <form v-if="showCreateForm" class="mb-6 border border-tikeo-border bg-tikeo-surface p-5" @submit.prevent="handleCreate">
      <h2 class="mb-4 text-sm font-bold text-tikeo-black">{{ t('adminCategories.addButton') }}</h2>
      <p v-if="createError" class="mb-3 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ createError }}</p>
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
        <button type="submit" class="btn-primary" :disabled="creating">{{ creating ? t('common.saving') : t('common.save') }}</button>
      </div>
    </form>

    <p v-if="error" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-4 py-2 text-sm text-tikeo-error">{{ error }}</p>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 4" :key="i" class="h-14 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>

    <div v-else class="divide-y divide-tikeo-border border border-tikeo-border bg-tikeo-surface">
      <div v-for="(cat, i) in categories" :key="cat.id" class="p-4">
        <!-- Ligne en lecture -->
        <div v-if="editingId !== cat.id" class="flex flex-wrap items-center gap-3">
          <div class="flex flex-col">
            <button type="button" class="text-tikeo-gray-text hover:text-tikeo-orange disabled:opacity-30" :disabled="i === 0" @click="move(cat, -1)">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button type="button" class="text-tikeo-gray-text hover:text-tikeo-orange disabled:opacity-30" :disabled="i === categories.length - 1" @click="move(cat, 1)">
              <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <span class="flex h-10 w-10 shrink-0 items-center justify-center border border-tikeo-border bg-tikeo-surface-alt text-tikeo-orange">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
              <path stroke-linecap="round" stroke-linejoin="round" :d="categoryIconPath(cat.icon)" />
            </svg>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ cat.name }}</p>
            <p class="truncate text-xs text-tikeo-gray-text">/{{ cat.slug }}</p>
          </div>
          <span
            class="shrink-0 px-2 py-1 text-[10px] font-bold uppercase tracking-wide"
            :class="cat.status === 'active' ? 'bg-tikeo-success/10 text-tikeo-success' : 'bg-tikeo-gray-light text-tikeo-gray-text'"
          >
            {{ cat.status === 'active' ? t('adminCategories.statusActive') : t('adminCategories.statusInactive') }}
          </span>
          <button type="button" class="btn-secondary shrink-0 !px-3 !py-1.5 text-xs" @click="startEdit(cat)">{{ t('common.edit') }}</button>
          <button
            type="button"
            class="shrink-0 border border-tikeo-error/30 px-3 py-1.5 text-xs font-semibold text-tikeo-error hover:bg-tikeo-error/10 disabled:opacity-50"
            :disabled="deletingId === cat.id"
            @click="askDelete(cat)"
          >
            {{ t('common.delete') }}
          </button>
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
          <p v-if="editError" class="text-xs text-tikeo-error sm:col-span-2">{{ editError }}</p>
          <div class="flex gap-2 sm:col-span-2">
            <button type="button" class="btn-primary !py-1.5 text-xs" :disabled="savingEdit" @click="saveEdit(cat.id)">
              {{ savingEdit ? t('common.saving') : t('common.save') }}
            </button>
            <button type="button" class="btn-secondary !py-1.5 text-xs" @click="cancelEdit">{{ t('common.cancel') }}</button>
          </div>
        </div>
      </div>

      <p v-if="categories.length === 0" class="p-10 text-center text-sm text-tikeo-gray-text">{{ t('adminCategories.empty') }}</p>
    </div>

    <!-- Confirmation de suppression -->
    <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h3 class="mb-2 text-sm font-bold text-tikeo-black">{{ t('adminCategories.confirmDeleteTitle') }}</h3>
        <p class="mb-4 text-sm text-tikeo-gray-text">
          {{ confirmDelete.count > 0 ? t('adminCategories.confirmDeleteWithEvents', { count: confirmDelete.count, name: confirmDelete.name }) : t('adminCategories.confirmDeleteEmpty', { name: confirmDelete.name }) }}
        </p>
        <div class="flex justify-end gap-2">
          <button type="button" class="btn-secondary !py-1.5 text-xs" @click="confirmDelete = null">{{ t('common.cancel') }}</button>
          <button type="button" class="border border-tikeo-error bg-tikeo-error px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700" @click="performDelete">
            {{ t('common.delete') }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
