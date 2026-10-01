/**
 * Directive v-reveal : anime l'apparition d'un élément quand il entre dans
 * le viewport en scrollant (IntersectionObserver), plutôt qu'un effet au
 * survol — pour que l'animation soit aussi perceptible sur mobile, où le
 * survol n'existe pas.
 *
 * IMPORTANT : ce plugin doit être universel (pas de suffixe .client), sinon
 * la directive n'existe pas côté serveur et le rendu SSR plante ("Cannot
 * read properties of undefined (reading 'getSSRProps')") dès qu'une page
 * utilisant v-reveal est rendue côté serveur. getSSRProps() ci-dessous
 * renvoie simplement un style de départ neutre (invisible + décalé), que le
 * navigateur reprend ensuite via `mounted` pour l'animation réelle.
 *
 * Utilisation : <div v-reveal>...</div>
 * Optionnel, un délai en ms pour échelonner plusieurs éléments :
 *   <div v-reveal="100">...</div>
 */
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.directive('reveal', {
    getSSRProps(binding) {
      const delay = typeof binding.value === 'number' ? binding.value : 0
      return {
        style: `opacity:0;transform:translateY(24px);transition:opacity 0.5s var(--ease-tikeo) ${delay}ms, transform 0.5s var(--ease-tikeo) ${delay}ms`,
      }
    },
    mounted(el: HTMLElement, binding) {
      if (typeof window === 'undefined') return

      const delay = typeof binding.value === 'number' ? binding.value : 0
      el.style.opacity = '0'
      el.style.transform = 'translateY(24px)'
      el.style.transition = `opacity 0.5s var(--ease-tikeo) ${delay}ms, transform 0.5s var(--ease-tikeo) ${delay}ms`

      // Respecte les préférences d'accessibilité (animations réduites).
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.style.opacity = '1'
        el.style.transform = 'none'
        return
      }

      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              el.style.opacity = '1'
              el.style.transform = 'translateY(0)'
              observer.unobserve(el)
            }
          }
        },
        { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
      )
      observer.observe(el)
    },
  })
})
