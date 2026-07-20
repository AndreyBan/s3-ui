import { app, BrowserWindow, Menu, net, protocol, shell } from 'electron'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { registerIpc } from './ipc'

// Dev-режим: не запакованное приложение И не форсированный прод (npm start).
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production'
const DEV_URL = 'http://localhost:3000'

// В проде отдаём статику Nuxt (nuxt generate -> .output/public) через кастомный
// протокол app://, чтобы работали абсолютные пути ассетов и клиентский роутинг.
const STATIC_DIR = join(app.getAppPath(), '.output', 'public')

let mainWindow: BrowserWindow | null = null

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } },
])

function registerAppProtocol(): void {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let pathname = decodeURIComponent(url.pathname)
    if (!pathname || pathname === '/') pathname = '/index.html'
    // SPA-fallback: запросы без расширения отдаём как index.html.
    if (!pathname.includes('.')) pathname = '/index.html'
    const filePath = join(STATIC_DIR, pathname)
    return net.fetch(pathToFileURL(filePath).toString())
  })
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0f172a',
    title: 'S3 UI',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // preload использует require('electron'); AWS SDK живёт в main, не в preload
    },
  })

  // Внешние ссылки — в системном браузере, не внутри окна.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('did-fail-load', (_e, code, desc, url) => {
    console.error(`[window] Ошибка загрузки (${code}) ${desc}: ${url}`)
  })
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[window] Страница загружена')
  })

  if (isDev) {
    mainWindow.loadURL(DEV_URL)
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    // Грузим корень, а не /index.html — иначе Vue-роутер увидит путь /index.html и покажет 404.
    // Отдачей файла index.html занимается обработчик протокола app:// (см. registerAppProtocol).
    mainWindow.loadURL('app://local/')
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Файл',
      submenu: [{ role: 'quit', label: 'Выход' }],
    },
    {
      label: 'Правка',
      submenu: [
        { role: 'undo', label: 'Отменить' },
        { role: 'redo', label: 'Повторить' },
        { type: 'separator' },
        { role: 'cut', label: 'Вырезать' },
        { role: 'copy', label: 'Копировать' },
        { role: 'paste', label: 'Вставить' },
        { role: 'selectAll', label: 'Выделить всё' },
      ],
    },
    {
      label: 'Вид',
      submenu: [
        { role: 'reload', label: 'Обновить' },
        { role: 'toggleDevTools', label: 'Инструменты разработчика' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Сбросить масштаб' },
        { role: 'zoomIn', label: 'Увеличить' },
        { role: 'zoomOut', label: 'Уменьшить' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Полный экран' },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  if (!isDev) registerAppProtocol()
  registerIpc(() => mainWindow)
  buildMenu()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
