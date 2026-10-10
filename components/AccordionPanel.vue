<script setup lang="ts">
// Bloc repliable (profil et paramètres) : un clic sur l'en-tête déplie ou
// replie le contenu avec une animation de hauteur. `tone="danger"` pour la
// zone de suppression du compte. L'état est pilotable (v-model:open).
const props = withDefaults(
  defineProps<{ title: string; subtitle?: string; icon: string; tone?: 'brand' | 'danger'; summary?: string }>(),
  { tone: 'brand' }
)
const open = defineModel<boolean>('open', { default: true })
const { buzz } = useUiPrefs()
const uid = useId()

function toggle() {
  buzz(8)
  open.value = !open.value
}
</script>

<template>
  <section class="tk-acc" :class="props.tone === 'danger' ? 'border border-tikeo-error/30 bg-tikeo-surface shadow-card' : 'acc-panel'">
    <h2 class="m-0">
      <button
        type="button"
        class="group flex w-full items-center gap-3 px-4 py-4 text-left md:px-5"
        :class="open ? (props.tone === 'danger' ? 'border-b border-tikeo-error/20' : 'border-b border-tikeo-border') : ''"
        :aria-expanded="open"
        :aria-controls="`${uid}-body`"
        @click="toggle"
      >
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center transition-transform duration-300 group-hover:-rotate-6"
          :class="props.tone === 'danger' ? 'bg-tikeo-error text-white' : 'bg-[#FF7A00] text-tikeo-ink'"
        >
          <AppIcon :name="icon" class="h-5 w-5" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block font-display text-lg font-extrabold tracking-tight text-tikeo-black">{{ title }}</span>
          <span v-if="subtitle" class="block text-xs font-normal text-tikeo-gray-text">{{ subtitle }}</span>
        </span>
        <span v-if="summary && !open" class="hidden max-w-[40%] truncate text-xs font-semibold text-tikeo-gray-text sm:block">{{ summary }}</span>
        <AppIcon name="chevron-down" class="h-5 w-5 shrink-0 text-tikeo-gray-text transition-transform duration-300" :class="open ? 'rotate-180' : ''" :stroke="2.4" />
      </button>
    </h2>
    <div :id="`${uid}-body`" class="tk-acc__body" :class="open ? 'tk-acc__body--open' : ''">
      <div class="tk-acc__inner">
        <slot />
      </div>
    </div>
  </section>
</template>

<style scoped>
.tk-acc__body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.34s var(--ease-tikeo);
}
.tk-acc__body--open {
  grid-template-rows: 1fr;
}
.tk-acc__inner {
  min-height: 0;
  overflow: hidden;
}
.tk-acc__body:not(.tk-acc__body--open) .tk-acc__inner {
  visibility: hidden;
  transition: visibility 0s linear 0.34s;
}
</style>
