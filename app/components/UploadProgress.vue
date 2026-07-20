<script setup lang="ts">
const { transfers, percent } = useUploads()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="transfers.length"
      class="card fixed bottom-4 left-4 z-40 w-80 overflow-hidden p-3"
    >
      <p class="mb-2 text-xs font-semibold uppercase text-slate-400">Передачи</p>
      <div class="space-y-2">
        <div v-for="t in transfers" :key="t.id">
          <div class="flex justify-between text-xs">
            <span class="truncate">{{ t.name }}</span>
            <span :class="t.error ? 'text-rose-500' : 'text-slate-400'">
              {{ t.error ? 'ошибка' : t.done ? '✓' : percent(t) + '%' }}
            </span>
          </div>
          <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              class="h-full rounded-full transition-all"
              :class="t.error ? 'bg-rose-500' : t.done ? 'bg-emerald-500' : 'bg-indigo-500'"
              :style="{ width: (t.done ? 100 : percent(t)) + '%' }"
            />
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
