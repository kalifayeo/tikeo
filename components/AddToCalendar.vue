<script setup lang="ts">
/**
 * « Ajouter à mon calendrier » : lien Google Agenda + fichier .ics
 * (Apple Calendar, Outlook, agenda Android...). Généré côté navigateur, sans
 * aucune requête serveur.
 */
const props = defineProps<{
  title: string
  startDate: string
  endDate?: string | null
  location?: string
  description?: string | null
  url?: string
}>()

const { t } = useI18n()
const open = ref(false)

// Sans date de fin renseignée, on suppose 3 h (durée typique d'une soirée/concert).
const start = computed(() => new Date(props.startDate))
const end = computed(() => {
  const e = props.endDate ? new Date(props.endDate) : null
  return e && e > start.value ? e : new Date(start.value.getTime() + 3 * 3600 * 1000)
})

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
const notes = computed(() => [props.description?.slice(0, 500), props.url].filter(Boolean).join('\n\n'))

const googleUrl = computed(() => {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: props.title,
    dates: `${stamp(start.value)}/${stamp(end.value)}`,
    details: notes.value,
    location: props.location || '',
  })
  return `https://calendar.google.com/calendar/render?${q.toString()}`
})

// Échappement RFC 5545 pour les champs texte.
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

function downloadIcs() {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Tikeo//Billetterie//FR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${stamp(start.value)}-${encodeURIComponent(props.title).slice(0, 40)}@tikeo`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start.value)}`,
    `DTEND:${stamp(end.value)}`,
    `SUMMARY:${esc(props.title)}`,
    props.location ? `LOCATION:${esc(props.location)}` : '',
    notes.value ? `DESCRIPTION:${esc(notes.value)}` : '',
    props.url ? `URL:${props.url}` : '',
    // Rappel 24 h avant.
    'BEGIN:VALARM',
    'TRIGGER:-P1D',
    'ACTION:DISPLAY',
    `DESCRIPTION:${esc(props.title)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
    .filter(Boolean)
    .join('\r\n')

  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.title.replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 50) || 'evenement'}.ics`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  open.value = false
}
</script>

<template>
  <div class="relative inline-block" @keyup.esc="open = false">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 border border-tikeo-border px-3 py-1.5 text-xs font-semibold text-tikeo-black transition hover:border-tikeo-orange hover:text-tikeo-orange"
      :aria-expanded="open"
      aria-haspopup="true"
      @click="open = !open"
    >
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8"><path stroke-linecap="round" stroke-linejoin="round" d="M8 7V3M16 7V3M4 5h16a1 1 0 011 1v13a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1zM12 11v6m-3-3h6" /></svg>
      {{ t('event.addToCalendar') }}
    </button>
    <div v-if="open" class="absolute left-0 top-full z-30 mt-1 w-56 border border-tikeo-border bg-tikeo-surface py-1 shadow-card-hover">
      <a :href="googleUrl" target="_blank" rel="noopener" class="block px-3.5 py-2 text-sm text-tikeo-black hover:bg-tikeo-gray-light" @click="open = false">Google Agenda</a>
      <button type="button" class="block w-full px-3.5 py-2 text-left text-sm text-tikeo-black hover:bg-tikeo-gray-light" @click="downloadIcs">{{ t('event.calendarIcs') }}</button>
    </div>
    <button v-if="open" type="button" class="fixed inset-0 z-20 cursor-default" :aria-label="t('common.close')" @click="open = false" />
  </div>
</template>
