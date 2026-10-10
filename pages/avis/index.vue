<script setup lang="ts">
import { FEEDBACK_CATEGORIES, FEEDBACK_CATEGORY_ICONS } from '~/composables/useSiteFeedback'

const { t } = useI18n()
const route = useRoute()
const { csrfHeader } = useCsrf()
const { profile, user } = useAuth()
const { items, stats, loading, fetchWall } = useSiteFeedbackWall()
const relative = useRelativeTime()
const toast = useToast()
const { buzz } = useUiPrefs()
const { token: captchaToken, widget, ready: captchaReady, onVerify, onExpire, reset: resetCaptcha } = useCaptcha()

useSeoMeta({
  title: () => `${t('feedback.pageTitle')} | Tikeo`,
  description: () => t('feedback.pageIntro'),
})

// ------------------------------------------------------------------
// Formulaire
// ------------------------------------------------------------------
const initialRating = Math.min(5, Math.max(0, Number(route.query.rating) || 0))
const form = reactive({
  rating: initialRating,
  category: 'praise' as (typeof FEEDBACK_CATEGORIES)[number],
  message: '',
  displayName: '',
  email: '',
  allowPublic: true,
  website: '',
})
const sending = ref(false)
const sent = ref(false)
const errorMessage = ref('')

// Pré-remplit nom / email pour un compte connecté (modifiable).
watch(
  [profile, user],
  () => {
    if (!form.displayName && profile.value?.full_name) form.displayName = profile.value.full_name.split(' ')[0]
    if (!form.email && user.value?.email) form.email = user.value.email
  },
  { immediate: true }
)

const catLabel = (c: string) => t(`feedback.cat_${c}`)
const MAX = 1000

async function submit() {
  errorMessage.value = ''
  if (!form.rating) {
    errorMessage.value = t('feedback.errorRating')
    return
  }
  if (form.message.trim().length < 5) {
    errorMessage.value = t('feedback.errorMessage')
    return
  }
  if (!form.website && !captchaReady.value) {
    errorMessage.value = t('auth.captchaRequired')
    return
  }
  sending.value = true
  try {
    const headers: Record<string, string> = { ...(await csrfHeader()) }
    try {
      const {
        data: { session },
      } = await useSupabase().auth.getSession()
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`
    } catch {
      /* envoi anonyme */
    }
    await $fetch('/api/feedback', {
      method: 'POST',
      headers,
      body: {
        rating: form.rating,
        category: form.category,
        message: form.message.trim(),
        displayName: form.displayName.trim(),
        email: form.email.trim(),
        allowPublic: form.allowPublic,
        website: form.website,
        captchaToken: captchaToken.value,
      },
    })
    buzz([12, 40, 12])
    sent.value = true
    toast.success(t('feedback.thanksToast'))
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || t('feedback.errorSend')
  } finally {
    sending.value = false
    resetCaptcha()
  }
}

function again() {
  sent.value = false
  form.rating = 0
  form.message = ''
  form.category = 'praise'
}

// ------------------------------------------------------------------
// Mur des avis publiés
// ------------------------------------------------------------------
const filter = ref<string>('all')
const visibleCount = ref(6)
const filtered = computed(() => (filter.value === 'all' ? items.value : items.value.filter((f) => f.category === filter.value)))
const shown = computed(() => filtered.value.slice(0, visibleCount.value))
watch(filter, () => (visibleCount.value = 6))

const dist = computed(() => {
  const s = stats.value
  const total = s?.total || 0
  return [5, 4, 3, 2, 1].map((n) => {
    const c = (s as any)?.[`c${n}`] || 0
    return { n, c, pct: total ? Math.round((c / total) * 100) : 0 }
  })
})

function initial(name: string) {
  return (name.trim()[0] || '?').toUpperCase()
}

onMounted(() => {
  fetchWall()
  if (route.hash === '#donner-mon-avis') {
    setTimeout(() => document.getElementById('donner-mon-avis')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 300)
  }
})
</script>

<template>
  <div class="pb-12 md:pb-20">
    <PageHero :eyebrow="t('feedback.eyebrow')" :title="t('feedback.pageTitle')" :subtitle="t('feedback.pageIntro')" />

    <div class="mx-auto grid max-w-tikeo-container gap-8 px-4 pt-8 md:px-6 md:pt-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <!-- ============ Colonne gauche : note globale + formulaire ============ -->
      <div class="space-y-6 lg:sticky lg:top-24">
        <!-- Note globale -->
        <section class="acc-panel p-5">
          <div v-if="stats && stats.total > 0" class="flex items-center gap-5">
            <div class="text-center">
              <p class="font-display text-5xl font-extrabold leading-none text-tikeo-black">{{ Number(stats.average).toFixed(1) }}</p>
              <StarRating :model-value="Math.round(stats.average)" readonly size="sm" class="mt-2" />
              <p class="mt-1 text-xs font-semibold text-tikeo-gray-text">{{ t('feedback.count', { n: stats.total }) }}</p>
            </div>
            <ul class="min-w-0 flex-1 space-y-1.5" :aria-label="t('feedback.distribution')">
              <li v-for="d in dist" :key="d.n" class="flex items-center gap-2 text-xs font-bold text-tikeo-gray-text">
                <span class="w-3 text-right tabular-nums">{{ d.n }}</span>
                <span class="h-2 flex-1 bg-tikeo-surface-alt"><span class="block h-full bg-[#FF7A00] transition-all duration-700" :style="{ width: `${d.pct}%` }" /></span>
                <span class="w-7 text-right tabular-nums">{{ d.c }}</span>
              </li>
            </ul>
          </div>
          <p v-else class="text-sm text-tikeo-gray-text">{{ t('feedback.beFirst') }}</p>
        </section>

        <!-- Formulaire -->
        <section id="donner-mon-avis" class="acc-panel scroll-mt-24">
          <div class="flex items-center gap-3 border-b border-tikeo-border px-5 py-4">
            <span class="flex h-10 w-10 shrink-0 items-center justify-center bg-[#FF7A00] text-tikeo-ink"><AppIcon name="star" class="h-5 w-5" /></span>
            <h2 class="font-display text-lg font-extrabold tracking-tight text-tikeo-black">{{ t('feedback.formTitle') }}</h2>
          </div>

          <div v-if="sent" class="p-6 text-center">
            <span class="tk-pop mx-auto flex h-14 w-14 items-center justify-center bg-tikeo-success text-white"><AppIcon name="check" class="h-7 w-7" :stroke="3" /></span>
            <h3 class="mt-4 font-display text-xl font-extrabold text-tikeo-black">{{ t('feedback.thanksTitle') }}</h3>
            <p class="mx-auto mt-2 max-w-xs text-sm text-tikeo-gray-text">{{ form.allowPublic ? t('feedback.thanksPublic') : t('feedback.thanksText') }}</p>
            <button type="button" class="acc-btn-ghost mt-5" @click="again">{{ t('feedback.sendAnother') }}</button>
          </div>

          <form v-else class="space-y-5 p-5" @submit.prevent="submit">
            <p v-if="errorMessage" class="acc-alert-error" role="alert">{{ errorMessage }}</p>

            <div>
              <p class="acc-label mb-2">{{ t('feedback.yourRating') }}</p>
              <div class="flex flex-wrap items-center gap-3">
                <StarRating v-model="form.rating" size="lg" />
                <span class="min-h-[1.25rem] text-sm font-bold text-tikeo-black">{{ form.rating ? t(`feedback.rating${form.rating}`) : '' }}</span>
              </div>
            </div>

            <div>
              <p class="acc-label mb-2">{{ t('feedback.aboutLabel') }}</p>
              <div class="flex flex-wrap gap-2" role="radiogroup" :aria-label="t('feedback.aboutLabel')">
                <button
                  v-for="c in FEEDBACK_CATEGORIES"
                  :key="c"
                  type="button"
                  role="radio"
                  :aria-checked="form.category === c"
                  class="flex h-9 items-center gap-1.5 border px-3 text-[13px] font-bold transition-all duration-200 active:scale-95"
                  :class="form.category === c ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border text-tikeo-black hover:-translate-y-0.5 hover:border-[#FF7A00]'"
                  @click="form.category = c"
                >
                  <AppIcon :name="FEEDBACK_CATEGORY_ICONS[c]" class="h-4 w-4" />
                  {{ catLabel(c) }}
                </button>
              </div>
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label for="fb-message" class="acc-label">{{ t('feedback.messageLabel') }}</label>
                <span class="text-xs font-semibold tabular-nums" :class="form.message.length > MAX - 50 ? 'text-tikeo-error' : 'text-tikeo-gray-text'">{{ form.message.length }}/{{ MAX }}</span>
              </div>
              <textarea id="fb-message" v-model="form.message" rows="4" :maxlength="MAX" required class="input-field resize-none" :placeholder="t(`feedback.placeholder_${form.category}`)" />
            </div>

            <div class="grid gap-4 sm:grid-cols-2">
              <div>
                <label for="fb-name" class="acc-label mb-1.5 block">{{ t('feedback.nameLabel') }}</label>
                <input id="fb-name" v-model="form.displayName" type="text" maxlength="60" class="input-field !h-11" :placeholder="t('feedback.namePlaceholder')" />
              </div>
              <div>
                <label for="fb-email" class="acc-label mb-1.5 block">{{ t('feedback.emailLabel') }}</label>
                <input id="fb-email" v-model="form.email" type="email" class="input-field !h-11" placeholder="vous@exemple.com" />
              </div>
            </div>
            <p class="-mt-2 text-xs text-tikeo-gray-text">{{ t('feedback.emailHelp') }}</p>

            <label class="flex cursor-pointer items-start gap-3 border border-dashed px-3.5 py-3 transition-colors" :class="form.allowPublic ? 'border-[#FF7A00] bg-[#FF7A00]/5' : 'border-tikeo-border'">
              <input v-model="form.allowPublic" type="checkbox" class="mt-1 h-4 w-4 shrink-0 accent-[#FF7A00]" />
              <span class="text-sm text-tikeo-black"><span class="font-semibold">{{ t('feedback.publicLabel') }}</span><span class="block text-xs text-tikeo-gray-text">{{ t('feedback.publicHelp') }}</span></span>
            </label>

            <!-- Honeypot -->
            <div class="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
              <label for="fb-website">Site web</label>
              <input id="fb-website" v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
            </div>

            <TurnstileWidget ref="widget" @verify="onVerify" @expire="onExpire" />

            <button type="submit" class="btn-ink !h-12 w-full disabled:opacity-60" :disabled="sending">
              <TikeoSpinner v-if="sending" :size="18" />
              {{ sending ? t('feedback.sending') : t('feedback.send') }}
            </button>
          </form>
        </section>
      </div>

      <!-- ============ Colonne droite : mur des avis ============ -->
      <section class="min-w-0">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
          <h2 class="font-display text-2xl font-extrabold tracking-tight text-tikeo-black">{{ t('feedback.wallTitle') }}</h2>
          <div class="no-scrollbar flex gap-2 overflow-x-auto" role="group" :aria-label="t('feedback.wallTitle')">
            <button
              v-for="c in ['all', ...FEEDBACK_CATEGORIES]"
              :key="c"
              type="button"
              class="h-9 shrink-0 border px-3 text-[13px] font-bold transition-colors"
              :class="filter === c ? 'border-tikeo-ink bg-tikeo-ink text-white dark:border-[#FF7A00] dark:bg-[#FF7A00] dark:text-tikeo-ink' : 'border-tikeo-border text-tikeo-black hover:border-tikeo-ink dark:hover:border-[#FF7A00]'"
              :aria-pressed="filter === c"
              @click="filter = c"
            >
              {{ c === 'all' ? t('feedback.filterAll') : catLabel(c) }}
            </button>
          </div>
        </div>

        <div v-if="loading && !items.length" class="space-y-3">
          <div v-for="i in 3" :key="i" class="h-32 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
        </div>
        <div v-else-if="!shown.length" class="acc-empty">{{ t('feedback.wallEmpty') }}</div>
        <ul v-else class="space-y-3">
          <li v-for="f in shown" :key="f.id" class="acc-panel p-4 md:p-5">
            <div class="flex items-start gap-3">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center bg-tikeo-ink font-display text-lg font-extrabold text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ initial(f.display_name) }}</span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <p class="font-bold text-tikeo-black">{{ f.display_name }}</p>
                  <StarRating :model-value="f.rating" readonly size="sm" />
                  <span class="acc-tag bg-tikeo-surface-alt text-tikeo-gray-text">{{ catLabel(f.category) }}</span>
                </div>
                <p class="text-xs text-tikeo-gray-text">{{ relative(f.created_at) }}</p>
                <p class="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-tikeo-black">{{ f.message }}</p>
                <div v-if="f.admin_reply" class="mt-3 border-l-4 border-[#FF7A00] bg-tikeo-surface-alt px-4 py-3">
                  <p class="flex items-center gap-1.5 text-xs font-bold text-tikeo-black"><AppIcon name="reply" class="h-3.5 w-3.5" />{{ t('feedback.teamReply') }}</p>
                  <p class="mt-1 whitespace-pre-wrap text-sm text-tikeo-gray-text">{{ f.admin_reply }}</p>
                </div>
              </div>
            </div>
          </li>
        </ul>
        <div v-if="filtered.length > visibleCount" class="mt-5 text-center">
          <button type="button" class="acc-btn-ghost" @click="visibleCount += 6">{{ t('feedback.loadMore') }}</button>
        </div>
      </section>
    </div>
  </div>
</template>
