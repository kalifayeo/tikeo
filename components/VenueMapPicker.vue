<script setup lang="ts">
/**
 * Sélecteur de coordonnées pour "la carte du lieu" : recherche d'adresse
 * (OpenStreetMap Nominatim, gratuit, sans clé) ou pointage direct sur la
 * carte. Entièrement facultatif — laisser vide n'empêche pas de publier
 * l'événement, seule la carte ne s'affichera pas sur sa page.
 */
const props = defineProps<{ latitude: number | null; longitude: number | null }>()
const { t } = useI18n()
const searchId = useId()
const emit = defineEmits<{ 'update:latitude': [number | null]; 'update:longitude': [number | null] }>()

const mapEl = ref<HTMLDivElement | null>(null)
const query = ref('')
const searching = ref(false)
const results = ref<Array<{ display_name: string; lat: string; lon: string }>>([])

let L: any = null
let map: any = null
let marker: any = null

function setPosition(lat: number, lng: number) {
  emit('update:latitude', lat)
  emit('update:longitude', lng)
  if (!map || !L) return
  map.setView([lat, lng], 16)
  if (marker) marker.setLatLng([lat, lng])
  else marker = L.marker([lat, lng], { draggable: true }).addTo(map).on('dragend', () => {
    const p = marker.getLatLng()
    emit('update:latitude', p.lat)
    emit('update:longitude', p.lng)
  })
}

onMounted(async () => {
  if (!import.meta.client || !mapEl.value) return
  L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })

  const startLat = props.latitude ?? 5.316667
  const startLng = props.longitude ?? -4.033333 // Abidjan, par défaut si rien n'est encore choisi
  map = L.map(mapEl.value).setView([startLat, startLng], props.latitude ? 16 : 11)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap',
    maxZoom: 19,
  }).addTo(map)

  if (props.latitude != null && props.longitude != null) {
    marker = L.marker([props.latitude, props.longitude], { draggable: true }).addTo(map)
    marker.on('dragend', () => {
      const p = marker.getLatLng()
      emit('update:latitude', p.lat)
      emit('update:longitude', p.lng)
    })
  }

  map.on('click', (e: any) => setPosition(e.latlng.lat, e.latlng.lng))
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})

let searchTimer: ReturnType<typeof setTimeout> | null = null
watch(query, (q) => {
  if (searchTimer) clearTimeout(searchTimer)
  if (q.trim().length < 3) {
    results.value = []
    return
  }
  searchTimer = setTimeout(async () => {
    searching.value = true
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`)
      results.value = res.ok ? await res.json() : []
    } catch {
      results.value = []
    } finally {
      searching.value = false
    }
  }, 500)
})

function pickResult(r: { display_name: string; lat: string; lon: string }) {
  setPosition(parseFloat(r.lat), parseFloat(r.lon))
  query.value = r.display_name
  results.value = []
}

function clearPosition() {
  emit('update:latitude', null)
  emit('update:longitude', null)
  if (marker) {
    marker.remove()
    marker = null
  }
}
</script>

<template>
  <div class="space-y-2">
    <div class="relative">
      <label :for="searchId" class="mb-1.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-bold text-tikeo-black">
        {{ t('eventForm.mapSearchLabel') }}
        <span class="text-[11px] font-medium text-tikeo-gray-text">({{ t('eventForm.optional') }})</span>
      </label>
      <input
        :id="searchId"
        v-model="query"
        type="text"
        :placeholder="t('eventForm.mapSearchPlaceholder')"
        class="input-field"
      />
      <ul v-if="results.length" class="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto border border-tikeo-border bg-tikeo-surface shadow-card">
        <li
          v-for="r in results"
          :key="r.display_name"
          class="cursor-pointer px-3 py-2 text-xs text-tikeo-black hover:bg-tikeo-surface-alt"
          @click="pickResult(r)"
        >
          {{ r.display_name }}
        </li>
      </ul>
    </div>
    <div ref="mapEl" class="h-56 w-full border border-tikeo-border" />
    <div class="flex items-center justify-between text-xs text-tikeo-gray-text">
      <span v-if="latitude != null && longitude != null">{{ latitude.toFixed(5) }}, {{ longitude.toFixed(5) }}</span>
      <span v-else>{{ t('eventForm.mapClickHint') }}</span>
      <button v-if="latitude != null" type="button" class="font-semibold text-tikeo-error" @click="clearPosition">{{ t('eventForm.mapRemove') }}</button>
    </div>
  </div>
</template>
