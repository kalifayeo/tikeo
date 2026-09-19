<script setup lang="ts">
const { t } = useI18n()
const { csrfHeader } = useCsrf()

const form = reactive({ fullName: '', email: '', subject: '', message: '', website: '' })
const sending = ref(false)
const successMessage = ref(false)
const errorMessage = ref('')

async function handleSubmit() {
  errorMessage.value = ''
  successMessage.value = false
  sending.value = true
  try {
    await $fetch('/api/contact', {
      method: 'POST',
      headers: await csrfHeader(),
      body: {
        fullName: form.fullName.trim(),
        email: form.email.trim().toLowerCase(),
        subject: form.subject.trim(),
        message: form.message.trim(),
        website: form.website, // honeypot : doit rester vide (champ masqué en CSS)
      },
    })
    successMessage.value = true
    form.fullName = ''
    form.email = ''
    form.subject = ''
    form.message = ''
  } catch (e: any) {
    errorMessage.value = e?.data?.statusMessage || e?.message || t('contactPage.errorMessage')
  } finally {
    sending.value = false
  }
}

const infoItems = computed(() => [
  {
    label: t('contactPage.infoEmailLabel'),
    value: t('contactPage.infoEmail'),
    href: `mailto:${t('contactPage.infoEmail')}`,
    icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  },
  {
    label: t('contactPage.infoPhoneLabel'),
    value: t('contactPage.infoPhone'),
    href: `tel:${t('contactPage.infoPhone').replace(/\s+/g, '')}`,
    icon: 'M3 5a2 2 0 012-2h2.28a1 1 0 01.97.76l1.1 4.42a1 1 0 01-.5 1.13l-1.7.85a11.05 11.05 0 005.52 5.52l.85-1.7a1 1 0 011.13-.5l4.42 1.1a1 1 0 01.76.97V19a2 2 0 01-2 2h-1C9.72 21 3 14.28 3 6V5z',
  },
  {
    label: t('contactPage.infoAddressLabel'),
    value: t('contactPage.infoAddress'),
    icon: 'M12 21s7-6.5 7-11a7 7 0 10-14 0c0 4.5 7 11 7 11zM12 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5z',
  },
  {
    label: t('contactPage.infoHoursLabel'),
    value: t('contactPage.infoHours'),
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  },
])

const socialLinks = [
  { name: 'Facebook', href: 'https://facebook.com/tikeo', path: 'M13.5 9H15V6h-1.5C11.6 6 10 7.6 10 9.5V11H8.5v3H10v6h3v-6h2l.5-3H13v-1c0-.6.4-1 1-1z' },
  {
    name: 'Instagram',
    href: 'https://instagram.com/tikeo',
    path: 'M12 8.2a3.8 3.8 0 100 7.6 3.8 3.8 0 000-7.6zm0 6.3a2.5 2.5 0 110-5 2.5 2.5 0 010 5zm4.85-6.45a.9.9 0 11-1.8 0 .9.9 0 011.8 0zM12 5.6c-1.8 0-2 0-2.8.05-.7.03-1.2.15-1.6.32a3.2 3.2 0 00-1.15.75c-.36.36-.58.72-.75 1.15-.17.4-.29.9-.32 1.6C5.3 10.1 5.3 10.3 5.3 12s0 1.9.05 2.7c.03.7.15 1.2.32 1.6.17.43.4.79.75 1.15.36.36.72.58 1.15.75.4.17.9.29 1.6.32.8.05 1 .05 2.83.05s2 0 2.8-.05c.7-.03 1.2-.15 1.6-.32.43-.17.79-.4 1.15-.75.36-.36.58-.72.75-1.15.17-.4.29-.9.32-1.6.05-.8.05-1 .05-2.8s0-2-.05-2.8c-.03-.7-.15-1.2-.32-1.6a3.2 3.2 0 00-.75-1.15 3.2 3.2 0 00-1.15-.75c-.4-.17-.9-.29-1.6-.32-.8-.05-1-.05-2.8-.05z',
  },
  { name: 'TikTok', href: 'https://tiktok.com/@tikeo', path: 'M16.6 5.8a4.3 4.3 0 01-2.6-1V14a4.9 4.9 0 11-4.9-4.9c.2 0 .4 0 .6.03v2.2a2.7 2.7 0 102.2 2.66V2h2.1a4.3 4.3 0 002.6 3.4v.4z' },
  {
    name: 'LinkedIn',
    href: 'https://linkedin.com/company/tikeo',
    path: 'M6.94 8.5H4.56V19h2.38V8.5zM5.75 4.5a1.38 1.38 0 100 2.76 1.38 1.38 0 000-2.76zM19.5 19h-2.38v-5.4c0-1.29-.46-2.17-1.6-2.17-.88 0-1.4.6-1.63 1.17-.08.2-.1.49-.1.77V19H11.4s.03-9.4 0-10.5h2.38v1.49a2.37 2.37 0 012.15-1.19c1.57 0 2.75 1.03 2.75 3.23V19z',
  },
]
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-10 md:py-16">
    <!-- En-tête centré -->
    <div class="mx-auto mb-10 max-w-lg text-center">
      <span class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-tikeo-orange/10 text-tikeo-orange">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-6l-4 4v-4z" />
        </svg>
      </span>
      <h1 class="text-2xl font-extrabold text-tikeo-black md:text-3xl">{{ t('contactPage.title') }}</h1>
      <p class="mt-3 text-sm text-tikeo-gray-text md:text-base">{{ t('contactPage.intro') }}</p>
    </div>

    <!-- Infos de contact : cartes centrées, 2x2 -->
    <div class="mx-auto mb-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-2">
      <component
        :is="item.href ? 'a' : 'div'"
        v-for="item in infoItems"
        :key="item.label"
        :href="item.href"
        class="flex items-center gap-3 border border-tikeo-border bg-tikeo-surface p-4 transition"
        :class="item.href ? 'hover:border-tikeo-orange' : ''"
      >
        <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-tikeo-orange/10 text-tikeo-orange">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.8">
            <path stroke-linecap="round" stroke-linejoin="round" :d="item.icon" />
          </svg>
        </span>
        <span class="min-w-0">
          <span class="block text-[11px] font-medium uppercase tracking-wide text-tikeo-gray-text">{{ item.label }}</span>
          <span class="block truncate text-sm font-semibold text-tikeo-black">{{ item.value }}</span>
        </span>
      </component>
    </div>

    <!-- Formulaire -->
    <div class="mx-auto max-w-2xl border border-tikeo-border bg-tikeo-surface p-6 md:p-8">
      <h2 class="mb-5 text-center text-base font-bold text-tikeo-black">{{ t('contactPage.formTitle') }}</h2>

      <p v-if="successMessage" class="mb-4 border border-tikeo-success/30 bg-tikeo-success/10 px-4 py-3 text-center text-sm text-tikeo-success">
        {{ t('contactPage.successMessage') }}
      </p>
      <p v-if="errorMessage" class="mb-4 border border-tikeo-error/30 bg-tikeo-error/10 px-4 py-3 text-center text-sm text-tikeo-error">
        {{ errorMessage }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Honeypot anti-spam : invisible et non atteignable au clavier pour un
             humain, mais rempli par la plupart des robots de soumission automatique. -->
        <div class="hidden" aria-hidden="true">
          <label for="website">Site web</label>
          <input id="website" v-model="form.website" type="text" tabindex="-1" autocomplete="off" />
        </div>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('contactPage.formName') }}</label>
            <input v-model="form.fullName" type="text" required class="input-field w-full" />
          </div>
          <div>
            <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('contactPage.formEmail') }}</label>
            <input v-model="form.email" type="email" required class="input-field w-full" />
          </div>
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('contactPage.formSubject') }}</label>
          <input v-model="form.subject" type="text" required class="input-field w-full" />
        </div>
        <div>
          <label class="mb-1 block text-xs font-medium text-tikeo-gray-text">{{ t('contactPage.formMessage') }}</label>
          <textarea v-model="form.message" rows="5" required class="input-field w-full resize-none"></textarea>
        </div>
        <button type="submit" class="btn-primary w-full" :disabled="sending">
          {{ sending ? t('contactPage.formSending') : t('contactPage.formSubmit') }}
        </button>
      </form>
    </div>

    <!-- Réseaux sociaux + FAQ -->
    <div class="mx-auto mt-8 flex max-w-2xl flex-col items-center gap-4">
      <div class="flex items-center gap-3">
        <a
          v-for="s in socialLinks"
          :key="s.name"
          :href="s.href"
          target="_blank"
          rel="noopener"
          :aria-label="s.name"
          class="flex h-9 w-9 items-center justify-center rounded-full border border-tikeo-border text-tikeo-gray-text transition hover:border-tikeo-orange hover:text-tikeo-orange"
        >
          <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path :d="s.path" /></svg>
        </a>
      </div>
      <NuxtLink
        to="/faq"
        class="w-full border border-dashed border-tikeo-border p-4 text-center text-sm text-tikeo-gray-text hover:border-tikeo-orange hover:text-tikeo-orange"
      >
        {{ t('contactPage.faqLinkText') }}
      </NuxtLink>
    </div>
  </div>
</template>
