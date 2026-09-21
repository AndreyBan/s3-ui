import sharp from 'sharp'
import { extname } from 'node:path'
import type {
  ImageConvertOptions,
  ImageConvertResult,
  ImageConvertTargets,
  ImageFormat,
  ProgressEvent,
  S3Profile,
} from '../shared/types'
import * as s3 from './s3'

// Исходные форматы, которые умеем конвертировать.
const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png'])

/** Заменить расширение ключа на целевое (напр. a/b/pic.jpg → a/b/pic.webp). */
function targetKey(key: string, format: ImageFormat): string {
  const ext = extname(key)
  const base = ext ? key.slice(0, -ext.length) : key
  return `${base}.${format}`
}

/** Уровень усилия сжатия для формата. */
function effortFor(format: ImageFormat, optimize: boolean): number {
  if (format === 'avif') return optimize ? 6 : 4 // avif: 0..9
  return optimize ? 6 : 4 // webp: 0..6
}

/** Подходит ли ключ под конвертацию (изображение, а не маркер папки). */
function isSource(key: string): boolean {
  return !key.endsWith('/') && SOURCE_EXT.has(extname(key).toLowerCase())
}

/**
 * Конвертирует выбранные jpg/png в заданные форматы (WebP/AVIF): папки из targets
 * обходятся рекурсивно, отдельные ключи берутся как есть (прочие форматы игнорируются).
 * Работает транзитом в памяти: скачал → сконвертировал → загрузил. На локальный диск
 * ничего не пишется. Пропускает те цели, что уже существуют. По желанию удаляет
 * оригиналы после успешной генерации.
 */
export async function convertTargets(
  profile: S3Profile,
  targets: ImageConvertTargets,
  options: ImageConvertOptions,
  onProgress?: (ev: ProgressEvent) => void,
): Promise<ImageConvertResult> {
  const formats = options.formats.filter((f): f is ImageFormat => f === 'webp' || f === 'avif')
  if (formats.length === 0) throw new Error('Не выбран ни один формат для конвертации.')
  const quality = Math.min(100, Math.max(1, Math.round(options.quality)))

  // Листинг выбранных папок заодно даёт полную картину уже существующих целей в них.
  const scanned: string[] = []
  const existing = new Set<string>()
  const candidates = new Set<string>()

  for (const prefix of targets.prefixes ?? []) {
    const norm = prefix.endsWith('/') ? prefix : prefix + '/'
    scanned.push(norm)
    for (const key of await s3.listAllKeys(profile, norm)) {
      existing.add(key)
      if (isSource(key)) candidates.add(key)
    }
  }
  for (const key of targets.keys ?? []) if (isSource(key)) candidates.add(key)

  /** Цель уже есть? Внутри обойдённых папок листинг исчерпывающий, иначе — HEAD. */
  async function destTaken(dest: string): Promise<boolean> {
    if (existing.has(dest)) return true
    if (scanned.some((p) => dest.startsWith(p))) return false
    return s3.exists(profile, dest)
  }

  const result: ImageConvertResult = {
    total: candidates.size,
    converted: 0,
    skipped: 0,
    deleted: 0,
    failed: 0,
  }
  const originalsToDelete: string[] = []

  for (const key of candidates) {
    let buffer: Buffer | null = null
    let producedAny = false

    for (const format of formats) {
      const dest = targetKey(key, format)
      try {
        if (await destTaken(dest)) {
          result.skipped++
          continue
        }
        if (!buffer) {
          const got = await s3.getObjectBuffer(profile, key)
          buffer = got.buffer
        }
        onProgress?.({ id: dest, loaded: 0, total: 1, done: false })
        const out = await sharp(buffer)[format]({
          quality,
          effort: effortFor(format, options.optimize),
        }).toBuffer()
        await s3.uploadBuffer(profile, out, dest, (loaded, total) => {
          onProgress?.({ id: dest, loaded, total, done: false })
        })
        existing.add(dest)
        result.converted++
        producedAny = true
        onProgress?.({ id: dest, loaded: 1, total: 1, done: true })
      } catch (e: any) {
        result.failed++
        onProgress?.({ id: dest, loaded: 1, total: 1, done: true, error: e?.message ?? 'Ошибка' })
      }
    }

    // Удаляем оригинал только если хотя бы одна конвертация прошла успешно.
    if (options.deleteOriginals && producedAny) originalsToDelete.push(key)
  }

  if (originalsToDelete.length) {
    result.deleted = await s3.deleteObjects(profile, originalsToDelete)
  }

  return result
}
