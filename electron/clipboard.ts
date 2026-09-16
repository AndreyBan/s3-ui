import { clipboard } from 'electron'
import { existsSync } from 'node:fs'

/** Прочитать формат буфера обмена как текст (не каждый формат доступен обоими способами). */
function readFormat(format: string): string {
  try {
    const text = clipboard.read(format)
    if (text) return text
  } catch {
    // формат недоступен через read — пробуем сырой буфер
  }
  try {
    return clipboard.readBuffer(format).toString('utf8')
  } catch {
    return ''
  }
}

/** file://-URI → абсолютный путь (null, если это не file-URI). */
function uriToPath(uri: string): string | null {
  if (!uri.startsWith('file://')) return null
  let p: string
  try {
    p = decodeURIComponent(uri.slice('file://'.length))
  } catch {
    return null
  }
  // file:///C:/... → путь начинается с /C:/ — убираем ведущий слеш.
  if (process.platform === 'win32' && /^\/[A-Za-z]:/.test(p)) p = p.slice(1)
  return p
}

/** Строки (URI или абсолютные пути) → существующие на диске пути. */
function linesToPaths(lines: string[]): string[] {
  const paths: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const fromUri = uriToPath(line)
    if (fromUri !== null) {
      if (existsSync(fromUri)) paths.push(fromUri)
      continue
    }
    // Абсолютный путь плоским текстом — принимаем только реально существующий,
    // чтобы обычный скопированный текст не превращался в «файлы».
    if ((line.startsWith('/') || /^[A-Za-z]:[\\/]/.test(line)) && existsSync(line)) {
      paths.push(line)
    }
  }
  return paths
}

/**
 * Пути файлов/папок, скопированных в системный буфер обмена ([] — файлов нет).
 *
 * На Linux файловые менеджеры кладут file://-URI в text/uri-list и
 * x-special/gnome-copied-files, но Chromium не отдаёт содержимое кастомных
 * X11-форматов через clipboard.read/readBuffer (формат виден в availableFormats,
 * данные пустые — проверено экспериментально). Поэтому основной источник —
 * текстовое представление (readText), куда те же менеджеры дублируют пути/URI.
 * Кастомные форматы всё же пробуем первыми на случай, если Chromium их отдаст.
 */
export function readClipboardFilePaths(): string[] {
  for (const format of ['text/uri-list', 'x-special/gnome-copied-files']) {
    const text = readFormat(format)
    if (text) {
      const paths = linesToPaths(text.split(/\r?\n/))
      if (paths.length) return paths
    }
  }

  const fromText = linesToPaths(clipboard.readText().split(/\r?\n/))
  if (fromText.length) return fromText

  if (process.platform === 'darwin') {
    // Finder: public.file-url (Electron отдаёт только первый файл).
    const paths = linesToPaths([readFormat('public.file-url')])
    if (paths.length) return paths
  }

  if (process.platform === 'win32') {
    // Explorer: Electron не поддерживает CF_HDROP — доступен только первый файл.
    try {
      const raw = clipboard.readBuffer('FileNameW')
      if (raw.length) {
        const p = raw.toString('ucs2').replace(/\0+$/, '')
        if (p && existsSync(p)) return [p]
      }
    } catch {
      // формат отсутствует
    }
  }

  return []
}
