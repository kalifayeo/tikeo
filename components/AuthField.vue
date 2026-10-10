<script setup lang="ts">
/**
 * Champ de formulaire des pages d'authentification : libellé en capitales au
 * dessus, champ carré 48 px (bordure orange au focus), et un œil pour
 * afficher / masquer le mot de passe. Les attributs natifs (name,
 * autocomplete, required, maxlength, placeholder, class…) vont sur l'<input>.
 */
defineOptions({ inheritAttrs: false })
const props = defineProps<{ modelValue: string; label: string; type?: string; hint?: string }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>()
const { t } = useI18n()

const show = ref(false)
const isPassword = computed(() => props.type === 'password')
const inputType = computed(() => (isPassword.value && show.value ? 'text' : props.type || 'text'))
</script>

<template>
  <label class="block">
    <span class="acc-label mb-1.5 block">{{ label }}</span>
    <span class="relative block">
      <input
        v-bind="$attrs"
        :type="inputType"
        :value="modelValue"
        class="field-input"
        :class="isPassword ? 'pr-12' : ''"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <button
        v-if="isPassword"
        type="button"
        class="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-tikeo-gray-text transition-colors hover:text-tikeo-black"
        :aria-label="show ? t('authLayout.hidePassword') : t('authLayout.showPassword')"
        @click.prevent="show = !show"
      >
        <AppIcon :name="show ? 'eye-off' : 'eye'" class="h-5 w-5" />
      </button>
    </span>
    <span v-if="hint" class="mt-1.5 block text-xs text-tikeo-gray-text">{{ hint }}</span>
  </label>
</template>
