import { defineStore } from 'pinia'
import type { S3ObjectItem, S3PrefixItem } from '../../shared/types'
import { api, unwrap } from '../composables/useApi'

export const useFilesStore = defineStore('files', {
  state: () => ({
    prefix: '' as string, // текущая «папка», '' == корень
    folders: [] as S3PrefixItem[],
    files: [] as S3ObjectItem[],
    continuationToken: null as string | null,
    isTruncated: false,
    loading: false,
    error: '' as string,
    selection: new Set<string>(), // выбранные ключи файлов
    lastClickedKey: null as string | null, // для shift-select диапазона
    viewMode: 'list' as 'list' | 'grid',
    filter: '' as string, // фильтр по имени в текущей папке
  }),
  getters: {
    // Хлебные крошки из текущего префикса.
    breadcrumbs: (s) => {
      const parts = s.prefix.split('/').filter(Boolean)
      const crumbs: { name: string; prefix: string }[] = [{ name: 'Корень', prefix: '' }]
      let acc = ''
      for (const part of parts) {
        acc += part + '/'
        crumbs.push({ name: part, prefix: acc })
      }
      return crumbs
    },
    filteredFolders: (s): S3PrefixItem[] => {
      if (!s.filter) return s.folders
      const q = s.filter.toLowerCase()
      return s.folders.filter((f) => f.name.toLowerCase().includes(q))
    },
    filteredFiles: (s): S3ObjectItem[] => {
      if (!s.filter) return s.files
      const q = s.filter.toLowerCase()
      return s.files.filter((f) => f.name.toLowerCase().includes(q))
    },
    selectedKeys: (s): string[] => Array.from(s.selection),
    selectedCount: (s): number => s.selection.size,
  },
  actions: {
    async navigate(prefix: string) {
      this.prefix = prefix
      this.clearSelection()
      this.filter = ''
      await this.refresh()
    },
    async refresh() {
      this.loading = true
      this.error = ''
      try {
        const res = await unwrap(api().list(this.prefix, null))
        this.folders = res.folders
        this.files = res.files
        this.continuationToken = res.continuationToken
        this.isTruncated = res.isTruncated
      } catch (e: any) {
        this.error = e?.message ?? 'Ошибка загрузки'
        this.folders = []
        this.files = []
      } finally {
        this.loading = false
      }
    },
    async loadMore() {
      if (!this.continuationToken || this.loading) return
      this.loading = true
      try {
        const res = await unwrap(api().list(this.prefix, this.continuationToken))
        this.folders.push(...res.folders)
        this.files.push(...res.files)
        this.continuationToken = res.continuationToken
        this.isTruncated = res.isTruncated
      } catch (e: any) {
        this.error = e?.message ?? 'Ошибка загрузки'
      } finally {
        this.loading = false
      }
    },
    // --- Выбор ---
    toggleSelect(key: string) {
      if (this.selection.has(key)) this.selection.delete(key)
      else this.selection.add(key)
      this.lastClickedKey = key
    },
    selectRange(key: string) {
      const keys = this.filteredFiles.map((f) => f.key)
      const from = this.lastClickedKey ? keys.indexOf(this.lastClickedKey) : -1
      const to = keys.indexOf(key)
      if (from < 0 || to < 0) {
        this.toggleSelect(key)
        return
      }
      const [a, b] = from < to ? [from, to] : [to, from]
      for (let i = a; i <= b; i++) this.selection.add(keys[i]!)
      this.lastClickedKey = key
    },
    selectAll() {
      for (const f of this.filteredFiles) this.selection.add(f.key)
    },
    clearSelection() {
      this.selection.clear()
      this.lastClickedKey = null
    },
    isSelected(key: string): boolean {
      return this.selection.has(key)
    },
  },
})
