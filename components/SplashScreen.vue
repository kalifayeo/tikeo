<script setup lang="ts">
/**
 * Écran de démarrage : le logo Tikeo s'affiche plein écran dès l'ouverture du
 * lien / du site, avec en dessous le même loader orange que celui des boutons
 * et des pages de chargement du site (components/TikeoSpinner.vue), puis
 * s'efface en fondu pour révéler la page d'accueil.
 *
 * - Rendu côté serveur : il est dans le HTML initial, donc visible avant même
 *   que le JavaScript soit chargé (pas de flash de la page d'accueil).
 * - Une fois par visite (onglet / lancement de l'app) : si l'on actualise ou
 *   navigue ensuite, il ne revient pas. Le script inline de nuxt.config.ts
 *   pose `data-splash-seen` avant le premier affichage pour éviter tout flash.
 * - Respecte « réduire les animations ».
 */
const SEEN_KEY = 'tikeo:splash-seen'
const MIN_VISIBLE_MS = 1100
const FADE_MS = 450

const visible = ref(true)
const leaving = ref(false)

onMounted(() => {
  let seen = false
  try {
    seen = sessionStorage.getItem(SEEN_KEY) === '1'
  } catch {
    /* stockage indisponible : on affiche l'écran une fois par chargement */
  }
  if (seen) {
    visible.value = false
    return
  }
  try {
    sessionStorage.setItem(SEEN_KEY, '1')
  } catch {
    /* ignoré */
  }
  setTimeout(() => {
    leaving.value = true
    setTimeout(() => (visible.value = false), FADE_MS)
  }, MIN_VISIBLE_MS)
})
</script>

<template>
  <div
    v-if="visible"
    id="tikeo-splash"
    class="tikeo-splash"
    :class="{ 'tikeo-splash--leaving': leaving }"
    role="presentation"
    aria-hidden="true"
  >
    <img src="/logo-tikeo.png" alt="" class="tikeo-splash__logo" width="720" height="232" fetchpriority="high" decoding="async" />
    <TikeoSpinner class="tikeo-splash__spinner" :size="34" />
  </div>
</template>

<style>
/* Styles non « scoped » : l'écran doit être stylé dès le HTML serveur. */
.tikeo-splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 28px;
  background: #ffffff;
  transition: opacity 0.45s ease, visibility 0.45s ease;
}
html.dark .tikeo-splash {
  background: #111111;
}
.tikeo-splash--leaving {
  opacity: 0;
  visibility: hidden;
  pointer-events: none;
}
html[data-splash-seen] .tikeo-splash {
  display: none;
}
.tikeo-splash__logo {
  width: min(220px, 62vw);
  height: auto;
  animation: tikeo-splash-pop 0.7s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}
@keyframes tikeo-splash-pop {
  0% { opacity: 0; transform: scale(0.82); }
  100% { opacity: 1; transform: scale(1); }
}
@media (prefers-reduced-motion: reduce) {
  .tikeo-splash__logo, .tikeo-splash__spinner { animation: none; }
  .tikeo-splash { transition-duration: 0.01s; }
}
</style>
