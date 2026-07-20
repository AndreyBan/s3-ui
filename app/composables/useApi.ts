import type { IpcResult, S3Api } from '../../shared/types'

/** Ошибка IPC с сохранённым кодом. */
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.code = code
  }
}

/** Есть ли доступ к мосту (мы внутри Electron, а не в обычном браузере). */
export function hasBridge(): boolean {
  return typeof window !== 'undefined' && !!window.s3Api
}

/** Развернуть IpcResult: вернуть data или бросить ApiError. */
export async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const res = await p
  if (!res.ok) throw new ApiError(res.error, res.code)
  return res.data
}

/** Типобезопасный доступ к мосту. */
export function api(): S3Api {
  if (!hasBridge()) {
    throw new ApiError('Мост Electron недоступен. Запустите приложение через Electron (npm run dev).')
  }
  return window.s3Api
}
