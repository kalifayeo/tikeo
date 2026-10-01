<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })

/**
 * Codes promo d'un événement. La réduction est recalculée et appliquée en
 * base par create_order() (supabase/migrations/0029_promo_codes.sql) — ici,
 * on ne fait que créer / modifier / activer / supprimer les codes.
 */
interface PromoCode {
  id: string
  event_id: string
  code: string
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_uses: number | null
  used_count: number
  max_uses_per_buyer: number
  starts_at: string | null
  ends_at: string | null
  status: 'active' | 'inactive'
  created_at: string
}

const { t } = useI18n()
const route = useRoute()
const eventId = route.params.id as string
const supabase = useSupabase()

const eventTitle = ref('')
const codes = ref<PromoCode[]>([])
const loading = ref(true)
const errorMsg = ref('')
const message = ref('')

function flash(msg: string) {
  errorMsg.value = ''
  message.value = msg
  setTimeout(() => (message.value = ''), 2500)
}

async function load() {
  loading.value = true
  try {
    const [{ data: ev }, { data: list, error }] = await Promise.all([
      supabase.from('events').select('title').eq('id', eventId).maybeSingle(),
      supabase.from('promo_codes').select('*').eq('event_id', eventId).order('created_at', { ascending: false }),
    ])
    if (error) throw error
    eventTitle.value = ev?.title || ''
    codes.value = (list as unknown as PromoCode[]) ?? []
  } catch (e: any) {
    errorMsg.value = e?.message || t('promo.loadError')
  } finally {
    loading.value = false
  }
}
onMounted(load)

// --- Formulaire ------------------------------------------------------------
const draft = ref<Partial<PromoCode> | null>(null)
const saving = ref(false)
const startsLocal = ref('')
const endsLocal = ref('')

const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function openForm(c?: PromoCode) {
  errorMsg.value = ''
  draft.value = c ? { ...c } : { code: '', discount_type: 'percent', discount_value: 10, max_uses: null, max_uses_per_buyer: 1, status: 'active' }
  startsLocal.value = toLocalInput(c?.starts_at)
  endsLocal.value = toLocalInput(c?.ends_at)
}

async function save() {
  const d = draft.value
  if (!d) return
  const code = (d.code || '').trim().toUpperCase()
  if (code.length < 2) {
    errorMsg.value = t('promo.codeTooShort')
    return
  }
  if (!d.discount_value || d.discount_value <= 0 || (d.discount_type === 'percent' && d.discount_value > 100)) {
    errorMsg.value = t('promo.valueError')
    return
  }
  const starts_at = fromLocalInput(startsLocal.value)
  const ends_at = fromLocalInput(endsLocal.value)
  if (starts_at && ends_at && new Date(ends_at) <= new Date(starts_at)) {
    errorMsg.value = t('promo.dateError')
    return
  }

  saving.value = true
  errorMsg.value = ''
  const payload = {
    event_id: eventId,
    code,
    discount_type: d.discount_type,
    discount_value: d.discount_value,
    max_uses: d.max_uses || null,
    max_uses_per_buyer: d.max_uses_per_buyer || 1,
    starts_at,
    ends_at,
    status: d.status || 'active',
  }
  try {
    if (d.id) {
      const { error } = await supabase.from('promo_codes').update(payload).eq('id', d.id)
      if (error) throw error
    } else {
      const { error } = await supabase.from('promo_codes').insert(payload)
      if (error) throw error
    }
    draft.value = null
    await load()
    flash(t('promo.saved'))
  } catch (e: any) {
    // Contrainte d'unicité (event_id, code) : message clair plutôt que l'erreur brute Postgres.
    errorMsg.value = e?.code === '23505' ? t('promo.codeExists') : e?.message || t('promo.saveError')
  } finally {
    saving.value = false
  }
}

async function toggle(c: PromoCode) {
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('promo_codes').update({ status: c.status === 'active' ? 'inactive' : 'active' }).eq('id', c.id)
    if (error) throw error
    await load()
  } catch (e: any) {
    errorMsg.value = e?.message || t('promo.saveError')
  }
}

async function remove(c: PromoCode) {
  if (!confirm(t('promo.deleteConfirm'))) return
  errorMsg.value = ''
  try {
    const { error } = await supabase.from('promo_codes').delete().eq('id', c.id)
    if (error) throw error
    await load()
  } catch (e: any) {
    errorMsg.value = e?.message || t('promo.saveError')
  }
}

function usageLabel(c: PromoCode) {
  return c.max_uses ? `${c.used_count} / ${c.max_uses}` : `${c.used_count} / ${t('promo.unlimited')}`
}
function valueLabel(c: PromoCode) {
  return c.discount_type === 'percent' ? `-${c.discount_value}%` : `-${c.discount_value} FCFA`
}
function stateOf(c: PromoCode): 'inactive' | 'expired' | 'exhausted' | 'scheduled' | 'live' {
  if (c.status !== 'active') return 'inactive'
  const now = Date.now()
  if (c.starts_at && new Date(c.starts_at).getTime() > now) return 'scheduled'
  if (c.ends_at && new Date(c.ends_at).getTime() <= now) return 'expired'
  if (c.max_uses && c.used_count >= c.max_uses) return 'exhausted'
  return 'live'
}
const stateClass: Record<string, string> = {
  live: 'bg-green-500/15 text-green-700',
  scheduled: 'bg-tikeo-blue/15 text-tikeo-blue',
  expired: 'bg-tikeo-gray-text/15 text-tikeo-gray-text',
  exhausted: 'bg-tikeo-gray-text/15 text-tikeo-gray-text',
  inactive: 'bg-tikeo-gray-text/15 text-tikeo-gray-text',
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-8 md:px-6">
    <NuxtLink to="/organisateur/evenements" class="text-xs font-semibold text-tikeo-orange">← {{ t('ticketStats.backToEvents') }}</NuxtLink>
    <div class="mb-6 mt-2 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-xl font-bold text-tikeo-black">{{ t('promo.title') }}</h1>
        <p v-if="eventTitle" class="mt-1 text-sm text-tikeo-gray-text">{{ eventTitle }}</p>
      </div>
      <button type="button" class="btn-primary !py-2 text-xs" @click="openForm()">+ {{ t('promo.new') }}</button>
    </div>

    <p v-if="errorMsg" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-3 py-2 text-xs text-tikeo-error">{{ errorMsg }}</p>
    <p v-if="message" class="mb-4 border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-700">{{ message }}</p>

    <form v-if="draft" class="mb-6 grid gap-3 border border-tikeo-orange/40 bg-tikeo-orange/5 p-5 sm:grid-cols-2" @submit.prevent="save">
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldCode') }}</label>
        <input v-model="draft.code" type="text" maxlength="30" required class="input-field w-full uppercase" :placeholder="t('promo.codePlaceholder')" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldStatus') }}</label>
        <select v-model="draft.status" class="input-field w-full">
          <option value="active">{{ t('adminEngagement.active') }}</option>
          <option value="inactive">{{ t('adminEngagement.inactive') }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldType') }}</label>
        <select v-model="draft.discount_type" class="input-field w-full">
          <option value="percent">{{ t('promo.typePercent') }}</option>
          <option value="fixed">{{ t('promo.typeFixed') }}</option>
        </select>
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ draft.discount_type === 'percent' ? t('promo.fieldValuePercent') : t('promo.fieldValueFixed') }}</label>
        <input v-model.number="draft.discount_value" type="number" min="1" :max="draft.discount_type === 'percent' ? 100 : undefined" step="1" required class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldMaxUses') }}</label>
        <input v-model.number="draft.max_uses" type="number" min="1" class="input-field w-full" :placeholder="t('promo.unlimited')" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldMaxUsesPerBuyer') }}</label>
        <input v-model.number="draft.max_uses_per_buyer" type="number" min="1" required class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldStart') }}</label>
        <input v-model="startsLocal" type="datetime-local" class="input-field w-full" />
      </div>
      <div>
        <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('promo.fieldEnd') }}</label>
        <input v-model="endsLocal" type="datetime-local" class="input-field w-full" />
      </div>
      <div class="flex gap-2 sm:col-span-2">
        <button type="submit" class="btn-primary !py-2 text-xs" :disabled="saving">{{ saving ? t('adminEngagement.saving') : t('adminEngagement.save') }}</button>
        <button type="button" class="btn-secondary !py-2 text-xs" @click="draft = null">{{ t('adminEngagement.cancel') }}</button>
      </div>
    </form>

    <div v-if="loading" class="space-y-2">
      <div v-for="i in 3" :key="i" class="h-16 animate-pulse border border-tikeo-border bg-tikeo-surface-alt" />
    </div>
    <p v-else-if="!codes.length" class="border border-tikeo-border bg-tikeo-surface p-6 text-center text-sm text-tikeo-gray-text">{{ t('promo.empty') }}</p>
    <ul v-else class="space-y-2">
      <li v-for="c in codes" :key="c.id" class="flex flex-wrap items-center gap-3 border border-tikeo-border bg-tikeo-surface p-3">
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-mono text-sm font-bold text-tikeo-black">{{ c.code }}</span>
            <span class="text-sm font-semibold text-tikeo-orange">{{ valueLabel(c) }}</span>
            <span class="px-2 py-0.5 text-[10px] font-bold uppercase" :class="stateClass[stateOf(c)]">{{ t(`promo.state.${stateOf(c)}`) }}</span>
          </div>
          <p class="mt-1 text-[11px] text-tikeo-gray-text">
            {{ t('promo.usage') }} : {{ usageLabel(c) }} · {{ t('promo.perBuyer') }} : {{ c.max_uses_per_buyer }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="toggle(c)">{{ c.status === 'active' ? t('adminEngagement.deactivate') : t('adminEngagement.activate') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-orange hover:text-tikeo-orange" @click="openForm(c)">{{ t('adminEngagement.edit') }}</button>
          <button type="button" class="border border-tikeo-border px-2 py-1 text-xs hover:border-tikeo-error hover:text-tikeo-error" @click="remove(c)">{{ t('adminEngagement.delete') }}</button>
        </div>
      </li>
    </ul>
  </div>
</template>
