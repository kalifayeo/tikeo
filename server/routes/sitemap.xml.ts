import { createClient } from '@supabase/supabase-js'

/**
 * GET /sitemap.xml — pages publiques + tous les événements publiés.
 *
 * Généré à la demande avec la clé anon (les événements publiés sont lisibles
 * publiquement via la RLS) et mis en cache 1 h côté CDN. Les URL d'événements
 * utilisent la forme canonique /e/<slug> sur le domaine racine (les liens
 * himra.tikeo.com restent des raccourcis de partage qui pointent, via la
 * balise canonical, vers cette URL — un sitemap ne peut lister que des URL
 * de son propre hôte).
 */
const STATIC_PAGES: Array<{ path: string; changefreq: string; priority: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/evenements', changefreq: 'daily', priority: '0.9' },
  { path: '/organisateur/tarifs', changefreq: 'monthly', priority: '0.6' },
  { path: '/faq', changefreq: 'monthly', priority: '0.5' },
  { path: '/qui-sommes-nous', changefreq: 'monthly', priority: '0.4' },
  { path: '/contact', changefreq: 'yearly', priority: '0.4' },
  { path: '/conditions', changefreq: 'yearly', priority: '0.2' },
  { path: '/confidentialite', changefreq: 'yearly', priority: '0.2' },
]

function xmlEscape(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const origin = getSiteOrigin(event)

  setHeader(event, 'Content-Type', 'application/xml; charset=utf-8')
  setHeader(event, 'Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400')

  const entries: string[] = STATIC_PAGES.map(
    (p) =>
      `  <url><loc>${xmlEscape(origin + p.path)}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`
  )

  if (config.public.supabaseUrl && config.public.supabaseAnonKey) {
    try {
      const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      })
      const { data, error } = await supabase
        .from('events')
        .select('slug, updated_at')
        .eq('status', 'published')
        .order('start_date', { ascending: false })
        .limit(5000)
      if (error) throw error

      for (const e of data ?? []) {
        if (!e.slug) continue
        const lastmod = e.updated_at ? `<lastmod>${new Date(e.updated_at).toISOString()}</lastmod>` : ''
        entries.push(
          `  <url><loc>${xmlEscape(`${origin}/e/${encodeURIComponent(e.slug)}`)}</loc>${lastmod}<changefreq>daily</changefreq><priority>0.8</priority></url>`
        )
      }
    } catch (err) {
      // On sert quand même les pages statiques : un sitemap partiel vaut mieux qu'une erreur 500.
      console.error('[sitemap.xml] impossible de lister les événements :', err)
    }
  }

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join('\n')}\n</urlset>\n`
})
