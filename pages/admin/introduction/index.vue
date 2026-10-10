<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin', adminPermission: 'onboarding.manage' })

import type { OnboardingSlide, TourStep, TourTarget } from '~/types/database'
import { useDeviceEngagementState } from '~/composables/useEngagement'

const { t } = useI18n()
const { askConfirm } = useAdminConfirm()
const router = useRouter()
const device = useDeviceEngagementState()

const slidesApi = useAdminEngagementTable<OnboardingSlide>('onboarding_slides')
const stepsApi = useAdminEngagementTable<TourStep>('tour_steps')

const TARGETS: TourTarget[] = ['search', 'publish', 'pricing', 'community', 'notifications', 'favorites', 'account', 'theme', 'language', 'nav-home', 'nav-explore', 'nav-scanner', 'nav-profile', 'nav-settings']

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
  slideDraft.value = { title: '', description: '', icon: 'sparkles', image_url: '', status: 'active' }
}
async function saveSlide() {
  const d = slideDraft.value
  if (!d || !d.title?.trim()) return
  slideSaving.value = true
  const payload = {
    title: d.title.trim(),
    description: d.description?.trim() || null,
    icon: resolveIntroIcon(d.icon),
    emoji: null,
    image_url: d.image_url?.trim() || null,
    status: d.status || 'active',
  }
  const ok = await guarded(() => (d.id ? slidesApi.update(d.id, payload) : slidesApi.create(payload)), t('adminEngagement.saved'))
  slideSaving.value = false
  if (ok) slideDraft.value = null
}
async function removeSlide(s: OnboardingSlide) {
  if (!(await askConfirm({ message: t('adminEngagement.deleteConfirm') }))) return
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
  if (!(await askConfirm({ message: t('adminEngagement.deleteConfirm') }))) return
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
      <button type="button" class="acc-btn-ghost !text-[13px]" :title="t('adminEngagement.testHint')" @click="testOnDevice"><AppIcon name="phone" class="h-[18px] w-[18px]" />{{ t('adminEngagement.testOnDevice') }}</button>
    </div>

    <p v-if="errorMsg" class="acc-alert-error mb-4">{{ errorMsg }}</p>
    <p v-if="message" class="acc-alert-success mb-4">{{ message }}</p>

    <!-- ===================== Pages d'introduction ===================== -->
    <section class="org-panel mb-8 p-5">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 class="text-sm font-bold text-tikeo-black">{{ t('adminEngagement.slidesTitle') }}</h2>
          <p class="mt-1 text-xs text-tikeo-gray-text">{{ t('adminEngagement.slidesHint') }}</p>
        </div>
        <div class="flex gap-2">
          <button type="button" class="acc-btn-ghost !text-[13px]" @click="previewIntro"><AppIcon name="eye" class="h-[18px] w-[18px]" />{{ t('adminEngagement.preview') }}</button>
          <button type="button" class="btn-ink !h-10 !px-4 !text-[13px]" @click="newSlide"><AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.2" />{{ t('adminEngagement.add') }}</button>
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
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldIcon') }}</label>
          <div class="grid grid-cols-6 gap-1.5 sm:grid-cols-8 md:grid-cols-12" role="radiogroup" :aria-label="t('adminEngagement.fieldIcon')">
            <button
              v-for="ic in INTRO_ICONS"
              :key="ic"
              type="button"
              role="radio"
              :aria-checked="resolveIntroIcon(slideDraft.icon) === ic"
              :aria-label="ic"
              :title="ic"
              class="flex h-10 items-center justify-center border transition-colors"
              :class="resolveIntroIcon(slideDraft.icon) === ic ? 'border-tikeo-orange bg-tikeo-orange text-white' : 'border-tikeo-border bg-tikeo-surface text-tikeo-black hover:border-tikeo-orange'"
              @click="slideDraft!.icon = ic"
            >
              <AppIcon :name="ic" class="h-5 w-5" />
            </button>
          </div>
          <p class="mt-1 text-[11px] text-tikeo-gray-text">{{ t('adminEngagement.iconHint') }}</p>
        </div>
        <div class="sm:col-span-2">
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('adminEngagement.fieldStatus') }}</label>
          <select v-model="slideDraft.status" class="input-field w-full sm:max-w-xs">
            <option value="active">{{ t('adminEngagement.active') }}</option>
            <option value="inactive">{{ t('adminEngagement.inactive') }}</option>
          </select>
        </div>
        <div class="sm:col-span-2">
          <MediaInput :model-value="slideDraft.image_url || ''" folder="home-slides" :label="t('adminEngagement.fieldImage')" @update:model-value="slideDraft!.image_url = $event" />
        </div>
        <div class="flex gap-2 sm:col-span-2">
          <button type="submit" class="btn-ink !h-10 !px-4 !text-[13px]" :disabled="slideSaving"><AppIcon name="save" class="h-[18px] w-[18px]" />{{ slideSaving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
          <button type="button" class="acc-btn-ghost !text-[13px]" @click="slideDraft = null"><AppIcon name="close" class="h-[18px] w-[18px]" />{{ t('adminEngagement.cancel') }}</button>
        </div>
      </form>

      <p v-if="!slidesApi.loading.value && !sortedSlides.length" class="mt-4 text-xs text-tikeo-gray-text">{{ t('adminEngagement.empty') }}</p>
      <ul class="mt-4 space-y-2">
        <li v-for="(s, i) in sortedSlides" :key="s.id" class="flex items-center gap-3 border border-tikeo-border p-3" :class="s.status === 'inactive' ? 'opacity-60' : ''">
          <span class="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden bg-tikeo-brand">
            <img v-if="s.image_url" :src="s.image_url" alt="" class="h-full w-full object-cover" />
            <AppIcon v-else :name="resolveIntroIcon(s.icon)" class="h-7 w-7 text-white" />
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold text-tikeo-black">{{ i + 1 }}. {{ s.title }}</p>
            <p v-if="s.description" class="truncate text-xs text-tikeo-gray-text">{{ s.description }}</p>
            <span class="mt-0.5 inline-block text-[10px] font-bold uppercase" :class="s.status === 'active' ? 'text-green-600' : 'text-tikeo-gray-text'">{{ s.status === 'active' ? t('adminEngagement.active') : t('adminEngagement.inactive') }}</span>
          </div>
          <div class="flex shrink-0 items-center gap-1.5">
            <OrgIconButton icon="arrow-up" :label="t('adminEngagement.moveUp')" :disabled="i === 0" @click="guarded(() => slidesApi.move(s, -1))" />
            <OrgIconButton icon="arrow-down" :label="t('adminEngagement.moveDown')" :disabled="i === sortedSlides.length - 1" @click="guarded(() => slidesApi.move(s, 1))" />
            <OrgIconButton icon="edit" :label="t('adminEngagement.edit')" @click="slideDraft = { ...s, image_url: s.image_url || '' }" />
            <OrgIconButton icon="trash" danger :label="t('adminEngagement.delete')" @click="removeSlide(s)" />
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
        <button type="button" class="btn-ink !h-10 !px-4 !text-[13px]" @click="newStep"><AppIcon name="plus" class="h-[18px] w-[18px]" :stroke="2.2" />{{ t('adminEngagement.add') }}</button>
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
          <button type="submit" class="btn-ink !h-10 !px-4 !text-[13px]" :disabled="stepSaving"><AppIcon name="save" class="h-[18px] w-[18px]" />{{ stepSaving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
          <button type="button" class="acc-btn-ghost !text-[13px]" @click="stepDraft = null"><AppIcon name="close" class="h-[18px] w-[18px]" />{{ t('adminEngagement.cancel') }}</button>
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
          <div class="flex shrink-0 items-center gap-1.5">
            <OrgIconButton icon="arrow-up" :label="t('adminEngagement.moveUp')" :disabled="i === 0" @click="guarded(() => stepsApi.move(s, -1))" />
            <OrgIconButton icon="arrow-down" :label="t('adminEngagement.moveDown')" :disabled="i === sortedSteps.length - 1" @click="guarded(() => stepsApi.move(s, 1))" />
            <OrgIconButton icon="edit" :label="t('adminEngagement.edit')" @click="stepDraft = { ...s }" />
            <OrgIconButton icon="trash" danger :label="t('adminEngagement.delete')" @click="removeStep(s)" />
          </div>
        </li>
      </ul>
    </section>

    <OnboardingIntro v-if="previewSlides" :slides="previewSlides" @close="previewSlides = null" />
  </div>
</template>
