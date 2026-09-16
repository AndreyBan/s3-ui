<script setup lang="ts">
const ops = useFileOps()
const dragging = ref(false)
let depth = 0

function onEnter(e: DragEvent) {
  if (!e.dataTransfer?.types.includes('Files')) return
  depth++
  dragging.value = true
}
function onLeave() {
  depth = Math.max(0, depth - 1)
  if (depth === 0) dragging.value = false
}
function onOver(e: DragEvent) {
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}
async function onDrop(e: DragEvent) {
  depth = 0
  dragging.value = false
  // Собираем строго синхронно: после первого await dataTransfer.items инвалидируется.
  const dropped = Array.from(e.dataTransfer?.items ?? [])
    .map((it) => ({
      file: it.getAsFile(),
      isDirectory: it.webkitGetAsEntry()?.isDirectory ?? false,
    }))
    .filter((d): d is { file: File; isDirectory: boolean } => d.file !== null)
  if (dropped.length) await ops.uploadDropped(dropped)
}
</script>

<template>
  <div
    class="relative flex flex-1 flex-col overflow-hidden"
    @dragenter.prevent="onEnter"
    @dragleave.prevent="onLeave"
    @dragover.prevent="onOver"
    @drop.prevent="onDrop"
  >
    <slot />
    <div
      v-if="dragging"
      class="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-4 border-dashed border-indigo-500 bg-indigo-500/10 backdrop-blur-sm"
    >
      <div class="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-indigo-600 shadow-lg dark:bg-slate-900">
        ⬆ Отпустите, чтобы загрузить сюда
      </div>
    </div>
  </div>
</template>
