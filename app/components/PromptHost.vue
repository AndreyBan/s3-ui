<script setup lang="ts">
const { state, submit, cancel } = usePrompt()
const inputRef = ref<HTMLInputElement | null>(null)

// Автофокус и выделение при открытии.
watch(
  () => state.open,
  async (open) => {
    if (open) {
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    }
  },
)
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="state.open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="cancel"
      >
        <div class="card w-full max-w-md p-6">
          <h3 class="text-lg font-semibold">{{ state.title }}</h3>
          <p v-if="state.message" class="mt-1 text-sm text-slate-500">{{ state.message }}</p>
          <input
            ref="inputRef"
            v-model="state.value"
            class="input mt-4"
            :placeholder="state.placeholder"
            @keydown.enter.prevent="submit"
            @keydown.esc.prevent="cancel"
          />
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn-ghost" @click="cancel">{{ state.cancelLabel }}</button>
            <button class="btn-primary" :disabled="!state.value.trim()" @click="submit">
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
