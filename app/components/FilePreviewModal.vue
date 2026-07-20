<script setup lang="ts">
import type { S3ObjectItem } from '../../shared/types'
import { api, unwrap } from '../composables/useApi'

const props = defineProps<{ item: S3ObjectItem | null }>()
const emit = defineEmits<{ close: [] }>()

const loading = ref(false)
const error = ref('')
const preview = ref<{ kind: 'image' | 'pdf' | 'text'; content: string } | null>(null)

watch(
  () => props.item,
  async (item) => {
    preview.value = null
    error.value = ''
    if (!item) return
    loading.value = true
    try {
      preview.value = await unwrap(api().previewObject(item.key))
    } catch (e: any) {
      error.value = e?.message ?? 'Не удалось загрузить предпросмотр'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') emit('close')
}
onMounted(() => window.addEventListener('keydown', onKey))
onUnmounted(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="item"
      class="fixed inset-0 z-50 flex flex-col bg-black/70 p-6"
      @click.self="emit('close')"
    >
      <div class="card mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden">
        <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <h3 class="flex items-center gap-2 truncate font-medium">
            {{ fileIcon(item.name) }} {{ item.name }}
          </h3>
          <button class="btn-ghost !px-2 !py-1" @click="emit('close')">✕</button>
        </div>

        <div class="flex flex-1 items-center justify-center overflow-auto bg-slate-100 p-4 dark:bg-slate-950">
          <p v-if="loading" class="text-slate-400">Загрузка…</p>
          <p v-else-if="error" class="text-rose-500">{{ error }}</p>

          <img
            v-else-if="preview?.kind === 'image'"
            :src="preview.content"
            :alt="item.name"
            class="max-h-full max-w-full object-contain"
          />
          <iframe
            v-else-if="preview?.kind === 'pdf'"
            :src="preview.content"
            class="h-full w-full rounded bg-white"
          />
          <pre
            v-else-if="preview?.kind === 'text'"
            class="h-full w-full overflow-auto rounded bg-white p-4 text-left text-xs leading-relaxed dark:bg-slate-900"
          >{{ preview.content }}</pre>
        </div>
      </div>
    </div>
  </Teleport>
</template>
