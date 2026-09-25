<script setup lang="ts">
const { t } = useI18n()
definePageMeta({ middleware: 'auth' })
</script>

<template>
  <PageComingSoon :title="t('placeholderPages.wallet')" :description="t('placeholderPages.walletDesc')" />
</template>
