<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
import { guessMediaType } from '~/composables/useHomeSlides'
import type { HomeSlide } from '~/types/database'

const { t } = useI18n()

// --- Texte de la bannière centrale ---
const { content: heroContent, loading: heroLoading, saveContent } = useAdminHeroContent()
const heroForm = reactive({ title: '', subtitle: '', cta_label: '', cta_url: '' })
const heroSaving = ref(false)
const heroSaved = ref(false)
const heroError = ref('')

watch(
  heroContent,
  (c) => {
    if (!c) return
    heroForm.title = c.title || ''
    heroForm.subtitle = c.subtitle || ''
    heroForm.cta_label = c.cta_label || ''
    heroForm.cta_url = c.cta_url || ''
  },
  { immediate: true }
)

async function handleSaveHero() {
  heroError.value = ''
  heroSaved.value = false
  heroSaving.value = true
  try {
    await saveContent({
      title: heroForm.title.trim() || null,
      subtitle: heroForm.subtitle.trim() || null,
      cta_label: heroForm.cta_label.trim() || null,
      cta_url: heroForm.cta_url.trim() || null,
    })
    heroSaved.value = true
    setTimeout(() => (heroSaved.value = false), 3000)
  } catch (e: any) {
    heroError.value = e?.message || t('adminHomeSlides.errorSave')
  } finally {
    heroSaving.value = false
  }
}

// --- Images/gifs par zone ---
const { byZone, createSlide, updateSlide, deleteSlide, move } = useAdminHomeSlides()

const zones = [
  { key: 'center' as const, label: t('adminHomeSlides.zoneCenter'), hint: t('adminHomeSlides.zoneCenterHint') },
  { key: 'left' as const, label: t('adminHomeSlides.zoneLeft'), hint: t('adminHomeSlides.zoneSideHint') },
  { key: 'right' as const, label: t('adminHomeSlides.zoneRight'), hint: t('adminHomeSlides.zoneSideHint') },
]

const zoneSlides = Object.fromEntries(zones.map((z) => [z.key, byZone(z.key)])) as Record<
  (typeof zones)[number]['key'],
  ReturnType<typeof byZone>
>

// Formulaire d'ajout, un par zone
const newUrl = reactive<Record<string, string>>({ center: '', left: '', right: '' })
const adding = reactive<Record<string, boolean>>({ center: false, left: false, right: false })
const addError = reactive<Record<string, string>>({ center: '', left: '', right: '' })

async function handleAdd(zone: 'center' | 'left' | 'right') {
  addError[zone] = ''
  const url = newUrl[zone].trim()
  if (!url) return
  adding[zone] = true
  try {
    await createSlide({ zone, media_url: url, media_type: guessMediaType(url), status: 'active' })
    newUrl[zone] = ''
  } catch (e: any) {
    addError[zone] = e?.message || t('adminHomeSlides.errorSave')
  } finally {
    adding[zone] = false
  }
}

async function toggleStatus(slide: HomeSlide) {
  await updateSlide(slide.id, { status: slide.status === 'active' ? 'inactive' : 'active' })
}

const confirmDelete = ref<HomeSlide | null>(null)
async function performDelete() {
  if (!confirmDelete.value) return
  await deleteSlide(confirmDelete.value.id)
  confirmDelete.value = null
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6">
      <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminHomeSlides.title') }}</h1>
      <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminHomeSlides.subtitle') }}</p>
    </div>

    <!-- Texte de la bannière centrale -->
    <section class="mb-8 border border-tikeo-border bg-tikeo-surface p-5">
      <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminHomeSlides.textSectionTitle') }}</h2>
      <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.textSectionSubtitle') }}</p>

      <form v-if="!heroLoading" class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="handleSaveHero">
        <p v-if="heroError" class="border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error sm:col-span-2">
          {{ heroError }}
        </p>
        <p v-if="heroSaved" class="border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700 sm:col-span-2">
          {{ t('adminHomeSlides.textSaved') }}
        </p>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldTitle') }}</label>
          <input v-model="heroForm.title" type="text" class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldSubtitle') }}</label>
          <input v-model="heroForm.subtitle" type="text" class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldCtaLabel') }}</label>
          <input v-model="heroForm.cta_label" type="text" class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldCtaUrl') }}</label>
          <input v-model="heroForm.cta_url" type="text" class="input-field w-full" placeholder="/organisateur/evenements/nouveau" />
        </div>
        <div class="sm:col-span-2">
          <button type="submit" class="btn-primary" :disabled="heroSaving">
            {{ heroSaving ? t('common.saving') : t('adminHomeSlides.saveText') }}
          </button>
        </div>
      </form>
    </section>

    <!-- Images / gifs par zone -->
    <section v-for="zone in zones" :key="zone.key" class="mb-8 border border-tikeo-border bg-tikeo-surface p-5">
      <div class="mb-4 flex items-center justify-between">
        <div>
          <h2 class="text-sm font-bold text-tikeo-black">{{ zone.label }}</h2>
          <p class="mt-0.5 text-xs text-tikeo-gray-text">{{ zone.hint }}</p>
        </div>
      </div>

      <!-- Formulaire d'ajout : fichier depuis l'ordinateur ou lien externe -->
      <form class="mb-4" @submit.prevent="handleAdd(zone.key)">
        <MediaInput
          v-model="newUrl[zone.key]"
          folder="home-slides"
          :label="t('adminHomeSlides.slideLabel')"
          :placeholder="t('adminHomeSlides.urlPlaceholder')"
        />
        <button type="submit" class="btn-primary mt-3" :disabled="adding[zone.key] || !newUrl[zone.key].trim()">
          {{ adding[zone.key] ? t('common.saving') : t('adminHomeSlides.addButton') }}
        </button>
      </form>
      <p v-if="addError[zone.key]" class="mb-3 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">
        {{ addError[zone.key] }}
      </p>

      <!-- Liste des images -->
      <p v-if="zoneSlides[zone.key].value.length === 0" class="py-4 text-center text-xs text-tikeo-gray-text">
        {{ t('adminHomeSlides.empty') }}
      </p>
      <div v-else class="divide-y divide-tikeo-border">
        <div
          v-for="(slide, idx) in zoneSlides[zone.key].value"
          :key="slide.id"
          class="flex items-center gap-3 py-3"
        >
          <img :src="slide.media_url" alt="" class="h-14 w-20 shrink-0 rounded-none border border-tikeo-border object-cover" />
          <div class="min-w-0 flex-1">
            <p class="truncate text-xs text-tikeo-gray-text">{{ slide.media_url }}</p>
            <span class="mt-1 inline-block px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
              :class="slide.media_type === 'gif' ? 'bg-tikeo-orange/10 text-tikeo-orange' : 'bg-tikeo-gray-light text-tikeo-gray-text'"
            >
              {{ slide.media_type === 'gif' ? t('adminHomeSlides.typeGif') : t('adminHomeSlides.typeImage') }}
            </span>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button
              type="button"
              class="p-1.5 text-tikeo-gray-text hover:text-tikeo-black disabled:opacity-30"
              :disabled="idx === 0"
              :aria-label="t('common.edit')"
              @click="move(slide, -1)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7" /></svg>
            </button>
            <button
              type="button"
              class="p-1.5 text-tikeo-gray-text hover:text-tikeo-black disabled:opacity-30"
              :disabled="idx === zoneSlides[zone.key].value.length - 1"
              :aria-label="t('common.edit')"
              @click="move(slide, 1)"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button
              type="button"
              class="px-2 py-1 text-xs font-medium"
              :class="slide.status === 'active' ? 'text-green-700' : 'text-tikeo-gray-text'"
              @click="toggleStatus(slide)"
            >
              {{ slide.status === 'active' ? t('adminHomeSlides.statusActive') : t('adminHomeSlides.statusInactive') }}
            </button>
            <button type="button" class="p-1.5 text-tikeo-error hover:text-red-700" :aria-label="t('common.delete')" @click="confirmDelete = slide">
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M6 7h12M9 7V4h6v3m-8 0l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13" /></svg>
            </button>
          </div>
        </div>
      </div>
    </section>

    <!-- Confirmation de suppression -->
    <div v-if="confirmDelete" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div class="w-full max-w-sm border border-tikeo-border bg-tikeo-surface p-5">
        <h3 class="text-sm font-bold text-tikeo-black">{{ t('adminHomeSlides.confirmDeleteTitle') }}</h3>
        <p class="mt-2 text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.confirmDeleteMessage') }}</p>
        <div class="mt-4 flex justify-end gap-2">
          <button type="button" class="btn-secondary !px-4 !py-2 !text-xs" @click="confirmDelete = null">{{ t('common.cancel') }}</button>
          <button type="button" class="btn-primary !bg-tikeo-error !px-4 !py-2 !text-xs" @click="performDelete">{{ t('common.delete') }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
