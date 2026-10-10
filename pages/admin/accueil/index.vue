<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'marketing.manage' })
import { guessMediaType } from '~/composables/useHomeSlides'
import type { HomeSlide } from '~/types/database'

const { t } = useI18n()

// --- Texte de la bannière centrale ---
const { content: heroContent, loading: heroLoading, saveContent } = useAdminHeroContent()
const heroForm = reactive({ title: '', subtitle: '', cta_label: '', cta_url: '', video_url: '' })
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
    heroForm.video_url = c.presentation_video_url || ''
  },
  { immediate: true }
)

// Lien de vidéo : https:// obligatoire (ou chemin du site /videos/…).
const videoUrlValid = computed(() => {
  const v = heroForm.video_url.trim()
  return !v || /^https?:\/\//i.test(v) || (v.startsWith('/') && !v.startsWith('//'))
})

async function handleSaveHero() {
  heroError.value = ''
  heroSaved.value = false
  const video = heroForm.video_url.trim()
  if (video && !videoUrlValid.value) {
    heroError.value = t('adminHomeSlides.videoUrlInvalid')
    return
  }
  heroSaving.value = true
  try {
    await saveContent({
      title: heroForm.title.trim() || null,
      subtitle: heroForm.subtitle.trim() || null,
      cta_label: heroForm.cta_label.trim() || null,
      cta_url: heroForm.cta_url.trim() || null,
      // N'envoyé que s'il change : le texte reste enregistrable même si la
      // migration 0045 n'a pas encore été exécutée.
      ...(video !== (heroContent.value?.presentation_video_url || '') ? { presentation_video_url: video || null } : {}),
    })
    heroSaved.value = true
    setTimeout(() => (heroSaved.value = false), 3000)
  } catch (e: any) {
    heroError.value = e?.message || t('adminHomeSlides.errorSave')
  } finally {
    heroSaving.value = false
  }
}

// --- Diaporama unique ---
// Le hero de l'accueil fusionne les anciennes zones (centre, gauche, droite)
// dans un seul diaporama : l'admin gère donc une seule liste, dans l'ordre
// exact où les images défilent.
const FALLBACK_IMAGE = '/sample-event.jpg'
const { slideshow, loading: slidesLoading, createSlide, updateSlide, deleteSlide, moveInSlideshow } = useAdminHomeSlides()

const activeSlides = computed(() => slideshow.value.filter((s) => s.status === 'active'))

const newUrl = ref('')
const adding = ref(false)
const addError = ref('')
const listError = ref('')

async function handleAdd() {
  addError.value = ''
  const url = newUrl.value.trim()
  if (!url) return
  adding.value = true
  try {
    const created = await createSlide({ zone: 'center', media_url: url, media_type: guessMediaType(url), status: 'active' })
    previewId.value = created.id
    newUrl.value = ''
  } catch (e: any) {
    addError.value = e?.message || t('adminHomeSlides.errorSave')
  } finally {
    adding.value = false
  }
}

async function safely(action: () => Promise<unknown>) {
  listError.value = ''
  try {
    await action()
  } catch (e: any) {
    listError.value = e?.message || t('adminHomeSlides.errorSave')
  }
}

const toggleStatus = (slide: HomeSlide) => safely(() => updateSlide(slide.id, { status: slide.status === 'active' ? 'inactive' : 'active' }))
const move = (slide: HomeSlide, dir: -1 | 1) => safely(() => moveInSlideshow(slide, dir))

const confirmDelete = ref<HomeSlide | null>(null)
async function performDelete() {
  const target = confirmDelete.value
  if (!target) return
  await safely(() => deleteSlide(target.id))
  if (previewId.value === target.id) previewId.value = null
  confirmDelete.value = null
}

// --- Aperçu en direct (même esprit que HeroSection : image à cadre orange décalé, perforation, texte sur fond encre) ---
const previewId = ref<string | null>(null)
const previewSlide = computed(() => slideshow.value.find((s) => s.id === previewId.value) ?? activeSlides.value[0] ?? null)
const previewSrc = computed(() => previewSlide.value?.media_url || FALLBACK_IMAGE)
const previewIndex = computed(() => Math.max(0, slideshow.value.findIndex((s) => s.id === previewSlide.value?.id)))
const previewCounter = computed(() => {
  const total = slideshow.value.length
  return total ? `${String(previewIndex.value + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}` : ''
})

const shownTitle = computed(() => heroForm.title.trim() || t('hero.title'))
const shownSubtitle = computed(() => heroForm.subtitle.trim() || t('hero.subtitle'))
const shownCtaLabel = computed(() => heroForm.cta_label.trim() || t('hero.cta'))

const textDirty = computed(() => {
  const c = heroContent.value
  return (
    heroForm.title !== (c?.title || '') ||
    heroForm.subtitle !== (c?.subtitle || '') ||
    heroForm.cta_label !== (c?.cta_label || '') ||
    heroForm.cta_url !== (c?.cta_url || '') ||
    heroForm.video_url !== (c?.presentation_video_url || '')
  )
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminHomeSlides.title') }}</h1>
        <p class="mt-1 max-w-2xl text-sm text-tikeo-gray-text">{{ t('adminHomeSlides.subtitle') }}</p>
      </div>
      <NuxtLink to="/" target="_blank" class="acc-btn-ghost !text-[13px]">
        <AppIcon name="eye" class="h-[18px] w-[18px]" />{{ t('adminHomeSlides.viewHome') }}
      </NuxtLink>
    </div>

    <div class="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <!-- ===================== Colonne de gauche : réglages ===================== -->
      <div class="min-w-0 space-y-6">
        <!-- Texte de la bannière -->
        <section class="org-panel p-5">
          <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminHomeSlides.textSectionTitle') }}</h2>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.textSectionSubtitle') }}</p>

          <form v-if="!heroLoading" class="mt-4 grid gap-3 sm:grid-cols-2" @submit.prevent="handleSaveHero">
            <p v-if="heroError" class="acc-alert-error !text-xs sm:col-span-2">{{ heroError }}</p>
            <p v-if="heroSaved" class="acc-alert-success !text-xs sm:col-span-2">{{ t('adminHomeSlides.textSaved') }}</p>

            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldTitle') }}</label>
              <input v-model="heroForm.title" type="text" class="input-field w-full" :placeholder="t('hero.title')" />
              <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminHomeSlides.emptyFieldHint', { value: t('hero.title') }) }}</p>
            </div>
            <div class="sm:col-span-2">
              <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldSubtitle') }}</label>
              <input v-model="heroForm.subtitle" type="text" class="input-field w-full" :placeholder="t('hero.subtitle')" />
              <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminHomeSlides.emptyFieldHint', { value: t('hero.subtitle') }) }}</p>
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldCtaLabel') }}</label>
              <input v-model="heroForm.cta_label" type="text" class="input-field w-full" :placeholder="t('hero.cta')" />
            </div>
            <div>
              <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldCtaUrl') }}</label>
              <input v-model="heroForm.cta_url" type="text" class="input-field w-full" placeholder="/organisateur/evenements/nouveau" />
            </div>

            <!-- Vidéo de présentation (bouton « Voir la vidéo ») -->
            <div class="mt-1 border-t border-tikeo-border pt-4 sm:col-span-2">
              <h3 class="flex items-center gap-2 text-sm font-bold text-tikeo-black">
                <svg class="h-4 w-4 text-tikeo-orange" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 001.5.86l10.5-6.5a1 1 0 000-1.72L9.5 4.64A1 1 0 008 5.5z" /></svg>
                {{ t('adminHomeSlides.videoSectionTitle') }}
              </h3>
              <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.videoSectionHint') }}</p>
              <label class="mb-1 mt-3 block text-xs font-medium text-tikeo-gray-text">{{ t('adminHomeSlides.fieldVideoUrl') }}</label>
              <input
                v-model="heroForm.video_url"
                type="url"
                inputmode="url"
                class="input-field w-full"
                :class="videoUrlValid ? '' : '!border-red-500'"
                :placeholder="t('adminHomeSlides.videoUrlPlaceholder')"
              />
              <p v-if="!videoUrlValid" class="mt-1 text-[11px] font-semibold text-red-600">{{ t('adminHomeSlides.videoUrlInvalid') }}</p>
            </div>

            <div class="flex flex-wrap items-center gap-3 sm:col-span-2">
              <button type="submit" class="btn-ink disabled:opacity-60" :disabled="heroSaving || !textDirty">
                <AppIcon name="save" class="h-[18px] w-[18px]" />{{ heroSaving ? t('common.saving') : t('adminHomeSlides.saveText') }}
              </button>
              <span v-if="textDirty" class="text-xs font-semibold text-tikeo-orange">{{ t('adminHomeSlides.previewUnsaved') }}</span>
            </div>
          </form>
          <div v-else class="mt-4 h-40 animate-pulse bg-tikeo-border" />
        </section>

        <!-- Diaporama -->
        <section class="org-panel p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminHomeSlides.slideshowTitle') }}</h2>
              <p class="mt-1 max-w-xl text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.slideshowHint') }}</p>
            </div>
            <span v-if="slideshow.length" class="shrink-0 border border-tikeo-border px-2.5 py-1 text-[11px] font-bold text-tikeo-black">
              {{ t('adminHomeSlides.slideshowCount', { total: slideshow.length, active: activeSlides.length }) }}
            </span>
          </div>

          <!-- Ajout : fichier depuis l'ordinateur ou lien externe -->
          <form class="mt-4 border border-dashed border-tikeo-border p-4" @submit.prevent="handleAdd">
            <MediaInput
              v-model="newUrl"
              folder="home-slides"
              :label="t('adminHomeSlides.slideLabel')"
              :placeholder="t('adminHomeSlides.urlPlaceholder')"
            />
            <p class="mt-1.5 text-[11px] text-tikeo-gray-text">{{ t('adminHomeSlides.addHint') }}</p>
            <button type="submit" class="btn-ink mt-3 disabled:opacity-60" :disabled="adding || !newUrl.trim()">
              <AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.2" />{{ adding ? t('common.saving') : t('adminHomeSlides.addButton') }}
            </button>
          </form>
          <p v-if="addError" class="acc-alert-error mt-3 !text-xs">{{ addError }}</p>
          <p v-if="listError" class="acc-alert-error mt-3 !text-xs">{{ listError }}</p>

          <!-- Liste unique, dans l'ordre de défilement -->
          <div class="mt-4">
            <div v-if="slidesLoading" class="space-y-2">
              <div v-for="i in 3" :key="i" class="h-20 animate-pulse bg-tikeo-border" />
            </div>
            <AdminEmpty v-else-if="slideshow.length === 0" icon="image" :text="t('adminHomeSlides.empty')" />
            <template v-else>
              <p v-if="activeSlides.length === 1" class="mb-3 text-xs text-tikeo-gray-text">{{ t('adminHomeSlides.slideshowOne') }}</p>
              <ul class="space-y-2">
                <li
                  v-for="(slide, idx) in slideshow"
                  :key="slide.id"
                  class="flex items-center gap-3 border p-3 transition-colors"
                  :class="[
                    slide.id === previewSlide?.id ? 'border-tikeo-orange bg-tikeo-orange/5' : 'border-tikeo-border',
                    slide.status === 'inactive' ? 'opacity-60' : '',
                  ]"
                >
                  <button
                    type="button"
                    class="group relative shrink-0 overflow-hidden border border-tikeo-border"
                    :title="t('adminHomeSlides.preview')"
                    :aria-label="t('adminHomeSlides.preview')"
                    @click="previewId = slide.id"
                  >
                    <img :src="slide.media_url" alt="" class="h-14 w-24 object-cover" loading="lazy" />
                    <span class="absolute left-0 top-0 bg-tikeo-ink px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white">{{ String(idx + 1).padStart(2, '0') }}</span>
                  </button>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold text-tikeo-black">{{ t('adminHomeSlides.slideNumber', { n: idx + 1 }) }}</p>
                    <p class="truncate text-xs text-tikeo-gray-text">{{ slide.media_url }}</p>
                    <div class="mt-1 flex flex-wrap items-center gap-1.5">
                      <StatusPill :tone="slide.media_type === 'gif' ? 'warning' : 'neutral'">{{ slide.media_type === 'gif' ? t('adminHomeSlides.typeGif') : t('adminHomeSlides.typeImage') }}</StatusPill>
                      <StatusPill :tone="slide.status === 'active' ? 'success' : 'neutral'">{{ slide.status === 'active' ? t('adminHomeSlides.statusActive') : t('adminHomeSlides.statusInactive') }}</StatusPill>
                    </div>
                  </div>
                  <div class="flex shrink-0 items-center gap-1.5">
                    <OrgIconButton icon="arrow-up" :label="t('adminCommon.moveUp')" :disabled="idx === 0" @click="move(slide, -1)" />
                    <OrgIconButton icon="arrow-down" :label="t('adminCommon.moveDown')" :disabled="idx === slideshow.length - 1" @click="move(slide, 1)" />
                    <OrgIconButton :icon="slide.status === 'active' ? 'pause' : 'play'" :label="slide.status === 'active' ? t('adminHomeSlides.statusActive') : t('adminHomeSlides.statusInactive')" @click="toggleStatus(slide)" />
                    <OrgIconButton icon="trash" danger :label="t('common.delete')" @click="confirmDelete = slide" />
                  </div>
                </li>
              </ul>
            </template>
          </div>
        </section>
      </div>

      <!-- ===================== Colonne de droite : aperçu en direct ===================== -->
      <aside class="lg:sticky lg:top-6">
        <div class="mb-2 flex items-center justify-between gap-2">
          <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminHomeSlides.previewTitle') }}</h2>
          <span v-if="textDirty" class="text-[11px] font-semibold text-tikeo-orange">{{ t('adminHomeSlides.previewUnsaved') }}</span>
        </div>

        <div class="relative isolate overflow-hidden bg-tikeo-ink p-4 text-white">
          <!-- Lueurs de marque, comme sur l'accueil -->
          <div class="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div class="absolute -right-24 -top-28 h-64 w-64 rounded-full bg-[#FF7A00]/20 blur-[80px]" />
            <div class="absolute -bottom-32 left-0 h-60 w-60 rounded-full bg-[#0057B8]/35 blur-[90px]" />
          </div>

          <!-- Visuel : cadre orange décalé + perforation de billet -->
          <div class="relative mb-3 mr-3">
            <div class="pointer-events-none absolute -bottom-2.5 -right-2.5 h-full w-full border-2 border-[#FF7A00]/70" aria-hidden="true" />
            <div class="relative aspect-[16/10] overflow-hidden bg-tikeo-ink-soft shadow-[0_24px_48px_-22px_rgba(0,0,0,0.7)]">
              <img :key="previewSrc" :src="previewSrc" alt="" class="absolute inset-0 h-full w-full object-cover" />
              <div
                class="pointer-events-none absolute inset-y-0 left-0 w-2"
                style="background-image: radial-gradient(circle at 0 10px, #0E2240 4.5px, transparent 5px); background-size: 8px 20px"
                aria-hidden="true"
              />
              <div class="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/70 to-transparent" aria-hidden="true" />
              <div v-if="slideshow.length > 1" class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 px-3 pb-2.5">
                <div class="flex min-w-0 flex-1 items-center gap-1">
                  <span
                    v-for="(s, i) in slideshow"
                    :key="s.id"
                    class="block h-[3px] max-w-[2rem] flex-1"
                    :class="i === previewIndex ? 'bg-[#FF7A00]' : 'bg-white/35'"
                  />
                </div>
                <span class="text-[10px] font-bold tabular-nums tracking-wider text-white/85">{{ previewCounter }}</span>
              </div>
            </div>
          </div>
          <p v-if="!previewSlide" class="mb-3 text-[11px] font-semibold text-[#FF9A3D]">{{ t('adminHomeSlides.previewFallback') }}</p>

          <!-- Texte -->
          <h3 class="font-display text-[1.7rem] font-extrabold leading-[1] tracking-[-0.03em]" style="text-wrap: balance">{{ shownTitle }}</h3>
          <p class="mt-2 text-[13px] leading-relaxed text-white/75">{{ shownSubtitle }}</p>

          <!-- Recherche rapide (maquette) -->
          <div class="relative mt-4 border border-white/15 bg-white/[0.07] px-4 py-3">
            <span class="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#FF7A00] to-[#0057B8]" aria-hidden="true" />
            <div class="flex items-center justify-between">
              <span class="font-display text-sm font-extrabold">{{ t('hero.finderTitle') }}</span>
              <AppIcon name="ticket" class="h-5 w-5 text-[#FF9A3D]" />
            </div>
            <div class="mt-2.5 flex gap-2">
              <span class="h-8 flex-1 border border-white/20 bg-tikeo-ink-soft" />
              <span class="flex h-8 w-9 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="search" class="h-4 w-4" :stroke="2.4" /></span>
            </div>
          </div>

          <!-- Bouton + réassurance -->
          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <span class="inline-flex h-9 items-center gap-1.5 border border-white/30 px-3.5 text-xs font-bold">
              <AppIcon name="plus" class="h-3.5 w-3.5" :stroke="2.6" />{{ shownCtaLabel }}
            </span>
            <span class="flex items-center gap-1 text-[11px] font-semibold text-white/70"><AppIcon name="qr" class="h-3.5 w-3.5 text-[#FF9A3D]" />{{ t('hero.trustQr') }}</span>
          </div>
        </div>

        <p class="mt-2 text-[11px] leading-relaxed text-tikeo-gray-text">{{ t('adminHomeSlides.previewHint') }}</p>
      </aside>
    </div>

    <!-- Confirmation de suppression -->
    <ConfirmDeleteModal
      :open="!!confirmDelete"
      :title="t('adminHomeSlides.confirmDeleteTitle')"
      :message="t('adminHomeSlides.confirmDeleteMessage')"
      :confirm-label="t('common.delete')"
      @confirm="performDelete"
      @cancel="confirmDelete = null"
    />
  </div>
</template>
