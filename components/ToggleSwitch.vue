<script setup lang="ts">
// Switch générique (préférences de notifications, etc.), même principe
// visuel que ThemeToggle.vue mais sans icônes et réutilisable partout.
const props = withDefaults(defineProps<{ modelValue: boolean; ariaLabel?: string; disabled?: boolean }>(), {
  disabled: false,
})
const emit = defineEmits<{ 'update:modelValue': [boolean] }>()

function toggle() {
  if (props.disabled) return
  emit('update:modelValue', !props.modelValue)
}
</script>

<template>
  <button
    type="button"
    class="relative flex h-6 w-11 shrink-0 items-center rounded-full border border-tikeo-border px-0.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
    :class="modelValue ? 'bg-tikeo-orange border-tikeo-orange' : 'bg-tikeo-surface-alt'"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="ariaLabel"
    :disabled="disabled"
    @click="toggle"
  >
    <span
      class="h-5 w-5 rounded-full bg-white shadow-card transition-transform duration-200"
      :class="modelValue ? 'translate-x-[19px]' : 'translate-x-0'"
    />
  </button>
</template>
