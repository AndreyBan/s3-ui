import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import type {
  ImageConvertOptions,
  ImageConvertResult,
  IpcResult,
  ObjectInfo,
  ListResult,
  ProgressEvent,
  S3ProfileInput,
  S3ProfileMeta,
} from '../shared/types'
import * as convert from './convert'
import * as s3 from './s3'
import * as store from './store'

// Обёртка: любой хендлер возвращает унифицированный IpcResult с понятной ошибкой.
function handle<T>(
  channel: string,
  fn: (...args: any[]) => Promise<T> | T,
): void {
  ipcMain.handle(channel, async (_e, ...args): Promise<IpcResult<T>> => {
    try {
      const data = await fn(...args)
      return { ok: true, data }
    } catch (err: any) {
      return {
        ok: false,
        error: humanizeError(err),
        code: err?.name ?? err?.Code,
      }
    }
  })
}

function humanizeError(err: any): string {
  const name = err?.name ?? ''
  const msg = err?.message ?? String(err)
  if (name === 'CredentialsProviderError' || name === 'InvalidAccessKeyId') {
    return 'Неверный Access Key. Проверьте креды профиля.'
  }
  if (name === 'SignatureDoesNotMatch') {
    return 'Неверный Secret Key (подпись не совпала).'
  }
  if (name === 'NoSuchBucket') {
    return 'Бакет не найден. Проверьте имя бакета и регион.'
  }
  if (name === 'AccessDenied') {
    return 'Доступ запрещён. Проверьте права ключа.'
  }
  if (name === 'NetworkingError' || /fetch failed|ECONNREFUSED|ENOTFOUND|getaddrinfo/i.test(msg)) {
    return 'Не удалось подключиться к эндпоинту. Проверьте endpoint и доступность хранилища.'
  }
  return msg
}

function requireActiveProfile() {
  const profile = store.getActiveProfile()
  if (!profile) throw new Error('Нет активного профиля. Создайте и выберите профиль подключения.')
  return profile
}

function inputToProfile(input: S3ProfileInput) {
  // Временный «профиль» для проверки соединения (без сохранения на диск).
  return { ...input, id: '__test__' }
}

export function registerIpc(getWindow: () => BrowserWindow | null): void {
  // ---- Профили ----
  handle<S3ProfileMeta[]>('profiles:list', () => store.listProfiles())
  handle<string | null>('profiles:getActive', () => store.getActiveProfileId())
  handle<S3ProfileMeta>('profiles:save', (input: S3ProfileInput, id?: string) =>
    store.saveProfile(input, id),
  )
  handle<null>('profiles:delete', (id: string) => {
    s3.invalidateClient(id)
    store.deleteProfile(id)
    return null
  })
  handle<null>('profiles:setActive', (id: string) => {
    store.setActiveProfile(id)
    return null
  })
  handle<null>('profiles:clearAll', () => {
    store.clearAllProfiles()
    return null
  })
  handle<null>('profiles:test', async (input: S3ProfileInput) => {
    await s3.list(inputToProfile(input), '', null)
    return null
  })

  // ---- Файловые операции ----
  handle<ListResult>('s3:list', (prefix: string, token?: string | null) =>
    s3.list(requireActiveProfile(), prefix, token),
  )
  handle<null>('s3:createFolder', async (prefix: string) => {
    await s3.createFolder(requireActiveProfile(), prefix)
    return null
  })
  handle<{ deleted: number }>('s3:deleteObjects', async (keys: string[]) => ({
    deleted: await s3.deleteObjects(requireActiveProfile(), keys),
  }))
  handle<{ deleted: number }>('s3:deletePrefix', async (prefix: string) => ({
    deleted: await s3.deletePrefix(requireActiveProfile(), prefix),
  }))
  handle<null>('s3:copy', async (src: string, dst: string) => {
    await s3.copyObject(requireActiveProfile(), src, dst)
    return null
  })
  handle<null>('s3:move', async (src: string, dst: string) => {
    await s3.moveObject(requireActiveProfile(), src, dst)
    return null
  })
  handle<ObjectInfo>('s3:info', (key: string) => s3.objectInfo(requireActiveProfile(), key))
  handle<boolean>('s3:exists', (key: string) => s3.exists(requireActiveProfile(), key))

  // ---- Загрузка ----
  handle<string[]>('s3:pickFiles', async () => {
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите файлы для загрузки',
      properties: ['openFile', 'multiSelections'],
    })
    return res.canceled ? [] : res.filePaths
  })

  handle<{ uploaded: number }>('s3:upload', async (destPrefix: string, filePaths: string[]) => {
    const profile = requireActiveProfile()
    const win = getWindow()
    let uploaded = 0
    for (const filePath of filePaths) {
      const name = basename(filePath)
      const key = (destPrefix || '') + name
      const id = key
      await s3.uploadFile(profile, filePath, key, (loaded, total) => {
        emitProgress(win, { id, loaded, total, done: false })
      })
      emitProgress(win, { id, loaded: 1, total: 1, done: true })
      uploaded++
    }
    return { uploaded }
  })

  handle<{ uploaded: number }>(
    's3:uploadData',
    async (destPrefix: string, payloads: { name: string; data: ArrayBuffer }[]) => {
      const profile = requireActiveProfile()
      const win = getWindow()
      let uploaded = 0
      for (const item of payloads) {
        const key = (destPrefix || '') + item.name
        const buffer = Buffer.from(item.data)
        await s3.uploadBuffer(profile, buffer, key, (loaded, total) => {
          emitProgress(win, { id: key, loaded, total, done: false })
        })
        emitProgress(win, { id: key, loaded: 1, total: 1, done: true })
        uploaded++
      }
      return { uploaded }
    },
  )

  // ---- Скачивание ----
  handle<{ saved: boolean; path?: string }>('s3:download', async (key: string) => {
    const profile = requireActiveProfile()
    const win = getWindow()
    const res = await dialog.showSaveDialog(win!, {
      title: 'Сохранить как',
      defaultPath: basename(key),
    })
    if (res.canceled || !res.filePath) return { saved: false }
    const { buffer } = await s3.getObjectBuffer(profile, key)
    await writeFile(res.filePath, buffer)
    return { saved: true, path: res.filePath }
  })

  handle<{ saved: number; dir?: string }>('s3:downloadMany', async (keys: string[]) => {
    const profile = requireActiveProfile()
    const win = getWindow()
    const res = await dialog.showOpenDialog(win!, {
      title: 'Выберите папку для сохранения',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (res.canceled || !res.filePaths[0]) return { saved: 0 }
    const dir = res.filePaths[0]
    let saved = 0
    for (const key of keys) {
      const { buffer } = await s3.getObjectBuffer(profile, key)
      await writeFile(join(dir, basename(key)), buffer)
      emitProgress(win, { id: key, loaded: 1, total: 1, done: true })
      saved++
    }
    return { saved, dir }
  })

  // ---- Предпросмотр ----
  handle<{ kind: 'image' | 'pdf' | 'text'; content: string; contentType?: string }>(
    's3:preview',
    async (key: string) => {
      const profile = requireActiveProfile()
      const { buffer, contentType } = await s3.getObjectBuffer(profile, key)
      const ext = extname(key).toLowerCase()
      const kind = detectPreviewKind(ext, contentType)
      if (kind === 'text') {
        return { kind, content: buffer.toString('utf-8').slice(0, 500_000), contentType }
      }
      const mime = contentType || (kind === 'pdf' ? 'application/pdf' : mimeForImage(ext))
      return { kind, content: `data:${mime};base64,${buffer.toString('base64')}`, contentType }
    },
  )

  // ---- Presigned URL ----
  handle<string>('s3:presign', (key: string, expiresInSeconds: number) =>
    s3.presignUrl(requireActiveProfile(), key, expiresInSeconds),
  )

  // ---- Конвертация изображений (WebP/AVIF) ----
  handle<ImageConvertResult>('s3:convertImages', (prefix: string, options: ImageConvertOptions) =>
    convert.convertPrefix(requireActiveProfile(), prefix, options, (ev) =>
      emitProgress(getWindow(), ev),
    ),
  )
}

function emitProgress(win: BrowserWindow | null, ev: ProgressEvent): void {
  win?.webContents.send('s3:progress', ev)
}

const IMAGE_EXT = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg', '.avif'])
const TEXT_EXT = new Set([
  '.txt', '.md', '.json', '.js', '.ts', '.jsx', '.tsx', '.css', '.scss', '.html', '.xml',
  '.yml', '.yaml', '.csv', '.log', '.sh', '.py', '.go', '.rs', '.java', '.c', '.cpp', '.h',
  '.env', '.ini', '.toml', '.sql', '.vue',
])

function detectPreviewKind(ext: string, contentType?: string): 'image' | 'pdf' | 'text' {
  if (IMAGE_EXT.has(ext) || contentType?.startsWith('image/')) return 'image'
  if (ext === '.pdf' || contentType === 'application/pdf') return 'pdf'
  if (TEXT_EXT.has(ext) || contentType?.startsWith('text/') || contentType?.includes('json')) {
    return 'text'
  }
  // По умолчанию пробуем как текст.
  return 'text'
}

function mimeForImage(ext: string): string {
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp',
    '.svg': 'image/svg+xml',
    '.avif': 'image/avif',
  }
  return map[ext] ?? 'application/octet-stream'
}
