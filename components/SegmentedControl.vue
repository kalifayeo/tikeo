<script setup lang="ts">
// Sélecteur à plusieurs choix exclusifs (thème, taille du texte...). Le choix
// actif se remplit immédiatement : l'effet est visible tout de suite.
interface Option {
  value: string
  label: string
  icon?: string
}
const props = defineProps<{ modelValue: string; options: Option[]; ariaLabel?: string }>()
const emit = defineEmits<{ 'update:modelValue': [string] }>()
const { buzz } = useUiPrefs()

function pick(v: string) {
  if (v === props.modelValue) return
  buzz(10)
  emit('update:modelValue', v)
}
</script>

<template>
  <div class="inline-flex max-w-full border border-tikeo-border bg-tikeo-surface-alt p-0.5" role="radiogroup" :aria-label="ariaLabel">
    <button
      v-for="o in options"
      :key="o.value"
      type="button"
      role="radio"
      :aria-checked="modelValue === o.value"
      class="flex h-9 min-w-[2.75rem] items-center justify-center gap-1.5 px-3 text-[13px] font-bold transition-all duration-200 active:scale-95"
      :class="
        modelValue === o.value
          ? 'bg-tikeo-ink text-white shadow-card dark:bg-[#FF7A00] dark:text-tikeo-ink'
          : 'text-tikeo-gray-text hover:text-tikeo-black'
      "
      @click="pick(o.value)"
    >
      <AppIcon v-if="o.icon" :name="o.icon" class="h-4 w-4" />
      <span>{{ o.label }}</span>
    </button>
  </div>
</template>
