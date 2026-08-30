<script setup lang="ts">
import type { ImageConvertOptions, ImageFormat } from '../../shared/types'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'confirm', options: ImageConvertOptions): void
}>()

const webp = ref(true)
const avif = ref(false)
const quality = ref(80)
const optimize = ref(true)
const deleteOriginals = ref(false)

const canConfirm = computed(() => webp.value || avif.value)

// Сброс к значениям по умолчанию при каждом открытии.
watch(
  () => props.open,
  (open) => {
    if (open) {
      webp.value = true
      avif.value = false
      quality.value = 80
      optimize.value = true
      deleteOriginals.value = false
    }
  },
)

function confirm() {
  if (!canConfirm.value) return
  const formats: ImageFormat[] = []
  if (webp.value) formats.push('webp')
  if (avif.value) formats.push('avif')
  emit('confirm', {
    formats,
    quality: quality.value,
    optimize: optimize.value,
    deleteOriginals: deleteOriginals.value,
  })
}
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
        @click.self="emit('close')"
      >
        <div class="card w-full max-w-md p-6">
          <h3 class="text-lg font-semibold">Конвертировать изображения</h3>
          <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Рекурсивно обрабатываются jpg/png в текущей папке и вложенных. Уже
            сконвертированные файлы пропускаются.
          </p>

          <div class="mt-5 space-y-4">
            <div>
              <div class="mb-1.5 text-sm font-medium">Форматы</div>
              <div class="flex gap-4">
                <label class="flex items-center gap-2 text-sm">
                  <input v-model="webp" type="checkbox" class="h-4 w-4" /> WebP
                </label>
                <label class="flex items-center gap-2 text-sm">
                  <input v-model="avif" type="checkbox" class="h-4 w-4" /> AVIF
                </label>
              </div>
            </div>

            <div>
              <div class="mb-1.5 flex items-center justify-between text-sm font-medium">
                <span>Качество</span>
                <span class="tabular-nums text-slate-500">{{ quality }}%</span>
              </div>
              <input
                v-model.number="quality"
                type="range"
                min="1"
                max="100"
                class="w-full"
              />
            </div>

            <label class="flex items-center gap-2 text-sm">
              <input v-model="optimize" type="checkbox" class="h-4 w-4" />
              Максимальная оптимизация (медленнее)
            </label>

            <label class="flex items-center gap-2 text-sm text-rose-600 dark:text-rose-400">
              <input v-model="deleteOriginals" type="checkbox" class="h-4 w-4" />
              Удалить оригиналы (jpg/png) после конвертации
            </label>
          </div>

          <div class="mt-6 flex justify-end gap-2">
            <button class="btn-ghost" @click="emit('close')">Отмена</button>
            <button class="btn-primary" :disabled="!canConfirm" @click="confirm">
              Конвертировать
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
