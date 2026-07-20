export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Б'
  if (!bytes || bytes < 0) return '—'
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const val = bytes / Math.pow(1024, i)
  return `${val.toFixed(val >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

export function formatDate(ms: number | null): string {
  if (!ms) return '—'
  const d = new Date(ms)
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Эмодзи-иконка по расширению — без внешних зависимостей. */
export function fileIcon(name: string): string {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  const map: Record<string, string> = {
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️', webp: '🖼️', svg: '🖼️', bmp: '🖼️', avif: '🖼️',
    pdf: '📕',
    doc: '📄', docx: '📄', txt: '📄', md: '📝', rtf: '📄',
    xls: '📊', xlsx: '📊', csv: '📊',
    ppt: '📽️', pptx: '📽️',
    zip: '🗜️', rar: '🗜️', gz: '🗜️', tar: '🗜️', '7z': '🗜️',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
    mp4: '🎬', mkv: '🎬', mov: '🎬', avi: '🎬', webm: '🎬',
    js: '📜', ts: '📜', json: '📜', html: '📜', css: '📜', vue: '📜', py: '📜', go: '📜', rs: '📜',
  }
  return map[ext] ?? '📎'
}
