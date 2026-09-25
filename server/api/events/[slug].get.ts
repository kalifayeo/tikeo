import { createClient } from '@supabase/supabase-js'

/**
 * GET /api/events/:slug — détail public d'un événement PUBLIÉ.
 *
 * Pourquoi cette route : le client Supabase n'existe que dans le navigateur
 * (plugins/supabase.client.ts). Sans elle, la page /e/[slug] était vide côté
 * serveur : Google, WhatsApp et Facebook ne voyaient ni titre ni image.
 * Ici la lecture se fait côté serveur avec la clé ANON (jamais service_role),
 * donc la RLS reste seule juge de ce qui est public : événements publiés
 * uniquement (cf. supabase/migrations/0001_init.sql).
 */
const EVENT_DETAIL_SELECT = `id, slug, title, description, city, country, location_name, address,
  start_date, end_date, cover_image, organizer_id, seating_plan_url,
  category:categories(name),
  organizer:organizers(name, logo_url, description, status),
  ticket_types(id, name, description, price, quantity, sold_quantity, status)`

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug') ?? ''
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(slug)) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable.' })
  }

  const config = useRuntimeConfig(event)
  if (!config.public.supabaseUrl || !config.public.supabaseAnonKey) {
    throw createError({ statusCode: 503, statusMessage: 'Service temporairement indisponible.' })
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('events')
    .select(EVENT_DETAIL_SELECT)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle()

  if (error) {
    console.error('[api/events/:slug] erreur Supabase :', error)
    throw createError({ statusCode: 500, statusMessage: "Impossible de charger l'événement." })
  }
  if (!data) {
    throw createError({ statusCode: 404, statusMessage: 'Événement introuvable.' })
  }

  // Cache court : le stock restant évolue, mais 10 s suffisent à absorber un pic
  // de trafic (partage WhatsApp). La commande revalide toujours le stock en base.
  setHeader(event, 'Cache-Control', 'public, s-maxage=10, stale-while-revalidate=30')
  return data
})
