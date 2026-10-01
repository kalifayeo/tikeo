<script setup lang="ts">
/**
 * « Vous aimerez aussi » : événements à venir de la même ville ou de la
 * même catégorie, pour garder le visiteur sur le site après une fiche.
 */
import type { EventCardData } from '~/types/database'

const props = defineProps<{ eventId: string; city?: string | null; category?: string | null }>()
const { t } = useI18n()
const events = ref<EventCardData[]>([])

async function load() {
  try {
    const supabase = useSupabase()
    const { data } = await supabase
      .from('events')
      .select('id, slug, title, city, country, start_date, cover_image, category:categories(name), organizer:organizers(name, status), ticket_types(price)')
      .eq('status', 'published')
      .neq('id', props.eventId)
      .gte('start_date', new Date().toISOString())
      .order('start_date', { ascending: true })
      .limit(30)

    const scored = ((data as any[]) ?? []).map((e) => {
      const prices = (e.ticket_types ?? []).map((tt: any) => Number(tt.price)).filter((p: number) => !Number.isNaN(p))
      const score = (props.city && e.city === props.city ? 2 : 0) + (props.category && e.category?.name === props.category ? 1 : 0)
      return {
        score,
        card: {
          id: e.id,
          slug: e.slug,
          title: e.title,
          city: e.city ?? '',
          country: e.country ?? '',
          startDate: e.start_date,
          coverImage: e.cover_image || '/sample-event.jpg',
          priceFrom: prices.length ? Math.min(...prices) : 0,
          category: e.category?.name,
          verified: e.organizer?.status === 'approved',
          organizerName: e.organizer?.name,
        } as EventCardData,
      }
    })
    // Meilleure pertinence d'abord, puis date la plus proche (le tri de départ est conservé à score égal).
    events.value = scored
      .map((s, i) => ({ ...s, i }))
      .sort((a, b) => b.score - a.score || a.i - b.i)
      .slice(0, 4)
      .map((s) => s.card)
  } catch {
    events.value = [] // section décorative : jamais d'erreur visible
  }
}

onMounted(load)
</script>

<template>
  <section v-if="events.length" class="mx-auto max-w-tikeo-container px-4 pb-8 md:px-6 md:pb-12">
    <h2 class="mb-4 text-lg font-bold text-tikeo-black">{{ t('event.similarTitle') }}</h2>
    <div class="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
      <EventCard v-for="e in events" :key="e.id" :event="e" variant="grid" />
    </div>
  </section>
</template>
