<script setup lang="ts">
import type { ObjectInfo, S3ObjectItem } from '../../shared/types'
import { api, unwrap } from '../composables/useApi'

const props = defineProps<{ item: S3ObjectItem | null }>()
const emit = defineEmits<{ close: [] }>()
const ops = useFileOps()

const loading = ref(false)
const info = ref<ObjectInfo | null>(null)
const error = ref('')

watch(
  () => props.item,
  async (item) => {
    info.value = null
    error.value = ''
    if (!item) return
    loading.value = true
    try {
      info.value = await unwrap(api().objectInfo(item.key))
    } catch (e: any) {
      error.value = e?.message ?? 'Ошибка'
    } finally {
      loading.value = false
    }
  },
  { immediate: true },
)
</script>

<template>
  <aside
    v-if="item"
    class="flex w-80 shrink-0 flex-col border-l border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
  >
    <div class="flex items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
      <h3 class="font-medium">Информация</h3>
      <button class="btn-ghost !px-2 !py-1" @click="emit('close')">✕</button>
    </div>

    <div class="flex-1 space-y-4 overflow-auto p-4 text-sm">
      <div class="flex flex-col items-center gap-2 py-2">
        <span class="text-5xl">{{ fileIcon(item.name) }}</span>
        <span class="break-all text-center font-medium">{{ item.name }}</span>
      </div>

      <p v-if="loading" class="text-slate-400">Загрузка…</p>
      <p v-else-if="error" class="text-rose-500">{{ error }}</p>

      <dl v-else-if="info" class="space-y-3">
        <div>
          <dt class="text-xs uppercase text-slate-400">Ключ</dt>
          <dd class="break-all">{{ info.key }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-slate-400">Размер</dt>
          <dd>{{ formatBytes(info.size) }} ({{ info.size }} Б)</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-slate-400">Тип</dt>
          <dd>{{ info.contentType || '—' }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-slate-400">Изменён</dt>
          <dd>{{ formatDate(info.lastModified) }}</dd>
        </div>
        <div>
          <dt class="text-xs uppercase text-slate-400">ETag</dt>
          <dd class="break-all">{{ info.etag || '—' }}</dd>
        </div>
        <div v-if="Object.keys(info.metadata).length">
          <dt class="text-xs uppercase text-slate-400">Метаданные</dt>
          <dd>
            <div v-for="(v, k) in info.metadata" :key="k" class="break-all">
              <span class="text-slate-400">{{ k }}:</span> {{ v }}
            </div>
          </dd>
        </div>
      </dl>

      <div class="flex flex-wrap gap-2 pt-2">
        <button class="btn-ghost" @click="ops.download(item)">⬇ Скачать</button>
        <button class="btn-ghost" @click="ops.copyLink(item)">🔗 Ссылка</button>
      </div>
    </div>
  </aside>
</template>
