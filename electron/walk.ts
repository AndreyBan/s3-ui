import { readdir } from 'node:fs/promises'
import { join, relative, sep } from 'node:path'

/** Файл, найденный при обходе директории. */
export interface ScannedFile {
  absPath: string
  relPath: string // относительно корня обхода, разделитель всегда '/'
}

export interface ScanResult {
  files: ScannedFile[]
  emptyDirs: string[] // относительные пути пустых «листовых» директорий (без завершающего '/')
}

/**
 * Рекурсивный обход директории для загрузки в S3.
 * Symlinks пропускаются (защита от циклов), скрытые файлы включаются.
 */
export async function scanDirectory(root: string): Promise<ScanResult> {
  const files: ScannedFile[] = []
  const emptyDirs: string[] = []

  // split(sep).join('/') вместо replace: на POSIX не калечит имена с литеральным '\'.
  const toRel = (p: string): string => relative(root, p).split(sep).join('/')

  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true })
    if (entries.length === 0 && dir !== root) {
      emptyDirs.push(toRel(dir))
      return
    }
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue
      const abs = join(dir, entry.name)
      if (entry.isDirectory()) await walk(abs)
      else if (entry.isFile()) files.push({ absPath: abs, relPath: toRel(abs) })
    }
  }

  await walk(root)
  return { files, emptyDirs }
}
