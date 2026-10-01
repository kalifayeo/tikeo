<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'onboarding.manage' })

import type { OnboardingSlide, TourStep, TourTarget } from '~/types/database'
import { useDeviceEngagementState } from '~/composables/useEngagement'

const { t } = useI18n()
const router = useRouter()
const device = useDeviceEngagementState()

const slidesApi = useAdminEngagementTable<OnboardingSlide>('onboarding_slides')
const stepsApi = useAdminEngagementTable<TourStep>('tour_steps')

const TARGETS: TourTarget[] = ['search', 'publish', 'pricing', 'community', 'notifications', 'favorites', 'account', 'theme', 'language']

const sortedSlides = computed(() => [...slidesApi.items.value].sort((a, b) => a.position - b.position))
const sortedSteps = computed(() => [...stepsApi.items.value].sort((a, b) => a.position - b.position))

const message = ref('')
const errorMsg = ref('')
function flash(ok: string) {
  errorMsg.value = ''
  message.value = ok
  setTimeout(() => (message.value = ''), 2500)
}
async function guarded(fn: () => Promise<unknown>, ok?: string) {
  errorMsg.value = ''
  try {
    await fn()
    if (ok) flash(ok)
    return true
  } catch (e: any) {
    errorMsg.value = e?.message || t('adminEngagement.error')
    return false
  }
}

// --- Pages d'introduction -------------------------------------------------
const slideDraft = ref<Partial<OnboardingSlide> | null>(null)
const slideSaving = ref(false)

function newSlide() {
  slideDraft.value = { title: '', description: '', emoji: '✨', image_url: '', status: 'active' }
}
async function saveSlide() {
  const d = slideDraft.value
  if (!d || !d.title?.trim()) return
  slideSaving.value = true
  const payload = {
    title: d.title.trim(),
    description: d.description?.trim() || null,
    emoji: d.emoji?.trim() || null,
    image_url: d.image_url?.trim() || null,
    status: d.status || 'active',
  }
  const ok = await guarded(() => (d.id ? slidesApi.update(d.id, payload) : slidesApi.create(payload)), t('adminEngagement.saved'))
  slideSaving.value = false
  if (ok) slideDraft.value = null
}
async function removeSlide(s: OnboardingSlide) {
  if (!confirm(t('adminEngagement.deleteConfirm'))) return
  await guarded(() => slidesApi.remove(s.id))
}

// --- Étapes de la visite guidée ------------------------------------------
const stepDraft = ref<Partial<TourStep> | null>(null)
const stepSaving = ref(false)

function newStep() {
  stepDraft.value = { target: 'search', title: '', description: '', status: 'active' }
}
async function saveStep() {
  const d = stepDraft.value
  if (!d || !d.title?.trim() || !d.target) return
  stepSaving.value = true
  const payload = { target: d.target, title: d.title.trim(), description: d.description?.trim() || null, status: d.status || 'active' }
  const ok = await guarded(() => (d.id ? stepsApi.update(d.id, payload) : stepsApi.create(payload)), t('adminEngagement.saved'))
  stepSaving.value = false
  if (ok) stepDraft.value = null
}
async function removeStep(s: TourStep) {
  if (!confirm(t('adminEngagement.deleteConfirm'))) return
  await guarded(() => stepsApi.remove(s.id))
}

// --- Aperçu / test ---------------------------------------------------------
const previewSlides = ref<OnboardingSlide[] | null>(null)
function previewIntro() {
  const list = sortedSlides.value.filter((s) => s.status === 'active')
  previewSlides.value = list.length ? list : null
  if (!list.length) errorMsg.value = t('adminEngagement.nothingToPreview')
}
function testOnDevice() {
  device.resetOnboarding()
  router.push('/')
}
</script>

<template>
  <div class="mx-auto max-w-5xl px-4 py-8 md:px-6">
    <div class="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('adminEngagement.introTitle') }}</h1>
        <p class="mt-1 text-sm text-tikeo-gray-text">{{ t('adminEngagement.introSubtitle') }}</p>
      </div>
      <button type="button" class="btn-secondary !py-2 text-xs" :title="t('adminEngagement.testHint')" @click="testOnDevice">
        ▶ {{ t('adminEngagement.testOnDevice') }}
      </button>
    </div>

    <p v-if="errorMsg" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ errorMsg }}</p>
    <p v-if="message" class="mb-4 border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">{{ message }}</p>

    <!-- ===================== Pages d'introduction ===================== -->
    <section class="mb-8 border border-tikeo-border bg-tikeo-surface p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminEngagement.slidesTitle') }}</h2>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminEngagement.slidesHint') }}</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary !py-2 text-xs" @click="previewIntro">👁 {{ t('adminEngagement.preview') }}</button>
          <button type="button" class="btn-primary !py-2 text-xs" @click="newSlide">+ {{ t('adminEngagement.add') }}</button>
        </div>
      </div>

      <form v-if="slideDraft" class="mt-4 grid gap-3 border border-tikeo-orange/40 bg-tikeo-orange/5 p-4 sm:grid-cols-2" @submit.prevent="saveSlide">
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldTitle') }}</label>
          <input v-model="slideDraft.title" type="text" maxlength="120" required class="input-field w-full" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldDescription') }}</label>
          <textarea v-model="slideDraft.description" rows="3" maxlength="500" class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldEmoji') }}</label>
          <input v-model="slideDraft.emoji" type="text" maxlength="8" class="input-field w-full" />
          <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminEngagement.emojiHint') }}</p>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldStatus') }}</label>
          <select v-model="slideDraft.status" class="input-field w-full">
            <option value="active">{{ t('adminEngagement.active') }}</option>
            <option value="inactive">{{ t('adminEngagement.inactive') }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <MediaInput :model-value="slideDraft.image_url || ''" folder="home-slides" :label="t('adminEngagement.fieldImage')" @update:model-value="slideDraft!.image_url = $event" />
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" class="btn-primary !py-2 text-xs" :disabled="slideSaving">{{ slideSaving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
          <button type="button" class="btn-secondary !py-2 text-xs" @click="slideDraft = null">{{ t('adminEngagement.cancel') }}</button>
        </div>
      </form>

      <p v-if="!slidesApi.loading.value && !sortedSlides.length" class="mt-4 text-xs text-tikeo-gray-text">{{ t('adminEngagement.empty') }}</p>
      <ul class="mt-4 space-y-2">
        <li v-for="(s, i) in sortedSlides" :key="s.id" class="flex items-center gap-3 border border-tikeo-border p-3" :class="s.status === 'inactive' ? 'opacity-60' : ''">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-tikeo-brand text-2xl">
            <img v-if="s.image_url" :src="s.image_url" alt="" class="h-full w-full object-cover" />
            <template v-else>{{ s.emoji || '🎟️' }}</template>
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ i + 1 }}. {{ s.title }}</p>
            <p v-if="s.description" class="truncate text-xs text-tikeo-gray-text">{{ s.description }}</p>
            <span class="mt-0.5 inline-block text-[10px] font-bold uppercase" :class="s.status === 'active' ? 'text-green-600' : 'text-tikeo-gray-text'">{{ s.status === 'active' ? t('adminEngagement.active') : t('adminEngagement.inactive') }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs disabled:opacity-30" :disabled="i === 0" :aria-label="t('adminEngagement.moveUp')" @click="guarded(() => slidesApi.move(s, -1))">↑</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs disabled:opacity-30" :disabled="i === sortedSlides.length - 1" :aria-label="t('adminEngagement.moveDown')" @click="guarded(() => slidesApi.move(s, 1))">↓</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="slideDraft = { ...s, image_url: s.image_url || '' }">{{ t('adminEngagement.edit') }}</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error" @click="removeSlide(s)">{{ t('adminEngagement.delete') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- ===================== Visite guidée du header ===================== -->
    <section class="border border-tikeo-border bg-tikeo-surface p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminEngagement.stepsTitle') }}</h2>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminEngagement.stepsHint') }}</p>
        </div>
        <button type="button" class="btn-primary !py-2 text-xs" @click="newStep">+ {{ t('adminEngagement.add') }}</button>
      </div>

      <form v-if="stepDraft" class="mt-4 grid gap-3 border border-tikeo-orange/40 bg-tikeo-orange/5 p-4 sm:grid-cols-2" @submit.prevent="saveStep">
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldTarget') }}</label>
          <select v-model="stepDraft.target" class="input-field w-full">
            <option v-for="k in TARGETS" :key="k" :value="k">{{ t(`adminEngagement.targets.${k}`) }}</option>
          </select>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldStatus') }}</label>
          <select v-model="stepDraft.status" class="input-field w-full">
            <option value="active">{{ t('adminEngagement.active') }}</option>
            <option value="inactive">{{ t('adminEngagement.inactive') }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldTitle') }}</label>
          <input v-model="stepDraft.title" type="text" maxlength="80" required class="input-field w-full" />
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldDescription') }}</label>
          <textarea v-model="stepDraft.description" rows="2" maxlength="300" class="input-field w-full" />
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" class="btn-primary !py-2 text-xs" :disabled="stepSaving">{{ stepSaving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
          <button type="button" class="btn-secondary !py-2 text-xs" @click="stepDraft = null">{{ t('adminEngagement.cancel') }}</button>
        </div>
      </form>

      <p v-if="!stepsApi.loading.value && !sortedSteps.length" class="mt-4 text-xs text-tikeo-gray-text">{{ t('adminEngagement.empty') }}</p>
      <ul class="mt-4 space-y-2">
        <li v-for="(s, i) in sortedSteps" :key="s.id" class="flex items-center gap-3 border border-tikeo-border p-3" :class="s.status === 'inactive' ? 'opacity-60' : ''">
          <span class="flex h-8 w-8 shrink-0 items-center justify-center bg-tikeo-orange text-xs font-bold text-white">{{ i + 1 }}</span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ s.title }}</p>
            <p class="truncate text-xs text-tikeo-gray-text">
              <span class="font-semibold text-tikeo-orange">{{ t(`adminEngagement.targets.${s.target}`) }}</span>
              <span v-if="s.description"> — {{ s.description }}</span>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs disabled:opacity-30" :disabled="i === 0" :aria-label="t('adminEngagement.moveUp')" @click="guarded(() => stepsApi.move(s, -1))">↑</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs disabled:opacity-30" :disabled="i === sortedSteps.length - 1" :aria-label="t('adminEngagement.moveDown')" @click="guarded(() => stepsApi.move(s, 1))">↓</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="stepDraft = { ...s }">{{ t('adminEngagement.edit') }}</button>
            <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error" @click="removeStep(s)">{{ t('adminEngagement.delete') }}</button>
          </div>
        </li>
      </ul>
    </section>

    <OnboardingIntro v-if="previewSlides" :slides="previewSlides" @close="previewSlides = null" />
  </div>
</template>
