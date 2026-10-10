<script setup lang="ts">
/**
 * Saisie d'un code à usage unique (6 chiffres) en cases séparées :
 * avance toute seule, Retour arrière recule, le collage d'un code complet
 * remplit toutes les cases, et `complete` est émis dès que la dernière
 * est remplie. Compatible remplissage automatique (iOS / Android).
 */
const props = withDefaults(defineProps<{ modelValue: string; length?: number; invalid?: boolean; disabled?: boolean; autofocus?: boolean }>(), { length: 6 })
const emit = defineEmits<{ (e: 'update:modelValue', v: string): void; (e: 'complete', v: string): void }>()

const inputs = ref<HTMLInputElement[]>([])
const digits = computed(() => Array.from({ length: props.length }, (_, i) => props.modelValue[i] ?? ''))

function setValue(v: string) {
  const clean = v.replace(/\D/g, '').slice(0, props.length)
  emit('update:modelValue', clean)
  if (clean.length === props.length) emit('complete', clean)
}
function focusAt(i: number) {
  inputs.value[Math.max(0, Math.min(props.length - 1, i))]?.focus()
}
function onInput(i: number, e: Event) {
  const raw = (e.target as HTMLInputElement).value.replace(/\D/g, '')
  const chars = props.modelValue.split('')
  if (!raw) {
    chars[i] = ''
    setValue(chars.join(''))
    return
  }
  // Plusieurs chiffres d'un coup (remplissage automatique) : on les répartit
  for (let k = 0; k < raw.length && i + k < props.length; k++) chars[i + k] = raw[k]
  setValue(chars.join('').slice(0, props.length))
  focusAt(i + raw.length)
  ;(e.target as HTMLInputElement).value = chars[i] ?? ''
}
function onKeydown(i: number, e: KeyboardEvent) {
  if (e.key === 'Backspace' && !digits.value[i]) {
    e.preventDefault()
    const chars = props.modelValue.split('')
    chars[i - 1] = ''
    setValue(chars.join(''))
    focusAt(i - 1)
  } else if (e.key === 'ArrowLeft') focusAt(i - 1)
  else if (e.key === 'ArrowRight') focusAt(i + 1)
}
function onPaste(e: ClipboardEvent) {
  e.preventDefault()
  setValue(e.clipboardData?.getData('text') ?? '')
  focusAt(Math.min(props.length - 1, (e.clipboardData?.getData('text') ?? '').replace(/\D/g, '').length))
}
onMounted(() => {
  if (props.autofocus) nextTick(() => focusAt(0))
})
defineExpose({ focus: () => focusAt(0) })
</script>

<template>
  <div class="flex justify-center gap-2 sm:gap-2.5" :class="invalid ? 'otp-shake' : ''" role="group" aria-label="Code à 6 chiffres">
    <input
      v-for="(d, i) in digits"
      :key="i"
      :ref="(el) => { if (el) inputs[i] = el as HTMLInputElement }"
      :value="d"
      type="text"
      inputmode="numeric"
      pattern="[0-9]*"
      :autocomplete="i === 0 ? 'one-time-code' : 'off'"
      maxlength="6"
      :disabled="disabled"
      :aria-label="`Chiffre ${i + 1}`"
      class="h-14 w-11 border bg-tikeo-surface text-center font-display text-2xl font-extrabold text-tikeo-black transition-all duration-200 focus:outline-none sm:h-16 sm:w-12"
      :class="invalid ? 'border-tikeo-error' : d ? 'border-tikeo-ink dark:border-[#FF7A00]' : 'border-tikeo-border'"
      style="caret-color: #ff7a00"
      @input="onInput(i, $event)"
      @keydown="onKeydown(i, $event)"
      @paste="onPaste"
      @focus="($event.target as HTMLInputElement).select()"
    />
  </div>
</template>

<style>
.otp-shake {
  animation: otp-shake 0.4s cubic-bezier(0.36, 0.07, 0.19, 0.97);
}
@keyframes otp-shake {
  10%, 90% { transform: translateX(-1px); }
  20%, 80% { transform: translateX(3px); }
  30%, 50%, 70% { transform: translateX(-5px); }
  40%, 60% { transform: translateX(5px); }
}
</style>
