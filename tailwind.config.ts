import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  darkMode: 'class',
  content: [
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './app.vue',
  ],
  theme: {
    extend: {
      colors: {
        tikeo: {
          orange: 'rgb(var(--tikeo-orange) / <alpha-value>)',
          // Nuance foncée de la MÊME teinte que tikeo-orange (juste la
          // luminosité qui baisse), pour les états hover/active — plutôt que
          // le orange-600 générique de Tailwind, dont la teinte est différente
          // (plus rouge) et jure visuellement à côté de l'orange de marque.
          'orange-dark': 'rgb(var(--tikeo-orange-dark) / <alpha-value>)',
          blue: 'rgb(var(--tikeo-blue) / <alpha-value>)',
          'blue-dark': 'rgb(var(--tikeo-blue-dark) / <alpha-value>)',
          surface: 'rgb(var(--tikeo-surface) / <alpha-value>)',
          'surface-alt': 'rgb(var(--tikeo-surface-alt) / <alpha-value>)',
          border: 'rgb(var(--tikeo-border) / <alpha-value>)',
          white: 'rgb(var(--tikeo-surface) / <alpha-value>)',
          'gray-light': 'rgb(var(--tikeo-surface-alt) / <alpha-value>)',
          'gray-text': 'rgb(var(--tikeo-text-secondary) / <alpha-value>)',
          black: 'rgb(var(--tikeo-text-primary) / <alpha-value>)',
          success: '#16A34A',
          error: '#DC2626',
        },
      },
      fontFamily: {
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'tikeo-gradient': 'linear-gradient(135deg, #FF7A00 0%, #FF9A3D 45%, #0057B8 100%)',
        'tikeo-brand': 'linear-gradient(90deg, #FF7A00 0%, #0057B8 100%)',
      },
      maxWidth: {
        // Conteneur principal du site : plus large que le max-w-7xl (1280px)
        // par défaut de Tailwind, pour éviter les grandes marges vides sur
        // les écrans larges (desktop 1440px+, ultra-wide).
        'tikeo-container': '1600px',
      },
      borderRadius: {
        // Style "carré" demandé (comme Tikerama) : plus aucun arrondi sur les
        // blocs (cartes événement, images, bannières, champs, catégories).
        card: '0px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(17, 24, 39, 0.06)',
        'card-hover': '0 8px 24px rgba(17, 24, 39, 0.12)',
      },
    },
  },
  plugins: [],
}
