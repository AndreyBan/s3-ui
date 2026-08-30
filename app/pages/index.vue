<script setup lang="ts">
import type { S3ObjectItem } from '../../shared/types'

const profiles = useProfilesStore()
const files = useFilesStore()
const ops = useFileOps()
const { theme, toggle } = useTheme()
const { subscribe } = useUploads()

const previewItem = ref<S3ObjectItem | null>(null)
const infoItem = ref<S3ObjectItem | null>(null)
const showConvert = ref(false)

// Навигация к корню, как только появляется активный профиль.
watch(
  () => [profiles.loaded, profiles.activeId] as const,
  ([loaded, activeId]) => {
    if (loaded && activeId) files.navigate('')
  },
  { immediate: true },
)

onMounted(() => {
  subscribe()
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => window.removeEventListener('keydown', onKey))

function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA') return
  if (e.key === 'Delete' && files.selectedCount > 0) {
    e.preventDefault()
    ops.deleteSelected()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    files.selectAll()
  } else if (e.key === 'Escape') {
    files.clearSelection()
  }
}
</script>

<template>
  <div class="flex h-full flex-col">
    <!-- Шапка -->
    <header class="flex items-center gap-3 border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
      <h1 class="flex items-center gap-2 text-lg font-bold">
        <span class="text-indigo-500">☁</span> S3 UI
      </h1>
      <div class="ml-2"><ProfileSwitcher /></div>
      <div class="flex-1" />
      <button class="btn-ghost" :title="theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'" @click="toggle">
        {{ theme === 'dark' ? '☀' : '🌙' }}
      </button>
      <NuxtLink to="/profiles" class="btn-ghost">⚙ Профили</NuxtLink>
    </header>

    <!-- Нет профилей -->
    <div v-if="profiles.loaded && !profiles.hasProfiles" class="flex flex-1 flex-col items-center justify-center gap-4 text-center">
      <span class="text-6xl">🗄️</span>
      <div>
        <p class="text-lg font-semibold">Нет профилей подключения</p>
        <p class="text-slate-500">Добавьте профиль с кредами доступа к вашему S3-хранилищу.</p>
      </div>
      <NuxtLink to="/profiles" class="btn-primary">Создать профиль</NuxtLink>
    </div>

    <!-- Менеджер -->
    <template v-else>
      <!-- Панель инструментов -->
      <div class="flex flex-wrap items-center gap-2 border-b border-slate-200 px-4 py-2 dark:border-slate-800">
        <Breadcrumbs />
        <div class="flex-1" />

        <input
          v-model="files.filter"
          type="text"
          placeholder="Фильтр…"
          class="input !w-44 !py-1.5"
        />
        <button class="btn-ghost" title="Обновить" @click="files.refresh()">↻</button>
        <button class="btn-ghost" @click="ops.createFolder()">📁 Папка</button>
        <button
          class="btn-ghost"
          title="Конвертировать изображения в WebP/AVIF (рекурсивно)"
          @click="showConvert = true"
        >
          🖼 Конвертировать
        </button>
        <button class="btn-primary" @click="ops.uploadViaDialog()">⬆ Загрузить</button>
        <div class="mx-1 h-6 w-px bg-slate-200 dark:bg-slate-700" />
        <button
          class="btn-ghost"
          :title="files.viewMode === 'list' ? 'Сетка' : 'Список'"
          @click="files.viewMode = files.viewMode === 'list' ? 'grid' : 'list'"
        >
          {{ files.viewMode === 'list' ? '▦' : '☰' }}
        </button>
      </div>

      <!-- Панель выбора -->
      <div
        v-if="files.selectedCount > 0"
        class="flex items-center gap-2 border-b border-indigo-200 bg-indigo-50 px-4 py-2 text-sm dark:border-indigo-900 dark:bg-indigo-950/50"
      >
        <span class="font-medium">Выбрано: {{ files.selectedCount }}</span>
        <div class="flex-1" />
        <button class="btn-ghost" @click="ops.downloadSelected()">⬇ Скачать</button>
        <button class="btn-danger !py-1.5" @click="ops.deleteSelected()">🗑 Удалить</button>
        <button class="btn-ghost" @click="files.clearSelection()">Снять выбор</button>
      </div>

      <!-- Ошибка подключения -->
      <div v-if="files.error" class="border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
        ⚠ {{ files.error }}
      </div>

      <!-- Контент + панель информации -->
      <div class="flex flex-1 overflow-hidden">
        <UploadDropzone>
          <div v-if="files.loading && files.files.length === 0 && files.folders.length === 0" class="flex flex-1 items-center justify-center text-slate-400">
            Загрузка…
          </div>
          <FileTable v-else @preview="previewItem = $event" @info="infoItem = $event" />
        </UploadDropzone>
        <FileInfoPanel :item="infoItem" @close="infoItem = null" />
      </div>
    </template>

    <FilePreviewModal :item="previewItem" @close="previewItem = null" />
    <ImageConvertModal
      :open="showConvert"
      @close="showConvert = false"
      @confirm="(o) => { showConvert = false; ops.convertImages(o) }"
    />
    <UploadProgress />
  </div>
</template>
