<script setup lang="ts">
/**
 * Pastille de statut (point + libellé en capitales) aux couleurs du site.
 * `tone` : success (vert), warning (orange), error (rouge), info (bleu),
 * neutral (gris). Utilisée par toutes les listes de l'administration.
 */
withDefaults(defineProps<{ tone?: 'success' | 'warning' | 'error' | 'info' | 'neutral'; strike?: boolean }>(), { tone: 'neutral' })
</script>

<template>
  <span class="org-status" :class="[`pill-${tone}`, strike ? 'line-through' : '']"><slot /></span>
</template>
