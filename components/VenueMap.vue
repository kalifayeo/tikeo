<script setup lang="ts">
/**
 * Carte du lieu d'un événement (OpenStreetMap via Leaflet, sans clé API).
 * N'affiche rien si l'organisateur n'a pas renseigné de coordonnées — le
 * texte de l'adresse reste toujours visible juste au-dessus, dans la page
 * appelante, avec ou sans carte.
 */
const props = defineProps<{
  latitude: number
  longitude: number
  label?: string
}>()

const mapEl = ref<HTMLDivElement | null>(null)
let map: any = null

onMounted(async () => {
  if (!import.meta.client || !mapEl.value) return
  const L = (await import('leaflet')).default
  await import('leaflet/dist/leaflet.css')

  // Icône par défaut de Leaflet : les chemins d'image intégrés ne survivent
  // pas au bundling Vite, on les redéclare explicitement via CDN.
  delete (L.Icon.Default.prototype as any)._getIconUrl
  L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  })

  map = L.map(mapEl.value, { scrollWheelZoom: false }).setView([props.latitude, props.longitude], 15)
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
  }).addTo(map)
  L.marker([props.latitude, props.longitude]).addTo(map).bindPopup(props.label || '').openPopup()
})

onBeforeUnmount(() => {
  map?.remove()
  map = null
})
</script>

<template>
  <div ref="mapEl" class="h-64 w-full border border-tikeo-border" />
</template>
