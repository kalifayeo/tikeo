<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })
import type { EventRecord } from '~/types/database'

const { t, locale } = useI18n()
const route = useRoute()
const supabase = useSupabase()
const { ensureOrganizer } = useOrganizer()
const { csrfHeader } = useCsrf()

type ScanResult = 'valid' | 'already_used' | 'cancelled' | 'invalid' | 'wrong_event' | 'not_paid'
interface ScanOutcome {
  result: ScanResult
  ticket?: { number: string; typeName: string; holder: string; usedAt: string | null }
}
interface Stats {
  total: number
  used: number
  remaining: number
  scans: { id: string; result: ScanResult; at: string; number: string; typeName: string }[]
}

// ── Événements scannables : à venir ou en cours, publiés ────────────────────
const loadingEvents = ref(true)
const events = ref<EventRecord[]>([])
const eventId = ref<string>('')

async function loadEvents() {
  try {
    const organizer = await ensureOrganizer()
    const { data } = await supabase
      .from('events')
      .select('*')
      .eq('organizer_id', organizer!.id)
      .in('status', ['published', 'paused', 'sold_out'])
      .order('start_date', { ascending: true })
    const list = ((data as unknown as EventRecord[]) ?? []).filter((e) => !isEventPast(e.start_date, e.end_date))
    events.value = list
    const wanted = String(route.query.event ?? '')
    eventId.value = list.find((e) => e.id === wanted)?.id ?? list[0]?.id ?? ''
  } finally {
    loadingEvents.value = false
  }
}

// ── Compteurs et historique ────────────────────────────────────────────────
const stats = ref<Stats | null>(null)
async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}
async function loadStats() {
  if (!eventId.value) return
  try {
    stats.value = await $fetch<Stats>('/api/scan/stats', { query: { eventId: eventId.value }, headers: await authHeaders() })
  } catch {
    /* les compteurs sont un confort : on garde les derniers connus */
  }
}
const progress = computed(() => (stats.value?.total ? Math.round((stats.value.used / stats.value.total) * 100) : 0))

// ── Validation ─────────────────────────────────────────────────────────────
const outcome = ref<ScanOutcome | null>(null)
const busy = ref(false)
const netError = ref('')
const manualCode = ref('')
let lastCode = ''
let lastCodeAt = 0
let dismissTimer: ReturnType<typeof setTimeout> | undefined
const deviceId = ref('')

const tone = computed(() => {
  switch (outcome.value?.result) {
    case 'valid':
      return { bg: 'bg-tikeo-success', icon: 'check', label: t('organizerScanner.resultValid') }
    case 'already_used':
      return { bg: 'bg-[#E8890C]', icon: 'alert', label: t('organizerScanner.resultAlready') }
    case 'cancelled':
      return { bg: 'bg-tikeo-error', icon: 'close', label: t('organizerScanner.resultCancelled') }
    case 'wrong_event':
      return { bg: 'bg-tikeo-error', icon: 'close', label: t('organizerScanner.resultWrong') }
    case 'not_paid':
      return { bg: 'bg-tikeo-error', icon: 'close', label: t('organizerScanner.resultNotPaid') }
    default:
      return { bg: 'bg-tikeo-error', icon: 'close', label: t('organizerScanner.resultInvalid') }
  }
})

// Bip + vibration : l'agent n'a pas toujours les yeux sur l'écran
const soundOn = ref(true)
let audio: AudioContext | null = null
function beep(ok: boolean) {
  try {
    if (navigator.vibrate) navigator.vibrate(ok ? 80 : [120, 60, 120])
    if (!soundOn.value) return
    audio = audio || new (window.AudioContext || (window as any).webkitAudioContext)()
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'sine'
    osc.frequency.value = ok ? 880 : 220
    gain.gain.setValueAtTime(0.0001, audio.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.25, audio.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (ok ? 0.18 : 0.35))
    osc.connect(gain).connect(audio.destination)
    osc.start()
    osc.stop(audio.currentTime + (ok ? 0.2 : 0.4))
  } catch {
    /* le son est facultatif */
  }
}

async function validate(raw: string) {
  const code = raw.trim()
  if (!code || busy.value || !eventId.value) return
  // Le même QR reste devant la caméra pendant une seconde : on l'ignore 4 s
  if (code === lastCode && Date.now() - lastCodeAt < 4000) return
  lastCode = code
  lastCodeAt = Date.now()
  busy.value = true
  netError.value = ''
  try {
    const res = await $fetch<ScanOutcome>('/api/scan/validate', {
      method: 'POST',
      headers: { ...(await authHeaders()), ...(await csrfHeader()) },
      body: { eventId: eventId.value, code, deviceId: deviceId.value },
    })
    outcome.value = res
    beep(res.result === 'valid')
    clearTimeout(dismissTimer)
    dismissTimer = setTimeout(dismiss, res.result === 'valid' ? 2200 : 3500)
    loadStats()
  } catch (e: any) {
    lastCode = ''
    netError.value = e?.data?.statusMessage === 'FORBIDDEN' ? t('organizerScanner.forbidden') : t('organizerScanner.errorGeneric')
  } finally {
    busy.value = false
  }
}
function dismiss() {
  clearTimeout(dismissTimer)
  outcome.value = null
}
function submitManual() {
  const code = manualCode.value
  manualCode.value = ''
  lastCode = ''
  validate(code)
}

// ── Caméra ─────────────────────────────────────────────────────────────────
const scanner = useTicketScanner((code) => validate(code))
const { videoEl } = scanner

const cameraErrorText = computed(() => {
  const key = { insecure: 'cameraInsecure', unsupported: 'cameraUnsupported', denied: 'cameraDenied', notfound: 'cameraNotFound', failed: 'cameraFailed' }[scanner.error.value as string]
  return key ? t(`organizerScanner.${key}`) : ''
})

// Changer d'événement : on repart de zéro (compteurs, résultat affiché)
watch(eventId, () => {
  dismiss()
  stats.value = null
  lastCode = ''
  loadStats()
})

let poll: ReturnType<typeof setInterval> | undefined
onMounted(async () => {
  deviceId.value = (navigator.userAgent || '').slice(0, 60)
  await loadEvents()
  loadStats()
  // Plusieurs agents peuvent scanner en même temps : on rafraîchit les chiffres
  poll = setInterval(() => {
    if (!document.hidden) loadStats()
  }, 10_000)
})
onBeforeUnmount(() => {
  if (poll) clearInterval(poll)
  clearTimeout(dismissTimer)
})

function fmtTime(date: string) {
  return new Date(date).toLocaleTimeString(locale.value, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}
const resultStyle: Record<ScanResult, string> = {
  valid: 'bg-tikeo-success/10 text-tikeo-success',
  already_used: 'bg-[#E8890C]/10 text-[#B26A00]',
  cancelled: 'bg-tikeo-error/10 text-tikeo-error',
  invalid: 'bg-tikeo-error/10 text-tikeo-error',
  wrong_event: 'bg-tikeo-error/10 text-tikeo-error',
  not_paid: 'bg-tikeo-error/10 text-tikeo-error',
}
const resultLabel = (r: ScanResult) =>
  ({ valid: 'resultValid', already_used: 'resultAlready', cancelled: 'resultCancelled', invalid: 'resultInvalid', wrong_event: 'resultWrong', not_paid: 'resultNotPaid' }[r])
</script>

<template>
  <div>
    <OrgPageHeader :eyebrow="t('organizerNav.fallbackTitle')" :title="t('organizerScanner.title')" :subtitle="t('organizerScanner.description')" icon="scan">
      <template v-if="events.length" #stats>
        <div class="grid grid-cols-3 gap-3">
          <div v-for="(stat, i) in [
            { label: t('organizerScanner.statIn'), value: stats?.used ?? 0, tone: 'text-[#4ADE80]' },
            { label: t('organizerScanner.statLeft'), value: stats?.remaining ?? 0, tone: 'text-[#FF9A3D]' },
            { label: t('organizerScanner.statTotal'), value: stats?.total ?? 0, tone: 'text-white' },
          ]" :key="stat.label" class="org-pop border border-white/15 bg-white/5 p-3 md:p-4" :style="`--i: ${i + 2}`">
            <p class="text-[10px] font-bold uppercase tracking-wider text-white/60 md:text-[11px]">{{ stat.label }}</p>
            <p class="mt-1.5 font-display text-2xl font-extrabold leading-none md:text-4xl" :class="stat.tone"><OrgCountUp :value="stat.value" :duration="500" /></p>
          </div>
          <div class="col-span-3 h-1.5 overflow-hidden bg-white/10" role="progressbar" :aria-valuenow="progress" aria-valuemin="0" aria-valuemax="100">
            <div class="h-full bg-tikeo-brand transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" :style="`width: ${progress}%`" />
          </div>
        </div>
      </template>
    </OrgPageHeader>

    <div class="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-10">
      <div v-if="loadingEvents" class="org-skeleton h-96" />

      <!-- Aucun événement scannable -->
      <div v-else-if="!events.length" class="acc-empty org-pop">
        <span class="flex h-16 w-16 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="calendar" class="h-8 w-8" /></span>
        <p class="font-display text-lg font-extrabold text-tikeo-black">{{ t('organizerScanner.noEvents') }}</p>
        <p class="max-w-md text-sm text-tikeo-gray-text">{{ t('organizerScanner.noEventsHint') }}</p>
        <NuxtLink to="/organisateur/evenements" class="btn-ink">{{ t('organizerScanner.viewEvents') }}</NuxtLink>
      </div>

      <div v-else class="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <!-- ============ Caméra ============ -->
        <div class="min-w-0 space-y-3">
          <div class="relative">
            <label class="acc-label mb-1.5 block">{{ t('organizerScanner.chooseEvent') }}</label>
            <select v-model="eventId" class="field-input font-semibold">
              <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
            </select>
          </div>

          <div class="org-panel relative aspect-[3/4] max-h-[72vh] w-full overflow-hidden bg-tikeo-ink sm:aspect-[4/3] lg:aspect-[3/4]">
            <video ref="videoEl" class="absolute inset-0 h-full w-full object-cover" playsinline muted />

            <!-- Caméra éteinte -->
            <div v-if="!scanner.running.value" class="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white">
              <span class="flex h-20 w-20 items-center justify-center bg-white/10"><AppIcon name="scan" class="h-10 w-10" :stroke="1.5" /></span>
              <p v-if="cameraErrorText" class="max-w-xs text-sm text-white/80">{{ cameraErrorText }}</p>
              <p v-else class="max-w-xs text-sm text-white/70">{{ t('organizerScanner.cameraOff') }}</p>
              <button type="button" class="btn-brand" :disabled="scanner.starting.value" @click="scanner.start()">
                <AppIcon name="scan" class="h-[18px] w-[18px]" />
                {{ scanner.starting.value ? '…' : t('organizerScanner.startCamera') }}
              </button>
            </div>

            <!-- Viseur -->
            <template v-else>
              <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_36%,rgb(14_34_64/0.62)_37%)]" aria-hidden="true" />
              <div class="pointer-events-none absolute left-1/2 top-1/2 aspect-square w-[62%] max-w-[18rem] -translate-x-1/2 -translate-y-1/2" aria-hidden="true">
                <span class="absolute left-0 top-0 h-8 w-8 border-l-4 border-t-4 border-[#FF7A00]" />
                <span class="absolute right-0 top-0 h-8 w-8 border-r-4 border-t-4 border-[#FF7A00]" />
                <span class="absolute bottom-0 left-0 h-8 w-8 border-b-4 border-l-4 border-[#FF7A00]" />
                <span class="absolute bottom-0 right-0 h-8 w-8 border-b-4 border-r-4 border-[#FF7A00]" />
                <span class="scan-line absolute inset-x-2 h-0.5 bg-[#FF7A00] shadow-[0_0_14px_#FF7A00]" />
              </div>
              <p class="pointer-events-none absolute inset-x-0 bottom-16 text-center text-xs font-bold uppercase tracking-wider text-white/90">{{ busy ? t('organizerScanner.checking') : t('organizerScanner.aim') }}</p>

              <!-- Commandes -->
              <div class="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 p-3">
                <div class="flex gap-2">
                  <OrgIconButton v-if="scanner.torchAvailable.value" icon="sparkles" :label="t('organizerScanner.torch')" :success="false" class="!bg-white/15 !text-white !border-white/30" @click="scanner.toggleTorch()" />
                  <OrgIconButton v-if="scanner.canSwitch.value" icon="refresh" :label="t('organizerScanner.switchCamera')" class="!bg-white/15 !text-white !border-white/30" @click="scanner.switchCamera()" />
                  <button type="button" class="org-icon-btn org-tip !border-white/30 !bg-white/15 !text-white" :data-tip="soundOn ? t('organizerScanner.soundOff') : t('organizerScanner.soundOn')" :aria-label="t('organizerScanner.sound')" @click="soundOn = !soundOn">
                    <svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z" /><path v-if="soundOn" d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /><path v-else d="M16 9l5 6M21 9l-5 6" /></svg>
                  </button>
                </div>
                <button type="button" class="org-icon-btn org-tip !w-auto gap-2 !border-white/30 !bg-white/15 px-3 text-xs font-bold !text-white" :data-tip="t('organizerScanner.stopCamera')" @click="scanner.stop()">
                  <AppIcon name="close" class="h-[18px] w-[18px]" />{{ t('organizerScanner.stopCamera') }}
                </button>
              </div>
            </template>

            <!-- Résultat plein cadre -->
            <Transition name="org-fade">
              <button v-if="outcome" type="button" class="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 p-6 text-center text-white" :class="tone.bg" @click="dismiss">
                <span class="org-pop flex h-24 w-24 items-center justify-center bg-white/20"><AppIcon :name="tone.icon" class="h-14 w-14" :stroke="3" /></span>
                <p class="org-rise font-display text-3xl font-extrabold leading-tight md:text-4xl">{{ tone.label }}</p>
                <div v-if="outcome.ticket" class="org-rise max-w-full space-y-0.5 text-sm" style="--i: 2">
                  <p v-if="outcome.ticket.holder" class="truncate text-lg font-bold">{{ outcome.ticket.holder }}</p>
                  <p v-if="outcome.ticket.typeName" class="font-semibold text-white/90">{{ outcome.ticket.typeName }}</p>
                  <p class="font-mono text-xs text-white/80">{{ outcome.ticket.number }}</p>
                  <p v-if="outcome.result === 'already_used' && outcome.ticket.usedAt" class="pt-2 text-sm font-bold">{{ t('organizerScanner.alreadyAt', { time: fmtTime(outcome.ticket.usedAt) }) }}</p>
                </div>
                <p class="org-rise pt-3 text-[11px] font-bold uppercase tracking-wider text-white/75" style="--i: 3">{{ t('organizerScanner.tapNext') }}</p>
              </button>
            </Transition>
          </div>

          <p v-if="netError" class="acc-alert-error flex items-center gap-2"><AppIcon name="alert" class="h-4 w-4 shrink-0" />{{ netError }}</p>
        </div>

        <!-- ============ Saisie manuelle + historique ============ -->
        <div class="min-w-0 space-y-6">
          <form class="org-panel p-4 md:p-5" @submit.prevent="submitManual">
            <h2 class="acc-label mb-3 flex items-center gap-2"><AppIcon name="edit" class="h-4 w-4" />{{ t('organizerScanner.manualTitle') }}</h2>
            <div class="flex gap-2">
              <input v-model="manualCode" type="text" maxlength="120" autocapitalize="characters" autocomplete="off" spellcheck="false" class="field-input min-w-0 flex-1 font-mono uppercase tracking-wider" :placeholder="t('organizerScanner.manualPlaceholder')" />
              <button type="submit" class="btn-ink !h-12" :disabled="!manualCode.trim() || busy">
                <AppIcon name="check" class="h-[18px] w-[18px]" :stroke="2.4" /><span class="max-sm:hidden">{{ t('organizerScanner.manualButton') }}</span>
              </button>
            </div>
            <p class="mt-2 text-xs text-tikeo-gray-text">{{ t('organizerScanner.manualHint') }}</p>
          </form>

          <section>
            <div class="mb-3 flex items-center justify-between">
              <h2 class="acc-h2 !text-lg">{{ t('organizerScanner.recent') }}</h2>
              <OrgIconButton icon="refresh" :label="t('organizerScanner.refresh')" class="!h-9 !w-9" @click="loadStats()" />
            </div>
            <div v-if="!stats?.scans.length" class="acc-empty !py-8">
              <AppIcon name="inbox" class="h-7 w-7 text-tikeo-gray-text" />
              <p class="text-sm text-tikeo-gray-text">{{ t('organizerScanner.recentEmpty') }}</p>
            </div>
            <TransitionGroup v-else name="org-list" tag="ul" class="org-panel relative divide-y divide-tikeo-border">
              <li v-for="s in stats.scans" :key="s.id" class="flex items-center gap-3 px-4 py-3">
                <span class="flex h-9 w-9 shrink-0 items-center justify-center" :class="resultStyle[s.result]">
                  <AppIcon :name="s.result === 'valid' ? 'check' : s.result === 'already_used' ? 'alert' : 'close'" class="h-5 w-5" :stroke="2.4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate font-mono text-sm font-bold text-tikeo-black">{{ s.number }}</p>
                  <p class="truncate text-xs text-tikeo-gray-text">{{ s.typeName }} · {{ t(`organizerScanner.${resultLabel(s.result)}`) }}</p>
                </div>
                <time class="shrink-0 text-xs font-semibold tabular-nums text-tikeo-gray-text">{{ fmtTime(s.at) }}</time>
              </li>
            </TransitionGroup>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@keyframes scan-sweep {
  0%, 100% { top: 4%; }
  50% { top: 94%; }
}
.scan-line {
  animation: scan-sweep 2.2s ease-in-out infinite;
}
</style>
