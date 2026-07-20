import type { S3ObjectItem, S3PrefixItem } from '../../shared/types'
import { api, unwrap } from './useApi'

/** Централизованные операции над файлами: тосты, подтверждения, обновление списка. */
export function useFileOps() {
  const files = useFilesStore()
  const toast = useToast()
  const { confirm } = useConfirm()
  const { prompt } = usePrompt()

  async function createFolder() {
    const name = (await prompt({
      title: 'Новая папка',
      placeholder: 'Имя папки',
      confirmLabel: 'Создать',
    }))?.trim()
    if (!name) return
    const prefix = files.prefix + name.replace(/\/+$/, '') + '/'
    try {
      await unwrap(api().createFolder(prefix))
      toast.success('Папка создана')
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Не удалось создать папку')
    }
  }

  async function uploadViaDialog() {
    try {
      const paths = await unwrap(api().pickFilesToUpload())
      if (!paths.length) return
      await uploadPaths(paths)
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка выбора файлов')
    }
  }

  async function uploadPaths(paths: string[]) {
    // Проверка перезаписи для файлов с существующими именами.
    const existing: string[] = []
    for (const p of paths) {
      const name = p.split(/[\\/]/).pop() ?? p
      const ok = await unwrap(api().exists(files.prefix + name))
      if (ok) existing.push(name)
    }
    if (existing.length) {
      const proceed = await confirm({
        title: 'Перезаписать файлы?',
        message: `Уже существуют:\n${existing.join('\n')}\n\nЗагрузить и перезаписать?`,
        confirmLabel: 'Перезаписать',
        danger: true,
      })
      if (!proceed) return
    }
    try {
      const { uploaded } = await unwrap(api().uploadFiles(files.prefix, paths))
      toast.success(`Загружено файлов: ${uploaded}`)
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка загрузки')
    }
  }

  /** Загрузка перетащенных файлов (drag-and-drop): читаем байты и шлём в main. */
  async function uploadDropped(fileList: File[]) {
    if (!fileList.length) return
    const existing = fileList.map((f) => f.name)
    const dup: string[] = []
    for (const name of existing) {
      if (await unwrap(api().exists(files.prefix + name))) dup.push(name)
    }
    if (dup.length) {
      const proceed = await confirm({
        title: 'Перезаписать файлы?',
        message: `Уже существуют:\n${dup.join('\n')}\n\nЗагрузить и перезаписать?`,
        confirmLabel: 'Перезаписать',
        danger: true,
      })
      if (!proceed) return
    }
    try {
      const payloads = await Promise.all(
        fileList.map(async (f) => ({ name: f.name, data: await f.arrayBuffer() })),
      )
      const { uploaded } = await unwrap(api().uploadData(files.prefix, payloads))
      toast.success(`Загружено файлов: ${uploaded}`)
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка загрузки')
    }
  }

  async function download(item: S3ObjectItem) {
    try {
      const res = await unwrap(api().downloadObject(item.key))
      if (res.saved) toast.success(`Сохранено: ${res.path}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка скачивания')
    }
  }

  async function downloadSelected() {
    const keys = files.selectedKeys
    if (!keys.length) return
    try {
      const res = await unwrap(api().downloadObjects(keys))
      if (res.saved) toast.success(`Сохранено файлов: ${res.saved} → ${res.dir}`)
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка скачивания')
    }
  }

  async function deleteFile(item: S3ObjectItem) {
    const ok = await confirm({
      title: 'Удалить файл?',
      message: item.name,
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok) return
    try {
      await unwrap(api().deleteObjects([item.key]))
      toast.success('Файл удалён')
      files.selection.delete(item.key)
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка удаления')
    }
  }

  async function deleteFolder(folder: S3PrefixItem) {
    const ok = await confirm({
      title: 'Удалить папку?',
      message: `«${folder.name}» и всё её содержимое будут удалены безвозвратно.`,
      confirmLabel: 'Удалить всё',
      danger: true,
    })
    if (!ok) return
    try {
      const { deleted } = await unwrap(api().deletePrefix(folder.prefix))
      toast.success(`Удалено объектов: ${deleted}`)
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка удаления папки')
    }
  }

  async function deleteSelected() {
    const keys = files.selectedKeys
    if (!keys.length) return
    const ok = await confirm({
      title: 'Удалить выбранные файлы?',
      message: `Будет удалено файлов: ${keys.length}`,
      confirmLabel: 'Удалить',
      danger: true,
    })
    if (!ok) return
    try {
      const { deleted } = await unwrap(api().deleteObjects(keys))
      toast.success(`Удалено файлов: ${deleted}`)
      files.clearSelection()
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка удаления')
    }
  }

  async function rename(item: S3ObjectItem) {
    const newName = (await prompt({
      title: 'Переименовать файл',
      initialValue: item.name,
      confirmLabel: 'Переименовать',
    }))?.trim()
    if (!newName || newName === item.name) return
    const destKey = files.prefix + newName
    try {
      if (await unwrap(api().exists(destKey))) {
        const ok = await confirm({
          title: 'Файл существует',
          message: `«${newName}» уже есть. Перезаписать?`,
          confirmLabel: 'Перезаписать',
          danger: true,
        })
        if (!ok) return
      }
      await unwrap(api().moveObject(item.key, destKey))
      toast.success('Переименовано')
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка переименования')
    }
  }

  async function copyLink(item: S3ObjectItem) {
    try {
      const url = await unwrap(api().presignUrl(item.key, 3600))
      await navigator.clipboard.writeText(url)
      toast.success('Ссылка (1 час) скопирована в буфер')
    } catch (e: any) {
      toast.error(e?.message ?? 'Не удалось создать ссылку')
    }
  }

  return {
    createFolder,
    uploadViaDialog,
    uploadPaths,
    uploadDropped,
    download,
    downloadSelected,
    deleteFile,
    deleteFolder,
    deleteSelected,
    rename,
    copyLink,
  }
}
