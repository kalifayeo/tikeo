<script setup lang="ts">
// Avatar générique : affiche la photo de profil (profiles.avatar_url) si
// elle existe, sinon les initiales sur fond de couleur — utilisé partout
// où on montre l'utilisateur (header desktop/mobile, menu compte...).
withDefaults(
  defineProps<{
    avatarUrl?: string | null
    initials: string
    sizeClass?: string
    textClass?: string
  }>(),
  { sizeClass: 'h-9 w-9', textClass: 'text-sm' }
)
</script>

<template>
  <img
    v-if="avatarUrl"
    :src="avatarUrl"
    alt=""
    class="shrink-0 rounded-full border border-tikeo-border object-cover"
    :class="sizeClass"
  />
  <span
    v-else
    class="flex shrink-0 items-center justify-center rounded-full bg-tikeo-brand font-bold text-white"
    :class="[sizeClass, textClass]"
  >
    {{ initials }}
  </span>
</template>
