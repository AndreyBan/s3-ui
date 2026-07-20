<script setup lang="ts">
const { state, answer } = useConfirm()
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="answer(false)"
      >
        <div class="card w-full max-w-md p-6">
          <h3 class="text-lg font-semibold">{{ state.title }}</h3>
          <p class="mt-2 whitespace-pre-line text-sm text-slate-600 dark:text-slate-300">
            {{ state.message }}
          </p>
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn-ghost" @click="answer(false)">{{ state.cancelLabel }}</button>
            <button
              :class="state.danger ? 'btn-danger' : 'btn-primary'"
              @click="answer(true)"
            >
              {{ state.confirmLabel }}
            </button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
