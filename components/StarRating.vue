<script setup lang="ts">
/**
 * Note de 1 à 5 étoiles. Interactive (survol qui remplit, clic avec « pop »,
 * flèches du clavier) ou en lecture seule (`readonly`).
 */
const props = withDefaults(defineProps<{ modelValue?: number; readonly?: boolean; size?: 'sm' | 'md' | 'lg' }>(), {
  modelValue: 0,
  readonly: false,
  size: 'md',
})
const emit = defineEmits<{ 'update:modelValue': [number] }>()
const { t } = useI18n()
const { buzz } = useUiPrefs()

const hover = ref(0)
const popped = ref(0)
const shown = computed(() => (props.readonly ? props.modelValue : hover.value || props.modelValue))
const cls = computed(() => ({ sm: 'h-4 w-4', md: 'h-6 w-6', lg: 'h-9 w-9 md:h-10 md:w-10' })[props.size])

function pick(n: number) {
  if (props.readonly) return
  buzz(10)
  popped.value = n
  setTimeout(() => (popped.value = 0), 350)
  emit('update:modelValue', n)
}
function onKey(e: KeyboardEvent) {
  if (props.readonly) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
    e.preventDefault()
    pick(Math.min(5, (props.modelValue || 0) + 1))
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
    e.preventDefault()
    pick(Math.max(1, (props.modelValue || 1) - 1))
  }
}
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5"
    :role="readonly ? 'img' : 'radiogroup'"
    :aria-label="readonly ? t('feedback.ratingOf', { n: modelValue }) : t('feedback.yourRating')"
    @mouseleave="hover = 0"
    @keydown="onKey"
  >
    <component
      :is="readonly ? 'span' : 'button'"
      v-for="n in 5"
      :key="n"
      :type="readonly ? undefined : 'button'"
      :role="readonly ? undefined : 'radio'"
      :aria-checked="readonly ? undefined : modelValue === n"
      :aria-label="readonly ? undefined : t('feedback.starsAria', { n })"
      :tabindex="readonly ? undefined : modelValue === n || (!modelValue && n === 1) ? 0 : -1"
      class="inline-flex text-[#FF7A00] transition-transform duration-150"
      :class="[readonly ? '' : 'cursor-pointer hover:scale-110 active:scale-95', popped === n ? 'tk-pop' : '']"
      @mouseenter="!readonly && (hover = n)"
      @click="pick(n)"
    >
      <svg :class="[cls, n <= shown ? '' : 'opacity-30']" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M12 2.8l2.75 5.78 6.3.82-4.6 4.36 1.14 6.26L12 17l-5.59 3.02 1.14-6.26-4.6-4.36 6.3-.82z"
          :fill="n <= shown ? 'currentColor' : 'none'"
          stroke="currentColor"
          stroke-width="1.6"
          stroke-linejoin="round"
        />
      </svg>
    </component>
  </div>
</template>
