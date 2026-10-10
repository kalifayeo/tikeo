import type { RouterConfig } from '@nuxt/schema'

// Sans ceci, un défilement horizontal ou vertical resté actif sur une page
// (ex. le tableau de bord admin, plus large que la page d'accueil) pouvait
// rester visible une fraction de seconde après une redirection (par ex.
// /admin -> / quand le rôle n'est pas admin), donnant l'impression d'une
// page "mélangée". On force systématiquement un retour en haut à gauche.
export default <RouterConfig>{
  scrollBehavior(_to, _from, savedPosition) {
    if (savedPosition) return savedPosition
    return { left: 0, top: 0 }
  },
}
