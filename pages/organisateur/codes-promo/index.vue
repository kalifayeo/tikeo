<script setup lang="ts">
definePageMeta({ layout: 'organisateur', middleware: 'organizer' })

const { t } = useI18n()
const { organizer, fetchOrganizer } = useOrganizer()
const supabase = useSupabase()

onMounted(() => {
  if (!organizer.value) fetchOrganizer()
})

const organizerId = computed(() => organizer.value?.id ?? null)
const { codes, loading } = useOrganizerPromoCodesOverview()

const events = ref<{ id: string; title: string }[]>([])
watch(
  organizerId,
  async (id) => {
    if (!id) return
    const { data } = await supabase.from('events').select('id, title').eq('organizer_id', id).order('created_at', { ascending: false })
    events.value = (data as any) ?? []
  },
  { immediate: true }
)

const selectedEventId = ref<string>('')
const selectedEventIdRef = computed(() => selectedEventId.value || null)
const { createCode, toggleStatus, removeCode } = useEventPromoCodes(selectedEventIdRef)

const showCreate = ref(false)
const createError = ref('')
const creating = ref(false)
const form = reactive({
  code: '',
  discountType: 'percent' as 'percent' | 'fixed',
  discountValue: 10,
  maxUses: null as number | null,
  maxUsesPerBuyer: 1,
  startsAt: '',
  endsAt: '',
})

function resetForm() {
  Object.assign(form, { code: '', discountType: 'percent', discountValue: 10, maxUses: null, maxUsesPerBuyer: 1, startsAt: '', endsAt: '' })
}

function openCreateFor(eventId: string) {
  selectedEventId.value = eventId
  resetForm()
  createError.value = ''
  showCreate.value = true
}

async function handleCreate() {
  createError.value = ''
  creating.value = true
  try {
    const result = await createCode({
      code: form.code.trim().toUpperCase(),
      discountType: form.discountType,
      discountValue: Number(form.discountValue),
      maxUses: form.maxUses,
      maxUsesPerBuyer: form.maxUsesPerBuyer,
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    })
    if (!result.ok) {
      createError.value = result.message
      return
    }
    showCreate.value = false
    // La vue d'ensemble (tous événements) doit refléter le nouveau code immédiatement.
    location.reload()
  } finally {
    creating.value = false
  }
}

async function handleDelete(id: string, eventId: string) {
  if (!confirm(t('promoCodes.deleteConfirm'))) return
  selectedEventId.value = eventId
  await removeCode(id)
  location.reload()
}

async function handleToggle(id: string, eventId: string, currentStatus: string) {
  selectedEventId.value = eventId
  await toggleStatus(id, currentStatus === 'active' ? 'inactive' : 'active')
  location.reload()
}
</script>

<template>
  <div>
    <OrgPageHeader :eyebrow="t('organizerNav.fallbackTitle')" :title="t('promoCodes.title')" :subtitle="t('promoCodes.subtitle')" icon="tag" />

    <div class="mx-auto max-w-6xl px-4 py-8 md:px-8 md:py-10">
      <div v-if="loading" class="space-y-3">
        <div v-for="i in 3" :key="i" class="org-skeleton h-24" />
      </div>

      <template v-else>
        <!-- Un code promo est toujours rattaché à un événement précis -->
        <section v-for="(ev, i) in events" :key="ev.id" class="org-rise org-panel mb-5 overflow-hidden" :style="`--i: ${i}`">
          <div class="flex items-center justify-between gap-3 border-b border-tikeo-border bg-tikeo-surface-alt px-4 py-3 md:px-5">
            <p class="flex min-w-0 items-center gap-2.5 font-display text-base font-extrabold text-tikeo-black">
              <AppIcon name="calendar" class="h-[18px] w-[18px] shrink-0 text-tikeo-orange" />
              <span class="truncate">{{ ev.title }}</span>
            </p>
            <button type="button" class="acc-btn-ghost group !h-9 shrink-0 !px-3" @click="openCreateFor(ev.id)">
              <AppIcon name="plus" class="h-4 w-4 transition-transform duration-300 group-hover:rotate-90" :stroke="2.4" />
              <span class="max-sm:hidden">{{ t('promoCodes.createButton') }}</span>
            </button>
          </div>

          <p v-if="!codes.filter((c) => c.event_id === ev.id).length" class="flex items-center gap-2 px-5 py-5 text-sm text-tikeo-gray-text">
            <AppIcon name="tag" class="h-4 w-4" />{{ t('promoCodes.empty') }}
          </p>

          <TransitionGroup v-else name="org-list" tag="ul" class="relative divide-y divide-tikeo-border">
            <li v-for="c in codes.filter((c) => c.event_id === ev.id)" :key="c.id" class="flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-3.5 transition-colors hover:bg-tikeo-surface-alt/60 md:px-5">
              <span class="bg-tikeo-ink px-2.5 py-1 font-mono text-sm font-bold tracking-wider text-white dark:bg-[#FF7A00] dark:text-tikeo-ink">{{ c.code }}</span>
              <span class="font-display text-lg font-extrabold text-tikeo-black">
                {{ c.discount_type === 'percent' ? `${c.discount_value}%` : `${c.discount_value} FCFA` }}
              </span>
              <span class="flex-1 text-xs text-tikeo-gray-text">
                {{ c.max_uses ? t('promoCodes.usedCount', { used: c.used_count, max: c.max_uses }) : t('promoCodes.usedCountUnlimited', { used: c.used_count }) }}
              </span>
              <span class="org-status" :class="c.status === 'active' ? 'bg-tikeo-success/10 text-tikeo-success is-live' : 'bg-tikeo-surface-alt text-tikeo-gray-text'">
                {{ c.status === 'active' ? t('promoCodes.statusActive') : t('promoCodes.statusDisabled') }}
              </span>
              <div class="flex items-center gap-2">
                <OrgIconButton
                  :icon="c.status === 'active' ? 'pause' : 'play'"
                  :label="c.status === 'active' ? t('promoCodes.disable') : t('promoCodes.enable')"
                  @click="handleToggle(c.id, ev.id, c.status)"
                />
                <OrgIconButton icon="trash" danger :label="t('promoCodes.delete')" @click="handleDelete(c.id, ev.id)" />
              </div>
            </li>
          </TransitionGroup>
        </section>

        <div v-if="!events.length" class="acc-empty org-pop">
          <span class="flex h-14 w-14 items-center justify-center bg-tikeo-surface-alt text-tikeo-gray-text"><AppIcon name="tag" class="h-7 w-7" /></span>
          <p class="text-sm text-tikeo-gray-text">{{ t('promoCodes.empty') }}</p>
        </div>
      </template>
    </div>

    <!-- Modale de création -->
    <Teleport to="body">
      <Transition name="org-fade">
        <div v-if="showCreate" class="fixed inset-0 z-[120] flex items-end justify-center bg-tikeo-ink/60 p-4 backdrop-blur-sm sm:items-center" @click.self="showCreate = false">
          <form class="org-pop w-full max-w-md border border-tikeo-border bg-tikeo-surface shadow-2xl" @submit.prevent="handleCreate">
            <div class="relative flex items-center justify-between border-b border-tikeo-border px-5 py-4">
              <span class="absolute inset-x-0 top-0 h-1 bg-tikeo-brand" aria-hidden="true" />
              <h2 class="acc-h2 !text-lg">{{ t('promoCodes.createButton') }}</h2>
              <button type="button" class="org-icon-btn !h-9 !w-9" :aria-label="t('promoCodes.cancel')" @click="showCreate = false"><AppIcon name="close" class="h-5 w-5" /></button>
            </div>
            <div class="space-y-3 p-5">
              <p v-if="createError" class="acc-alert-error !text-xs">{{ createError }}</p>
              <input v-model="form.code" type="text" required maxlength="30" :placeholder="t('promoCodes.codePlaceholder')" class="field-input font-mono uppercase tracking-wider" />
              <div class="grid grid-cols-2 gap-3">
                <select v-model="form.discountType" class="field-input">
                  <option value="percent">{{ t('promoCodes.percentOption') }}</option>
                  <option value="fixed">{{ t('promoCodes.fixedOption') }}</option>
                </select>
                <input v-model.number="form.discountValue" type="number" min="1" required :placeholder="t('promoCodes.valueLabel')" class="field-input" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <input v-model.number="form.maxUses" type="number" min="1" :placeholder="t('promoCodes.maxUsesUnlimited')" class="field-input" />
                <input v-model.number="form.maxUsesPerBuyer" type="number" min="1" :placeholder="t('promoCodes.maxUsesPerUserLabel')" class="field-input" />
              </div>
              <div class="grid grid-cols-2 gap-3">
                <input v-model="form.startsAt" type="date" class="field-input" />
                <input v-model="form.endsAt" type="date" class="field-input" />
              </div>
            </div>
            <div class="flex gap-3 border-t border-tikeo-border p-5">
              <button type="button" class="acc-btn-ghost flex-1" @click="showCreate = false">{{ t('promoCodes.cancel') }}</button>
              <button type="submit" class="btn-ink flex-1" :disabled="creating">
                <AppIcon name="save" class="h-[18px] w-[18px]" />{{ t('promoCodes.save') }}
              </button>
            </div>
          </form>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>
