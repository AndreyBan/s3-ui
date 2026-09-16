import type { ImageConvertOptions, S3ObjectItem, S3PrefixItem } from '../../shared/types'
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

  async function uploadFolderViaDialog() {
    try {
      const dirs = await unwrap(api().pickFoldersToUpload())
      if (!dirs.length) return
      await uploadFromPaths(dirs)
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка выбора папки')
    }
  }

  /**
   * Общий пайплайн загрузки путей с диска (файлы и папки): dup-check по basename,
   * confirm при совпадениях, uploadPaths, обновление списка.
   */
  async function uploadFromPaths(paths: string[]) {
    if (!paths.length) return
    const existing: string[] = []
    for (const p of paths) {
      const name = p.split(/[\\/]/).pop() ?? p
      // Renderer не знает, файл это или папка — проверяем оба варианта.
      const dupe =
        (await unwrap(api().exists(files.prefix + name))) ||
        (await unwrap(api().prefixExists(files.prefix + name + '/')))
      if (dupe) existing.push(name)
    }
    if (existing.length) {
      const proceed = await confirm({
        title: 'Совпадение имён',
        message:
          `Уже существуют:\n${existing.join('\n')}\n\n` +
          'Содержимое папок будет объединено, совпадающие файлы перезаписаны. Продолжить?',
        confirmLabel: 'Продолжить',
        danger: true,
      })
      if (!proceed) return
    }
    try {
      const { uploaded, markers } = await unwrap(api().uploadPaths(files.prefix, paths))
      toast.success(
        `Загружено файлов: ${uploaded}` + (markers ? `, пустых папок: ${markers}` : ''),
      )
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка загрузки')
    }
  }

  /**
   * Вставка из буфера обмена (Ctrl+V): файлы/папки, скопированные в файловом менеджере.
   * Сначала File-объекты из paste-события (Windows/macOS, даёт полный список),
   * затем чтение буфера в main (Linux: пути/URI из текстового представления).
   */
  async function pasteFromClipboard(dt?: DataTransfer | null) {
    // File-объекты собираем синхронно: после await clipboardData инвалидируется.
    const paths: string[] = []
    for (const f of Array.from(dt?.files ?? [])) {
      const p = api().getPathForFile(f)
      if (p) paths.push(p)
    }
    try {
      if (!paths.length) paths.push(...(await unwrap(api().clipboardFilePaths())))
      if (!paths.length) {
        toast.info('В буфере обмена нет файлов')
        return
      }
      await uploadFromPaths(paths)
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка вставки из буфера')
    }
  }

  /** Загрузка перетащенных файлов/папок: по пути с диска, иначе fallback на байты. */
  async function uploadDropped(items: { file: File; isDirectory: boolean }[]) {
    if (!items.length) return
    const paths: string[] = []
    const noPath: File[] = []
    for (const item of items) {
      const p = api().getPathForFile(item.file)
      if (p) paths.push(p)
      // Без пути на диске папку не загрузить; файл (напр. картинка из браузера) — байтами.
      else if (!item.isDirectory) noPath.push(item.file)
    }
    await uploadFromPaths(paths)
    if (noPath.length) await uploadBlobs(noPath)
  }

  /** Fallback для File без пути на диске: читаем байты и шлём в main. */
  async function uploadBlobs(fileList: File[]) {
    const dup: string[] = []
    for (const f of fileList) {
      if (await unwrap(api().exists(files.prefix + f.name))) dup.push(f.name)
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

  async function convertImages(options: ImageConvertOptions) {
    try {
      toast.info('Конвертация запущена…')
      const r = await unwrap(api().convertImages(files.prefix, options))
      if (r.total === 0) {
        toast.info('В этой папке нет jpg/png для конвертации')
      } else {
        toast.success(
          `Готово: создано ${r.converted}, пропущено ${r.skipped}` +
            (r.deleted ? `, удалено оригиналов ${r.deleted}` : '') +
            (r.failed ? `, ошибок ${r.failed}` : ''),
        )
      }
      await files.refresh()
    } catch (e: any) {
      toast.error(e?.message ?? 'Ошибка конвертации')
    }
  }

  return {
    createFolder,
    uploadViaDialog,
    uploadFolderViaDialog,
    uploadPaths,
    uploadDropped,
    pasteFromClipboard,
    download,
    downloadSelected,
    deleteFile,
    deleteFolder,
    deleteSelected,
    rename,
    copyLink,
    convertImages,
  }
}
