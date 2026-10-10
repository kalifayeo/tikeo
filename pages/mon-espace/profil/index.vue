<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
const { t } = useI18n()
const router = useRouter()
const { profile, user, updateProfile, signOut } = useAuth()
const { extras, saveExtras } = useProfileExtras()
const { categories } = useCategoriesList()
const { setCity } = useHomeFilters()
const toast = useToast()
const { buzz } = useUiPrefs()

const form = reactive({
  fullName: '',
  phone: '',
  avatarUrl: '',
  birthdate: '',
  city: '',
  bio: '',
  useCityOnHome: false,
})
const interests = ref<string[]>([])
const saving = ref(false)
const savingAvatar = ref(false)
const feedback = ref<{ type: 'success' | 'error'; text: string } | null>(null)
const personalOpen = ref(true)
const interestsOpen = ref(true)
const lightbox = ref(false)
const confirmSignOut = ref(false)

// Valeurs enregistrées : servent à détecter les modifications non enregistrées.
const saved = reactive({ fullName: '', phone: '', birthdate: '', city: '', bio: '', useCityOnHome: false })

function syncFromServer() {
  const p = profile.value
  form.fullName = p?.full_name || ''
  form.phone = p?.phone || ''
  form.avatarUrl = p?.avatar_url || ''
  const e = extras.value
  form.birthdate = e.birthdate
  form.city = e.city
  form.bio = e.bio
  form.useCityOnHome = e.useCityOnHome
  interests.value = [...e.interests]
  Object.assign(saved, {
    fullName: form.fullName,
    phone: form.phone,
    birthdate: form.birthdate,
    city: form.city,
    bio: form.bio,
    useCityOnHome: form.useCityOnHome,
  })
}
// Pendant un enregistrement, `profile` change (updateProfile) : on ne doit SURTOUT pas
// réécrire le formulaire à ce moment-là avec les anciennes valeurs, sinon la ville, la
// présentation et la date de naissance saisies sont effacées avant d'être envoyées.
watch(
  [profile, () => user.value?.id],
  () => {
    if (saving.value || savingAvatar.value) return
    syncFromServer()
  },
  { immediate: true }
)

const dirty = computed(
  () =>
    form.fullName !== saved.fullName ||
    form.phone !== saved.phone ||
    form.birthdate !== saved.birthdate ||
    form.city !== saved.city ||
    form.bio !== saved.bio ||
    form.useCityOnHome !== saved.useCityOnHome
)

function discard() {
  buzz(8)
  Object.assign(form, saved)
}

const initials = computed(() => {
  const name = form.fullName || profile.value?.full_name || ''
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')
})

const roleLabel = computed(() => {
  switch (profile.value?.role) {
    case 'organizer':
      return t('adminUsers.roleOrganizer')
    case 'agent':
      return t('adminUsers.roleAgent')
    case 'admin':
      return t('adminUsers.roleAdmin')
    default:
      return t('adminUsers.roleBuyer')
  }
})

const quickLinks = computed(() => [
  { to: '/mon-espace/parametres', icon: 'settings', label: t('buyerProfile.goToSettings') },
  { to: '/mon-espace/mes-commandes', icon: 'wallet', label: t('placeholderPages.myOrders') },
  { to: '/mon-espace/mes-billets', icon: 'ticket', label: t('header.myTickets') },
])

const memberSince = computed(() => {
  if (!profile.value?.created_at) return ''
  return new Date(profile.value.created_at).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
})

// Identifiant court, pratique à communiquer au support.
const memberId = computed(() => (user.value?.id ? `TKO-${user.value.id.replace(/-/g, '').slice(0, 8).toUpperCase()}` : ''))

// ------------------------------------------------------------------
// Complétion du profil : chaque étape manquante est cliquable et met
// le champ concerné en évidence.
// ------------------------------------------------------------------
const steps = computed(() => [
  { key: 'name', done: !!saved.fullName.trim(), label: t('buyerProfile.stepName'), target: 'pf-name', icon: 'user' },
  { key: 'avatar', done: !!form.avatarUrl, label: t('buyerProfile.stepAvatar'), target: 'pf-avatar', icon: 'image' },
  { key: 'phone', done: !!saved.phone.trim(), label: t('buyerProfile.stepPhone'), target: 'pf-phone', icon: 'phone' },
  { key: 'city', done: !!saved.city, label: t('buyerProfile.stepCity'), target: 'pf-city', icon: 'pin' },
  { key: 'bio', done: !!saved.bio.trim(), label: t('buyerProfile.stepBio'), target: 'pf-bio', icon: 'edit' },
  { key: 'interests', done: interests.value.length > 0, label: t('buyerProfile.stepInterests'), target: 'pf-interests', icon: 'heart' },
])
const percent = computed(() => Math.round((steps.value.filter((s) => s.done).length / steps.value.length) * 100))

async function focusTarget(id: string) {
  buzz(8)
  if (['pf-name', 'pf-phone', 'pf-city', 'pf-bio'].includes(id)) personalOpen.value = true
  if (id === 'pf-interests') interestsOpen.value = true
  await nextTick()
  setTimeout(() => {
    const el = document.getElementById(id)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) (el as HTMLElement).focus({ preventScroll: true })
    el.classList.remove('tk-flash')
    void el.offsetWidth
    el.classList.add('tk-flash')
    setTimeout(() => el.classList.remove('tk-flash'), 1900)
  }, 360)
}

// ------------------------------------------------------------------
// Copier (email, identifiant) : l'icône se transforme en « ✓ » un instant.
// ------------------------------------------------------------------
const copied = ref('')
async function copy(key: string, value: string) {
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
  } catch {
    const ta = document.createElement('textarea')
    ta.value = value
    document.body.appendChild(ta)
    ta.select()
    document.execCommand('copy')
    ta.remove()
  }
  buzz(10)
  copied.value = key
  toast.success(t('buyerProfile.copied'))
  setTimeout(() => (copied.value = ''), 1600)
}

// ------------------------------------------------------------------
// Inviter un ami : partage natif sur mobile, sinon copie du lien.
// ------------------------------------------------------------------
async function invite() {
  const url = `${window.location.origin}/inscription`
  const data = { title: 'Tikeo', text: t('buyerProfile.inviteMessage'), url }
  buzz(12)
  try {
    if (navigator.share) {
      await navigator.share(data)
      return
    }
  } catch {
    return // partage annulé
  }
  await copy('invite', url)
}

// ------------------------------------------------------------------
// Photo : sauvegarde automatique dès l'envoi, suppression en un clic.
// ------------------------------------------------------------------
async function handleAvatarChange(url: string) {
  form.avatarUrl = url
  savingAvatar.value = true
  feedback.value = null
  try {
    await updateProfile({ avatarUrl: url })
    if (url) toast.success(t('buyerProfile.avatarUpdated'))
  } catch (e: any) {
    feedback.value = { type: 'error', text: e?.message || t('buyerProfile.saveError') }
  } finally {
    savingAvatar.value = false
  }
}

// ------------------------------------------------------------------
// Centres d'intérêt : une pastille = un clic, enregistrement automatique.
// ------------------------------------------------------------------
const popped = ref('')
let interestTimer: ReturnType<typeof setTimeout> | null = null

function toggleInterest(name: string) {
  buzz(8)
  const set = new Set(interests.value)
  if (set.has(name)) set.delete(name)
  else {
    set.add(name)
    popped.value = name
    setTimeout(() => (popped.value = ''), 350)
  }
  interests.value = [...set]
  if (interestTimer) clearTimeout(interestTimer)
  interestTimer = setTimeout(async () => {
    try {
      await saveExtras({ interests: interests.value })
      toast.success(t('buyerProfile.interestsSaved'))
    } catch (e: any) {
      toast.error(e?.message || t('buyerProfile.saveError'))
    }
  }, 800)
}

// ------------------------------------------------------------------
// Enregistrement du formulaire
// ------------------------------------------------------------------
async function handleSubmit() {
  saving.value = true
  feedback.value = null
  // Instantané de ce que l'utilisateur a saisi : tout l'enregistrement part de ces valeurs.
  const snap = {
    fullName: form.fullName.trim(),
    phone: form.phone.trim(),
    birthdate: form.birthdate,
    city: form.city,
    bio: form.bio.trim(),
    useCityOnHome: form.useCityOnHome,
  }
  try {
    await updateProfile({ fullName: snap.fullName, phone: snap.phone })
    await saveExtras({
      bio: snap.bio,
      city: snap.city,
      birthdate: snap.birthdate,
      useCityOnHome: snap.useCityOnHome,
      interests: interests.value, // un clic sur une pastille juste avant ne doit pas être écrasé
    })
    if (snap.useCityOnHome && snap.city) setCity(snap.city)
    Object.assign(saved, snap)
    Object.assign(form, snap)
    buzz([12, 40, 12])
    toast.success(t('buyerProfile.saveSuccess'))
  } catch (e: any) {
    feedback.value = { type: 'error', text: e?.message || t('buyerProfile.saveError') }
    toast.error(t('buyerProfile.saveError'))
  } finally {
    saving.value = false
  }
}

async function doSignOut() {
  await signOut()
  router.push('/')
}

const CITIES = ['Abidjan', 'Bouaké', 'Yamoussoukro', 'Korhogo', 'San-Pédro', 'Man', 'Daloa', 'Gagnoa']
const maxBirth = new Date().toISOString().slice(0, 10)

onMounted(() => {
  const onKey = (e: KeyboardEvent) => e.key === 'Escape' && (lightbox.value = false)
  window.addEventListener('keydown', onKey)
  onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
})
</script>

<template>
  <AccountShell :title="t('header.profile')" :subtitle="t('buyerProfile.subtitle')" width="wide" identity>
    <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-10">
      <!-- ============ Colonne principale ============ -->
      <div class="min-w-0 space-y-6">
        <p v-if="feedback" :class="feedback.type === 'success' ? 'acc-alert-success' : 'acc-alert-error'">{{ feedback.text }}</p>

        <!-- Complétion du profil -->
        <section class="acc-panel overflow-hidden">
          <div class="flex items-center justify-between gap-4 px-4 pt-4 md:px-5 md:pt-5">
            <div class="min-w-0">
              <h2 class="font-display text-lg font-extrabold tracking-tight text-tikeo-black">{{ t('buyerProfile.completionTitle') }}</h2>
              <p class="text-xs text-tikeo-gray-text">{{ percent === 100 ? t('buyerProfile.completionDone') : t('buyerProfile.completionHint') }}</p>
            </div>
            <span class="font-display text-3xl font-extrabold tabular-nums text-tikeo-black">{{ percent }}<span class="text-lg">%</span></span>
          </div>
          <div class="mx-4 mt-3 h-2 bg-tikeo-surface-alt md:mx-5" role="progressbar" :aria-valuenow="percent" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full bg-gradient-to-r from-[#FF7A00] to-[#0057B8] transition-all duration-700 ease-out" :style="{ width: `${percent}%` }" />
          </div>
          <ul class="flex flex-wrap gap-2 p-4 md:p-5">
            <li v-for="s in steps" :key="s.key">
              <button
                type="button"
                class="flex h-9 items-center gap-1.5 border px-3 text-[13px] font-bold transition-all duration-200 active:scale-95"
                :class="
                  s.done
                    ? 'border-tikeo-success/40 bg-tikeo-success/10 text-tikeo-success'
                    : 'border-tikeo-border text-tikeo-black hover:-translate-y-0.5 hover:border-[#FF7A00]'
                "
                @click="focusTarget(s.target)"
              >
                <AppIcon :name="s.done ? 'check' : s.icon" class="h-4 w-4" :stroke="s.done ? 3 : 2" />
                {{ s.label }}
              </button>
            </li>
          </ul>
        </section>

        <!-- Photo -->
        <section id="pf-avatar" class="acc-panel flex items-center gap-4 p-4 md:p-5">
          <button
            type="button"
            class="group relative shrink-0 overflow-hidden"
            :aria-label="t('buyerProfile.viewPhoto')"
            :disabled="!form.avatarUrl"
            @click="lightbox = true"
          >
            <UserAvatar :avatar-url="form.avatarUrl" :initials="initials" square size-class="h-16 w-16 md:h-20 md:w-20" text-class="text-xl" />
            <span v-if="form.avatarUrl" class="absolute inset-0 flex items-center justify-center bg-tikeo-ink/55 text-white opacity-0 transition-opacity group-hover:opacity-100">
              <AppIcon name="eye" class="h-5 w-5" />
            </span>
          </button>
          <div class="min-w-0 flex-1">
            <MediaInput :model-value="form.avatarUrl" folder="avatars" compact hide-url :label="t('buyerProfile.avatarLabel')" @update:model-value="handleAvatarChange" />
            <div class="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1">
              <p v-if="savingAvatar" class="text-xs text-tikeo-gray-text">{{ t('buyerProfile.saving') }}</p>
              <button v-if="form.avatarUrl && !savingAvatar" type="button" class="text-xs font-bold text-tikeo-error underline-offset-4 hover:underline" @click="handleAvatarChange('')">
                {{ t('buyerProfile.removePhoto') }}
              </button>
            </div>
          </div>
        </section>

        <!-- Informations personnelles -->
        <AccordionPanel v-model:open="personalOpen" :title="t('buyerProfile.personalTitle')" :subtitle="t('buyerProfile.personalSubtitle')" icon="user" :summary="form.fullName">
          <form class="space-y-5 p-4 md:p-5" @submit.prevent="handleSubmit">
            <div>
              <label class="acc-label mb-1.5 block" for="pf-name">{{ t('buyerProfile.fullName') }}</label>
              <input id="pf-name" v-model="form.fullName" type="text" required class="input-field !h-11" />
            </div>

            <div>
              <label class="acc-label mb-1.5 block">{{ t('buyerProfile.email') }}</label>
              <div class="flex gap-2">
                <input :value="user?.email" type="email" disabled class="input-field !h-11 min-w-0 flex-1 cursor-not-allowed opacity-60" />
                <button type="button" class="acc-btn-ghost !h-11 shrink-0" :aria-label="t('buyerProfile.copy')" @click="copy('email', user?.email || '')">
                  <AppIcon :name="copied === 'email' ? 'check' : 'copy'" class="h-4 w-4" :class="copied === 'email' ? 'tk-pop text-tikeo-success' : ''" :stroke="2.2" />
                  <span class="hidden sm:inline">{{ copied === 'email' ? t('buyerProfile.copied') : t('buyerProfile.copy') }}</span>
                </button>
              </div>
              <p class="mt-1.5 text-xs text-tikeo-gray-text">
                {{ t('buyerProfile.emailNote') }}
                <NuxtLink to="/mon-espace/parametres" class="font-bold text-tikeo-black underline decoration-[#FF7A00] decoration-2 underline-offset-4">{{ t('buyerProfile.changeInSettings') }}</NuxtLink>
              </p>
            </div>

            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label class="acc-label mb-1.5 block" for="pf-phone">{{ t('buyerProfile.phone') }}</label>
                <input id="pf-phone" v-model="form.phone" type="tel" :placeholder="t('buyerProfile.phonePlaceholder')" class="input-field !h-11" />
              </div>
              <div>
                <label class="acc-label mb-1.5 block" for="pf-birth">{{ t('buyerProfile.birthdate') }}</label>
                <input id="pf-birth" v-model="form.birthdate" type="date" :max="maxBirth" class="input-field !h-11" />
              </div>
            </div>

            <div>
              <label class="acc-label mb-1.5 block" for="pf-city">{{ t('buyerProfile.city') }}</label>
              <select id="pf-city" v-model="form.city" class="input-field !h-11">
                <option value="">{{ t('buyerProfile.cityNone') }}</option>
                <option v-for="c in CITIES" :key="c" :value="c">{{ c }}</option>
              </select>
              <div class="mt-3 flex items-center justify-between gap-4 border border-dashed border-tikeo-border px-3.5 py-3 transition-colors" :class="form.useCityOnHome && form.city ? 'border-[#FF7A00] bg-[#FF7A00]/5' : ''">
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-tikeo-black">{{ t('buyerProfile.useCityOnHome') }}</p>
                  <p class="text-xs text-tikeo-gray-text">{{ t('buyerProfile.useCityOnHomeHelp') }}</p>
                </div>
                <ToggleSwitch v-model="form.useCityOnHome" :disabled="!form.city" :aria-label="t('buyerProfile.useCityOnHome')" />
              </div>
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between">
                <label class="acc-label block" for="pf-bio">{{ t('buyerProfile.bio') }}</label>
                <span class="text-xs font-semibold tabular-nums" :class="form.bio.length > 150 ? 'text-tikeo-error' : 'text-tikeo-gray-text'">{{ form.bio.length }}/160</span>
              </div>
              <textarea id="pf-bio" v-model="form.bio" rows="3" maxlength="160" class="input-field resize-none" :placeholder="t('buyerProfile.bioPlaceholder')" />
            </div>

            <button type="submit" class="btn-ink !h-12 !px-7 disabled:opacity-60 max-sm:w-full" :disabled="saving || !dirty">
              {{ saving ? t('buyerProfile.saving') : t('buyerProfile.save') }}
            </button>
          </form>
        </AccordionPanel>

        <!-- Centres d'intérêt -->
        <AccordionPanel v-model:open="interestsOpen" :title="t('buyerProfile.interestsTitle')" :subtitle="t('buyerProfile.interestsSubtitle')" icon="heart" :summary="t('buyerProfile.interestsCount', { n: interests.length })">
          <div id="pf-interests" class="p-4 md:p-5">
            <p v-if="categories.length === 0" class="text-sm text-tikeo-gray-text">{{ t('buyerProfile.interestsEmpty') }}</p>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="c in categories"
                :key="c.id"
                type="button"
                class="flex h-10 items-center gap-1.5 border px-4 text-sm font-bold transition-all duration-200 active:scale-95"
                :class="[
                  interests.includes(c.name) ? 'border-[#FF7A00] bg-[#FF7A00] text-tikeo-ink' : 'border-tikeo-border text-tikeo-black hover:-translate-y-0.5 hover:border-tikeo-ink dark:hover:border-[#FF7A00]',
                  popped === c.name ? 'tk-pop' : '',
                ]"
                :aria-pressed="interests.includes(c.name)"
                @click="toggleInterest(c.name)"
              >
                <AppIcon v-if="interests.includes(c.name)" name="check" class="h-4 w-4" :stroke="3" />
                {{ c.name }}
              </button>
            </div>
            <p class="mt-4 text-xs text-tikeo-gray-text">{{ t('buyerProfile.interestsAuto') }}</p>
          </div>
        </AccordionPanel>
      </div>

      <!-- ============ Colonne secondaire ============ -->
      <aside class="min-w-0 space-y-6">
        <section class="bg-tikeo-ink p-5 text-white">
          <h2 class="mb-4 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-white/60">
            <span class="h-[3px] w-6 bg-[#FF7A00]" aria-hidden="true" />
            {{ t('buyerProfile.accountInfoTitle') }}
          </h2>
          <dl class="space-y-3.5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <dt class="text-white/65">{{ t('buyerProfile.accountType') }}</dt>
              <dd><span class="acc-tag bg-[#FF7A00] text-tikeo-ink">{{ roleLabel }}</span></dd>
            </div>
            <div v-if="memberSince" class="flex items-center justify-between gap-3">
              <dt class="text-white/65">{{ t('buyerProfile.memberSince') }}</dt>
              <dd class="font-semibold capitalize">{{ memberSince }}</dd>
            </div>
            <div v-if="memberId" class="flex items-center justify-between gap-3">
              <dt class="text-white/65">{{ t('buyerProfile.memberId') }}</dt>
              <dd>
                <button type="button" class="flex items-center gap-1.5 border border-white/25 px-2 py-1 font-mono text-xs font-bold transition-colors hover:border-[#FF7A00] hover:text-[#FF9A3D] active:scale-95" :title="t('buyerProfile.copy')" @click="copy('id', memberId)">
                  {{ memberId }}
                  <AppIcon :name="copied === 'id' ? 'check' : 'copy'" class="h-3.5 w-3.5" :class="copied === 'id' ? 'tk-pop text-[#4ADE80]' : ''" :stroke="2.4" />
                </button>
              </dd>
            </div>
          </dl>
        </section>

        <section>
          <h2 class="acc-h2 mb-3 !text-lg">{{ t('buyerProfile.quickLinksTitle') }}</h2>
          <ul class="acc-panel divide-y divide-tikeo-border">
            <li v-for="q in quickLinks" :key="q.to">
              <NuxtLink :to="q.to" class="drawer-row group">
                <span class="drawer-icon"><AppIcon :name="q.icon" class="h-5 w-5" /></span>
                <span class="flex-1">{{ q.label }}</span>
                <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-tikeo-gray-text transition-transform group-hover:translate-x-1" :stroke="2.4" />
              </NuxtLink>
            </li>
          </ul>
        </section>

        <!-- Inviter un ami -->
        <section class="border border-dashed border-[#FF7A00]/60 bg-[#FF7A00]/5 p-5">
          <h2 class="font-display text-lg font-extrabold tracking-tight text-tikeo-black">{{ t('buyerProfile.inviteTitle') }}</h2>
          <p class="mb-4 mt-1 text-sm text-tikeo-gray-text">{{ t('buyerProfile.inviteText') }}</p>
          <button type="button" class="btn-brand !h-11 w-full" @click="invite">
            <AppIcon :name="copied === 'invite' ? 'check' : 'share'" class="h-4 w-4" :stroke="2.4" />
            {{ copied === 'invite' ? t('buyerProfile.copied') : t('buyerProfile.inviteButton') }}
          </button>
        </section>

        <!-- Déconnexion (double confirmation en ligne) -->
        <section>
          <button v-if="!confirmSignOut" type="button" class="acc-btn-ghost w-full" @click="confirmSignOut = true">
            <AppIcon name="logout" class="h-4 w-4" :stroke="2.2" />
            {{ t('buyerProfile.signOut') }}
          </button>
          <div v-else class="border border-tikeo-error/40 p-4">
            <p class="mb-3 text-sm font-semibold text-tikeo-black">{{ t('buyerProfile.signOutConfirm') }}</p>
            <div class="flex gap-2">
              <button type="button" class="acc-btn-ghost flex-1" @click="confirmSignOut = false">{{ t('buyerProfile.cancel') }}</button>
              <button type="button" class="inline-flex h-10 flex-1 items-center justify-center bg-tikeo-error px-4 text-sm font-bold text-white hover:opacity-90" @click="doSignOut">{{ t('buyerProfile.signOut') }}</button>
            </div>
          </div>
        </section>
      </aside>
    </div>

    <!-- Barre « modifications non enregistrées » -->
    <Transition name="dirty">
      <div v-if="dirty" class="fixed inset-x-0 bottom-[4.5rem] z-40 flex justify-center px-4 md:bottom-6">
        <div class="flex w-full max-w-lg items-center gap-3 border border-[#FF7A00] bg-tikeo-ink px-4 py-3 text-white shadow-card-hover">
          <span class="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#FF7A00]" aria-hidden="true" />
          <p class="min-w-0 flex-1 text-sm font-semibold">{{ t('buyerProfile.unsaved') }}</p>
          <button type="button" class="px-2 py-1 text-[13px] font-bold text-white/80 hover:text-white" @click="discard">{{ t('buyerProfile.discard') }}</button>
          <button type="button" class="h-9 bg-[#FF7A00] px-4 text-[13px] font-extrabold text-tikeo-ink hover:bg-white disabled:opacity-60" :disabled="saving" @click="handleSubmit">
            {{ saving ? t('buyerProfile.saving') : t('buyerProfile.save') }}
          </button>
        </div>
      </div>
    </Transition>

    <!-- Aperçu de la photo -->
    <Transition name="lb">
      <div v-if="lightbox && form.avatarUrl" class="fixed inset-0 z-[9300] flex items-center justify-center bg-tikeo-ink/90 p-6 backdrop-blur-sm" role="dialog" aria-modal="true" @click="lightbox = false">
        <img :src="form.avatarUrl" :alt="form.fullName" class="max-h-[80vh] max-w-full border-4 border-white object-contain shadow-2xl" />
        <button type="button" class="absolute right-4 top-4 flex h-11 w-11 items-center justify-center bg-white text-tikeo-ink hover:bg-[#FF7A00]" :aria-label="t('buyerProfile.cancel')" @click="lightbox = false">
          <AppIcon name="close" class="h-5 w-5" :stroke="2.6" />
        </button>
      </div>
    </Transition>
  </AccountShell>
</template>

<style scoped>
.dirty-enter-active,
.dirty-leave-active {
  transition: opacity 0.3s var(--ease-tikeo), transform 0.3s var(--ease-tikeo);
}
.dirty-enter-from,
.dirty-leave-to {
  opacity: 0;
  transform: translateY(24px);
}
.lb-enter-active,
.lb-leave-active {
  transition: opacity 0.25s ease;
}
.lb-enter-from,
.lb-leave-to {
  opacity: 0;
}
.lb-enter-active img {
  animation: lb-zoom 0.35s var(--ease-tikeo);
}
@keyframes lb-zoom {
  from { transform: scale(0.85); }
  to { transform: scale(1); }
}
</style>
