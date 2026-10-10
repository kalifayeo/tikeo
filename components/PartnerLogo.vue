<script setup lang="ts">
/**
 * Logo d'un partenaire dans un cadre blanc carré. Sans logo (ou si l'image ne
 * charge pas), on affiche les initiales sur un aplat encre : la grille ne
 * montre jamais de case cassée.
 */
import type { Partner } from '~/types/database'
import { partnerInitials } from '~/composables/usePartners'

const props = defineProps<{ partner: Pick<Partner, 'name' | 'logo_url'> }>()
const failed = ref(false)
watch(() => props.partner.logo_url, () => (failed.value = false))
</script>

<template>
  <span class="flex h-full w-full items-center justify-center overflow-hidden bg-white">
    <img
      v-if="partner.logo_url && !failed"
      :src="partner.logo_url"
      :alt="partner.name"
      loading="lazy"
      decoding="async"
      class="max-h-full max-w-full object-contain p-3"
      @error="failed = true"
    />
    <span v-else class="flex h-full w-full items-center justify-center bg-tikeo-ink font-display text-2xl font-extrabold tracking-tight text-white" aria-hidden="true">
      {{ partnerInitials(partner.name) }}
    </span>
  </span>
</template>
