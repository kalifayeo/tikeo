<script setup lang="ts">
// Barre de navigation du bas (mobile) des espaces Admin et Organisateur :
// même famille visuelle que la barre du site public (MobileBottomNav) —
// barre flottante, élément actif orangé, bouton central en dégradé de marque.
//  - `items`  : les accès (lien `to`, ou `action: true` pour un bouton qui émet « action »)
//  - `center` : bouton d'action principal, placé au milieu (ex. « Créer »)
interface NavItem {
  label: string
  icon: string
  to?: string
  active?: boolean
  badge?: number | null
  action?: boolean
}
const props = defineProps<{
  items: NavItem[]
  center?: { to: string; label: string; icon: string }
  ariaLabel?: string
}>()
const emit = defineEmits<{ (e: 'action', item: NavItem): void }>()

const NuxtLinkC = resolveComponent('NuxtLink')

const slots = computed(() => {
  const list: Array<{ kind: 'item'; item: NavItem } | { kind: 'center' }> = props.items.map((item) => ({ kind: 'item', item }))
  if (props.center) list.splice(Math.ceil(props.items.length / 2), 0, { kind: 'center' })
  return list
})

function badgeText(n: number) {
  return n > 99 ? '99+' : String(n)
}
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-30 px-3 pb-[calc(env(safe-area-inset-bottom)+10px)] pt-1.5 md:hidden" :aria-label="ariaLabel">
    <div class="mx-auto flex max-w-md items-stretch justify-between border border-tikeo-border bg-tikeo-surface/95 px-1.5 py-1 shadow-card-hover backdrop-blur">
      <template v-for="slot in slots" :key="slot.kind === 'item' ? slot.item.label : 'center'">
        <!-- Bouton central -->
        <NuxtLink v-if="slot.kind === 'center'" :to="center!.to" :aria-label="center!.label" class="relative flex flex-1 items-start justify-center">
          <span class="dash-center -mt-6 flex h-14 w-14 items-center justify-center bg-tikeo-brand text-white shadow-card-hover ring-4 ring-tikeo-surface transition-transform duration-200 active:scale-90">
            <AppIcon :name="center!.icon" class="h-7 w-7" :stroke="2.4" />
          </span>
        </NuxtLink>

        <!-- Accès classiques -->
        <component
          :is="slot.item.to && !slot.item.action ? NuxtLinkC : 'button'"
          v-else
          v-bind="slot.item.to && !slot.item.action ? { to: slot.item.to } : { type: 'button' }"
          class="relative flex min-w-0 flex-1 flex-col items-center gap-0.5 px-0.5 pb-1 pt-2 text-[10px] font-semibold leading-tight transition-colors duration-200 active:bg-tikeo-surface-alt"
          :class="slot.item.active ? 'bg-tikeo-orange/10 text-tikeo-orange' : 'text-tikeo-gray-text'"
          :aria-current="slot.item.active ? 'page' : undefined"
          @click="slot.item.action ? emit('action', slot.item) : undefined"
        >
          <span v-if="slot.item.active" class="dash-line absolute inset-x-3 top-0 h-[3px] bg-[#FF7A00]" aria-hidden="true" />
          <span class="relative flex h-6 w-6 items-center justify-center transition-transform duration-200" :class="slot.item.active ? '-translate-y-px scale-110' : ''">
            <AppIcon :name="slot.item.icon" class="h-[22px] w-[22px]" :stroke="slot.item.active ? 2.2 : 1.8" />
            <span
              v-if="slot.item.badge"
              :key="slot.item.badge"
              class="dash-pop absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#FF7A00] px-1 text-[9px] font-bold leading-none text-tikeo-ink ring-2 ring-tikeo-surface"
            >{{ badgeText(slot.item.badge) }}</span>
          </span>
          <span class="max-w-full truncate">{{ slot.item.label }}</span>
        </component>
      </template>
    </div>
  </nav>
</template>

<style scoped>
.dash-line {
  transform-origin: center;
  animation: dash-line 0.3s ease-out both;
}
@keyframes dash-line {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}
.dash-pop {
  animation: dash-pop 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes dash-pop {
  from {
    transform: scale(0.4);
  }
  to {
    transform: scale(1);
  }
}
@media (prefers-reduced-motion: reduce) {
  .dash-line,
  .dash-pop {
    animation: none;
  }
}
</style>
