<script setup lang="ts">
const { init } = useTheme()
const profiles = useProfilesStore()

onMounted(async () => {
  init()
  await profiles.load()
})
</script>

<template>
  <div class="flex h-full flex-col">
    <NuxtPage />
    <ToastHost />
    <ConfirmHost />
    <PromptHost />
  </div>
</template>
