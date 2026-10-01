<script setup lang="ts">
/**
 * Champ image à deux modes, utilisé partout où le site demandait
 * auparavant une simple URL (affiche d'événement, plan de salle, logo
 * d'organisateur, bannière d'accueil) :
 *   - « Depuis mon ordinateur » : le fichier part dans le bucket Storage
 *     "media" et le champ récupère l'URL publique renvoyée ;
 *   - « Lien internet » : on colle une URL externe, comme avant.
 *
 * Dans les deux cas, le parent ne reçoit qu'une chaîne (v-model) : aucun
 * formulaire appelant n'a à savoir d'où vient l'image.
 */
import { ACCEPTED_DOCUMENT_TYPES, ACCEPTED_IMAGE_TYPES, type MediaFolder } from '~/composables/useMediaUpload'

const props = withDefaults(
  defineProps<{
    modelValue: string
    folder: MediaFolder
    label?: string
    placeholder?: string
    help?: string
    /** Autorise aussi le PDF (utile pour les plans de salle). */
    allowPdf?: boolean
    /** Aperçu compact (logo, vignette) plutôt que large (affiche). */
    compact?: boolean
    /** Masque l'URL brute sous l'aperçu (photo de profil, logo...). */
    hideUrl?: boolean
  }>(),
  { allowPdf: false, compact: false, hideUrl: false }
)

const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { t } = useI18n()
const { uploading, uploadFile } = useMediaUpload()

const mode = ref<'upload' | 'url'>('upload')
const uploadError = ref('')
const dragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

const acceptedTypes = computed(() =>
  props.allowPdf ? [...ACCEPTED_IMAGE_TYPES, ...ACCEPTED_DOCUMENT_TYPES] : ACCEPTED_IMAGE_TYPES
)
const acceptAttr = computed(() => acceptedTypes.value.join(','))

const urlValue = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v),
})

const isPdf = computed(() => /\.pdf(\?|#|$)/i.test(props.modelValue))
const hasValue = computed(() => Boolean(props.modelValue?.trim()))

async function handleFiles(files: FileList | null) {
  uploadError.value = ''
  const file = files?.[0]
  if (!file) return
  try {
    const url = await uploadFile(file, props.folder, { accept: acceptedTypes.value })
    emit('update:modelValue', url)
  } catch (e: any) {
    // Les codes renvoyés par useMediaUpload ont une traduction dédiée ;
    // pour tout le reste (réseau, policy Storage), message générique.
    const code = e?.message
    uploadError.value =
      code === 'unsupportedType'
        ? t('mediaInput.errorType')
        : code === 'tooLarge'
          ? t('mediaInput.errorSize')
          : t('mediaInput.errorUpload')
  } finally {
    if (fileInput.value) fileInput.value.value = ''
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  handleFiles(e.dataTransfer?.files ?? null)
}

function clearValue() {
  emit('update:modelValue', '')
  uploadError.value = ''
}
</script>

<template>
  <div>
    <label v-if="label" class="mb-1.5 block text-xs font-medium text-tikeo-gray-text">{{ label }}</label>

    <!-- Choix du mode -->
    <div class="mb-2 flex gap-1">
      <button
        type="button"
        class="border px-3 py-1.5 text-xs font-medium transition"
        :class="mode === 'upload' ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border text-tikeo-gray-text hover:text-tikeo-black'"
        @click="mode = 'upload'"
      >
        {{ t('mediaInput.tabUpload') }}
      </button>
      <button
        type="button"
        class="border px-3 py-1.5 text-xs font-medium transition"
        :class="mode === 'url' ? 'border-tikeo-orange bg-tikeo-orange/10 text-tikeo-orange' : 'border-tikeo-border text-tikeo-gray-text hover:text-tikeo-black'"
        @click="mode = 'url'"
      >
        {{ t('mediaInput.tabUrl') }}
      </button>
    </div>

    <!-- Mode « depuis mon ordinateur » : clic ou glisser-déposer -->
    <div
      v-if="mode === 'upload'"
      class="flex cursor-pointer flex-col items-center justify-center border border-dashed px-4 py-5 text-center transition"
      :class="dragging ? 'border-tikeo-orange bg-tikeo-orange/5' : 'border-tikeo-border hover:border-tikeo-orange/60'"
      role="button"
      tabindex="0"
      @click="fileInput?.click()"
      @keydown.enter.prevent="fileInput?.click()"
      @keydown.space.prevent="fileInput?.click()"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="fileInput"
        type="file"
        class="hidden"
        :accept="acceptAttr"
        @change="handleFiles(($event.target as HTMLInputElement).files)"
      />
      <svg class="mb-2 h-6 w-6 text-tikeo-gray-text" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 16V4m0 0L8 8m4-4l4 4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
      </svg>
      <p class="text-xs font-medium text-tikeo-black">
        {{ uploading ? t('mediaInput.uploading') : t('mediaInput.dropzone') }}
      </p>
      <p class="mt-0.5 text-[11px] text-tikeo-gray-text">
        {{ allowPdf ? t('mediaInput.hintWithPdf') : t('mediaInput.hint') }}
      </p>
    </div>

    <!-- Mode « lien internet » -->
    <input
      v-else
      v-model="urlValue"
      type="url"
      class="input-field w-full"
      :placeholder="placeholder || t('mediaInput.urlPlaceholder')"
    />

    <p v-if="uploadError" class="mt-1.5 border border-tikeo-error/30 bg-tikeo-error/10 px-2.5 py-1.5 text-xs text-tikeo-error">
      {{ uploadError }}
    </p>
    <p v-if="help" class="mt-1 text-xs text-tikeo-gray-text">{{ help }}</p>

    <!-- Aperçu du média retenu, quel que soit le mode -->
    <div v-if="hasValue" class="mt-2 flex items-start gap-3 border border-tikeo-border bg-tikeo-surface-alt p-2">
      <a v-if="isPdf" :href="modelValue" target="_blank" rel="noopener" class="flex items-center gap-2 text-xs font-medium text-tikeo-orange">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.6">
          <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6M7 3h7l5 5v11a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z" />
        </svg>
        {{ t('mediaInput.previewPdf') }}
      </a>
      <img
        v-else
        :src="modelValue"
        alt=""
        class="shrink-0 border border-tikeo-border object-cover"
        :class="compact ? 'h-12 w-12' : 'h-16 w-24'"
      />
      <p v-if="!hideUrl" class="min-w-0 flex-1 break-all text-[11px] text-tikeo-gray-text">{{ modelValue }}</p>
      <button
        type="button"
        class="shrink-0 p-1 text-tikeo-gray-text hover:text-tikeo-error"
        :class="{ 'ml-auto': hideUrl }"
        :aria-label="t('mediaInput.remove')"
        @click="clearValue"
      >
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  </div>
</template>
