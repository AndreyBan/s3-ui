<script setup lang="ts">
const { toasts, dismiss } = useToast()

const styles: Record<string, string> = {
  success: 'border-emerald-500/40 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200',
  error: 'border-rose-500/40 bg-rose-50 text-rose-800 dark:bg-rose-950 dark:text-rose-200',
  info: 'border-sky-500/40 bg-sky-50 text-sky-800 dark:bg-sky-950 dark:text-sky-200',
}
const icons: Record<string, string> = { success: '✓', error: '✕', info: 'ℹ' }
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="t in toasts"
          :key="t.id"
          class="flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg"
          :class="styles[t.type]"
        >
          <span class="mt-0.5 font-bold">{{ icons[t.type] }}</span>
          <span class="flex-1 whitespace-pre-line">{{ t.message }}</span>
          <button class="opacity-60 hover:opacity-100" @click="dismiss(t.id)">✕</button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}
.toast-enter-from {
  opacity: 0;
  transform: translateX(20px);
}
.toast-leave-to {
  opacity: 0;
  transform: translateX(20px);
}
</style>
