<script setup lang="ts">
import type { S3ObjectItem } from '../../shared/types'

const emit = defineEmits<{
  preview: [item: S3ObjectItem]
  info: [item: S3ObjectItem]
}>()

const files = useFilesStore()
const ops = useFileOps()

function onRowClick(item: S3ObjectItem, e: MouseEvent) {
  if (e.shiftKey) files.selectRange(item.key)
  else files.toggleSelect(item.key)
}

const allSelected = computed(
  () => files.filteredFiles.length > 0 && files.filteredFiles.every((f) => files.isSelected(f.key)),
)
function toggleAll() {
  if (allSelected.value) files.clearSelection()
  else files.selectAll()
}
</script>

<template>
  <div class="flex-1 overflow-auto">
    <!-- Пустое состояние -->
    <div
      v-if="!files.loading && files.filteredFolders.length === 0 && files.filteredFiles.length === 0"
      class="flex h-full flex-col items-center justify-center gap-2 text-slate-400"
    >
      <span class="text-4xl">📂</span>
      <p>{{ files.filter ? 'Ничего не найдено' : 'Папка пуста' }}</p>
    </div>

    <!-- LIST -->
    <table v-else-if="files.viewMode === 'list'" class="w-full text-sm">
      <thead class="sticky top-0 z-10 bg-slate-100 text-left text-xs uppercase text-slate-500 dark:bg-slate-800">
        <tr>
          <th class="w-10 px-3 py-2">
            <input type="checkbox" :checked="allSelected" @change="toggleAll" />
          </th>
          <th class="px-3 py-2">Имя</th>
          <th class="w-28 px-3 py-2">Размер</th>
          <th class="w-44 px-3 py-2">Изменён</th>
          <th class="w-32 px-3 py-2 text-right">Действия</th>
        </tr>
      </thead>
      <tbody>
        <!-- Папки -->
        <tr
          v-for="folder in files.filteredFolders"
          :key="folder.prefix"
          class="cursor-pointer border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
          @dblclick="files.navigate(folder.prefix)"
        >
          <td class="px-3 py-2"></td>
          <td class="px-3 py-2" @click="files.navigate(folder.prefix)">
            <span class="flex items-center gap-2 font-medium">📁 {{ folder.name }}</span>
          </td>
          <td class="px-3 py-2 text-slate-400">—</td>
          <td class="px-3 py-2 text-slate-400">—</td>
          <td class="px-3 py-2 text-right">
            <button class="btn-ghost !px-2 !py-1" title="Удалить папку" @click.stop="ops.deleteFolder(folder)">🗑</button>
          </td>
        </tr>

        <!-- Файлы -->
        <tr
          v-for="item in files.filteredFiles"
          :key="item.key"
          class="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/50"
          :class="{ 'bg-indigo-50 dark:bg-indigo-950/40': files.isSelected(item.key) }"
        >
          <td class="px-3 py-2">
            <input
              type="checkbox"
              :checked="files.isSelected(item.key)"
              @click="onRowClick(item, $event)"
            />
          </td>
          <td class="cursor-pointer px-3 py-2" @click="emit('preview', item)">
            <span class="flex items-center gap-2">{{ fileIcon(item.name) }} {{ item.name }}</span>
          </td>
          <td class="px-3 py-2 text-slate-500">{{ formatBytes(item.size) }}</td>
          <td class="px-3 py-2 text-slate-500">{{ formatDate(item.lastModified) }}</td>
          <td class="px-3 py-2">
            <div class="flex justify-end gap-1">
              <button class="btn-ghost !px-2 !py-1" title="Предпросмотр" @click="emit('preview', item)">👁</button>
              <button class="btn-ghost !px-2 !py-1" title="Инфо" @click="emit('info', item)">ℹ</button>
              <button class="btn-ghost !px-2 !py-1" title="Скачать" @click="ops.download(item)">⬇</button>
              <button class="btn-ghost !px-2 !py-1" title="Ссылка" @click="ops.copyLink(item)">🔗</button>
              <button class="btn-ghost !px-2 !py-1" title="Переименовать" @click="ops.rename(item)">✎</button>
              <button class="btn-ghost !px-2 !py-1" title="Удалить" @click="ops.deleteFile(item)">🗑</button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <!-- GRID -->
    <div v-else class="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      <button
        v-for="folder in files.filteredFolders"
        :key="folder.prefix"
        class="card flex flex-col items-center gap-2 p-4 hover:border-indigo-400"
        @dblclick="files.navigate(folder.prefix)"
        @click="files.navigate(folder.prefix)"
      >
        <span class="text-4xl">📁</span>
        <span class="w-full truncate text-center text-xs">{{ folder.name }}</span>
      </button>
      <div
        v-for="item in files.filteredFiles"
        :key="item.key"
        class="card flex cursor-pointer flex-col items-center gap-2 p-4 hover:border-indigo-400"
        :class="{ 'ring-2 ring-indigo-500': files.isSelected(item.key) }"
        @click="onRowClick(item, $event)"
        @dblclick="emit('preview', item)"
      >
        <span class="text-4xl">{{ fileIcon(item.name) }}</span>
        <span class="w-full truncate text-center text-xs">{{ item.name }}</span>
        <span class="text-[10px] text-slate-400">{{ formatBytes(item.size) }}</span>
      </div>
    </div>

    <!-- Догрузка страницы -->
    <div v-if="files.isTruncated" class="flex justify-center p-4">
      <button class="btn-ghost" :disabled="files.loading" @click="files.loadMore()">
        {{ files.loading ? 'Загрузка…' : 'Показать ещё' }}
      </button>
    </div>
  </div>
</template>
