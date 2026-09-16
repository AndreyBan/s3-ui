// Общие типы контракта между main-процессом (Electron) и renderer (Nuxt).
// Импортируются в обоих мирах; секретные поля профиля на диске хранятся зашифрованными.

/** Профиль подключения к S3-совместимому хранилищу. */
export interface S3Profile {
  id: string
  name: string
  endpoint?: string // напр. https://s3.amazonaws.com или http://localhost:9000 (MinIO)
  region: string
  accessKeyId: string
  secretAccessKey: string
  bucket: string
  forcePathStyle: boolean
  color?: string // необязательная цветовая метка для UI
}

/** Профиль без секретов — безопасно передавать/логировать в renderer при перечислении. */
export type S3ProfileMeta = Omit<S3Profile, 'accessKeyId' | 'secretAccessKey'>

/** Данные формы при создании/редактировании профиля. */
export type S3ProfileInput = Omit<S3Profile, 'id'>

/** Один объект (файл) в бакете. */
export interface S3ObjectItem {
  key: string // полный ключ, напр. "photos/2024/pic.jpg"
  name: string // отображаемое имя (последний сегмент)
  size: number
  lastModified: number | null // unix ms
  etag?: string
}

/** «Папка» — общий префикс. */
export interface S3PrefixItem {
  prefix: string // полный префикс с завершающим '/'
  name: string // отображаемое имя папки
}

/** Результат листинга содержимого «папки». */
export interface ListResult {
  prefix: string
  folders: S3PrefixItem[]
  files: S3ObjectItem[]
  continuationToken: string | null // null == больше нет страниц
  isTruncated: boolean
}

/** Детальная информация об объекте. */
export interface ObjectInfo {
  key: string
  size: number
  contentType?: string
  etag?: string
  lastModified: number | null
  metadata: Record<string, string>
}

/** Прогресс загрузки/операции, транслируется из main в renderer событием. */
export interface ProgressEvent {
  id: string // идентификатор задачи (напр. ключ загружаемого файла)
  loaded: number
  total: number
  done: boolean
  error?: string
  label?: string // отображаемое имя, если id — не ключ S3 (напр. агрегат батча «N из M файлов»)
}

/** Итог загрузки путей с диска (файлы + папки рекурсивно). */
export interface UploadPathsResult {
  uploaded: number // залито файлов
  markers: number // создано маркеров пустых папок
}

/** Целевой формат конвертации изображений. */
export type ImageFormat = 'webp' | 'avif'

/** Параметры рекурсивной конвертации изображений в префиксе. */
export interface ImageConvertOptions {
  formats: ImageFormat[] // минимум один
  quality: number // 1..100
  optimize: boolean // true → максимальный effort (лучше сжатие, медленнее)
  deleteOriginals: boolean // удалять исходные jpg/png после успешной конвертации
}

/** Итоги конвертации. */
export interface ImageConvertResult {
  total: number // всего кандидатов jpg/png
  converted: number // сгенерировано файлов (webp+avif суммарно)
  skipped: number // цель уже существовала
  deleted: number // удалено оригиналов
  failed: number
}

/** Унифицированный результат IPC-операции с понятной ошибкой. */
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string }

/** Полезная нагрузка загрузки байтами (drag-and-drop). */
export interface UploadPayload {
  name: string
  data: ArrayBuffer
}

/** Публичный API, экспонируемый через contextBridge как window.s3Api. */
export interface S3Api {
  // Профили
  listProfiles(): Promise<IpcResult<S3ProfileMeta[]>>
  getActiveProfileId(): Promise<IpcResult<string | null>>
  saveProfile(input: S3ProfileInput, id?: string): Promise<IpcResult<S3ProfileMeta>>
  deleteProfile(id: string): Promise<IpcResult<null>>
  setActiveProfile(id: string): Promise<IpcResult<null>>
  clearAllProfiles(): Promise<IpcResult<null>>
  testConnection(input: S3ProfileInput): Promise<IpcResult<null>>

  // Файловые операции (в контексте активного профиля)
  list(prefix: string, continuationToken?: string | null): Promise<IpcResult<ListResult>>
  createFolder(prefix: string): Promise<IpcResult<null>>
  deleteObjects(keys: string[]): Promise<IpcResult<{ deleted: number }>>
  deletePrefix(prefix: string): Promise<IpcResult<{ deleted: number }>>
  copyObject(sourceKey: string, destKey: string): Promise<IpcResult<null>>
  moveObject(sourceKey: string, destKey: string): Promise<IpcResult<null>>
  objectInfo(key: string): Promise<IpcResult<ObjectInfo>>
  exists(key: string): Promise<IpcResult<boolean>>

  // Загрузка: main читает файл с диска по пути (выбран нативным диалогом) и заливает в S3
  pickFilesToUpload(): Promise<IpcResult<string[]>> // возвращает выбранные пути
  uploadFiles(destPrefix: string, filePaths: string[]): Promise<IpcResult<{ uploaded: number }>>
  // Загрузка содержимого напрямую (drag-and-drop): передаём байты из renderer
  uploadData(destPrefix: string, files: UploadPayload[]): Promise<IpcResult<{ uploaded: number }>>
  // Загрузка произвольных путей с диска: main сам различает файл/папку, папки обходит рекурсивно
  pickFoldersToUpload(): Promise<IpcResult<string[]>> // возвращает выбранные папки
  uploadPaths(destPrefix: string, paths: string[]): Promise<IpcResult<UploadPathsResult>>
  prefixExists(prefix: string): Promise<IpcResult<boolean>> // есть ли хоть один объект под префиксом
  // Пути файлов/папок, скопированных в системный буфер обмена ([] — файлов в буфере нет)
  clipboardFilePaths(): Promise<IpcResult<string[]>>
  /**
   * Синхронно: абсолютный путь DOM File на диске ('' — файла на диске нет).
   * Параметр unknown: типы общие с main-процессом, где нет DOM-lib.
   */
  getPathForFile(file: unknown): string

  // Скачивание через нативный диалог "Сохранить как"
  downloadObject(key: string): Promise<IpcResult<{ saved: boolean; path?: string }>>
  downloadObjects(keys: string[]): Promise<IpcResult<{ saved: number; dir?: string }>>

  // Предпросмотр: main отдаёт содержимое объекта (data URL или текст)
  previewObject(key: string): Promise<IpcResult<{ kind: 'image' | 'pdf' | 'text'; content: string; contentType?: string }>>

  // Presigned URL для копирования ссылки
  presignUrl(key: string, expiresInSeconds: number): Promise<IpcResult<string>>

  // Рекурсивная конвертация jpg/png в текущем префиксе в WebP/AVIF
  convertImages(prefix: string, options: ImageConvertOptions): Promise<IpcResult<ImageConvertResult>>

  // Подписка на прогресс операций
  onProgress(cb: (ev: ProgressEvent) => void): () => void
}
