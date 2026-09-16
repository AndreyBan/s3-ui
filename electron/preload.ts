import { contextBridge, ipcRenderer, webUtils } from 'electron'
import type { ProgressEvent, S3Api } from '../shared/types'

// Единственный мост в S3. Renderer не имеет доступа к Node/AWS SDK напрямую.
const api: S3Api = {
  // Профили
  listProfiles: () => ipcRenderer.invoke('profiles:list'),
  getActiveProfileId: () => ipcRenderer.invoke('profiles:getActive'),
  saveProfile: (input, id) => ipcRenderer.invoke('profiles:save', input, id),
  deleteProfile: (id) => ipcRenderer.invoke('profiles:delete', id),
  setActiveProfile: (id) => ipcRenderer.invoke('profiles:setActive', id),
  clearAllProfiles: () => ipcRenderer.invoke('profiles:clearAll'),
  testConnection: (input) => ipcRenderer.invoke('profiles:test', input),

  // Файловые операции
  list: (prefix, token) => ipcRenderer.invoke('s3:list', prefix, token),
  createFolder: (prefix) => ipcRenderer.invoke('s3:createFolder', prefix),
  deleteObjects: (keys) => ipcRenderer.invoke('s3:deleteObjects', keys),
  deletePrefix: (prefix) => ipcRenderer.invoke('s3:deletePrefix', prefix),
  copyObject: (src, dst) => ipcRenderer.invoke('s3:copy', src, dst),
  moveObject: (src, dst) => ipcRenderer.invoke('s3:move', src, dst),
  objectInfo: (key) => ipcRenderer.invoke('s3:info', key),
  exists: (key) => ipcRenderer.invoke('s3:exists', key),

  // Загрузка
  pickFilesToUpload: () => ipcRenderer.invoke('s3:pickFiles'),
  uploadFiles: (destPrefix, filePaths) => ipcRenderer.invoke('s3:upload', destPrefix, filePaths),
  uploadData: (destPrefix, files) => ipcRenderer.invoke('s3:uploadData', destPrefix, files),
  pickFoldersToUpload: () => ipcRenderer.invoke('s3:pickFolders'),
  uploadPaths: (destPrefix, paths) => ipcRenderer.invoke('s3:uploadPaths', destPrefix, paths),
  prefixExists: (prefix) => ipcRenderer.invoke('s3:prefixExists', prefix),
  clipboardFilePaths: () => ipcRenderer.invoke('clipboard:filePaths'),
  // as any: в tsconfig.electron нет DOM-lib, тип File недоступен
  getPathForFile: (file) => webUtils.getPathForFile(file as any),

  // Скачивание
  downloadObject: (key) => ipcRenderer.invoke('s3:download', key),
  downloadObjects: (keys) => ipcRenderer.invoke('s3:downloadMany', keys),

  // Предпросмотр / ссылки
  previewObject: (key) => ipcRenderer.invoke('s3:preview', key),
  presignUrl: (key, expires) => ipcRenderer.invoke('s3:presign', key, expires),

  // Конвертация изображений
  convertImages: (prefix, options) => ipcRenderer.invoke('s3:convertImages', prefix, options),

  // Прогресс
  onProgress: (cb: (ev: ProgressEvent) => void) => {
    const listener = (_e: unknown, ev: ProgressEvent) => cb(ev)
    ipcRenderer.on('s3:progress', listener)
    return () => ipcRenderer.removeListener('s3:progress', listener)
  },
}

contextBridge.exposeInMainWorld('s3Api', api)
