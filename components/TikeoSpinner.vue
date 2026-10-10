<script setup lang="ts">
/**
 * Le loader orange du site (anneau pâle + arc qui tourne) — le même dessin
 * que celui des pages de paiement (pages/commande/[id]/retour.vue) et du
 * chargement de l'espace organisateur, en composant réutilisable :
 * écran de démarrage, page de maintenance, boutons « en cours »…
 */
withDefaults(defineProps<{ size?: number }>(), { size: 24 })
</script>

<template>
  <svg
    class="animate-spin text-tikeo-orange"
    :style="{ width: `${size}px`, height: `${size}px` }"
    fill="none"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
  </svg>
</template>
