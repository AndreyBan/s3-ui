import type { ProgressEvent } from '../../shared/types'
import { hasBridge } from './useApi'

export interface Transfer {
  id: string
  name: string
  loaded: number
  total: number
  done: boolean
  error?: string
}

const transfers = ref<Transfer[]>([])
let subscribed = false

export function useUploads() {
  function subscribe() {
    if (subscribed || !hasBridge()) return
    subscribed = true
    window.s3Api.onProgress((ev: ProgressEvent) => {
      const name = ev.label ?? (ev.id.split('/').pop() || ev.id)
      const idx = transfers.value.findIndex((t) => t.id === ev.id)
      const next: Transfer = {
        id: ev.id,
        name,
        loaded: ev.loaded,
        total: ev.total,
        done: ev.done,
        error: ev.error,
      }
      if (idx >= 0) transfers.value[idx] = next
      else transfers.value.push(next)

      if (ev.done) {
        // Убираем завершённые через пару секунд.
        setTimeout(() => {
          transfers.value = transfers.value.filter((t) => t.id !== ev.id)
        }, 2500)
      }
    })
  }

  const active = computed(() => transfers.value.filter((t) => !t.done || t.error))
  function percent(t: Transfer): number {
    if (t.total <= 0) return 0
    return Math.min(100, Math.round((t.loaded / t.total) * 100))
  }

  return { transfers, active, subscribe, percent }
}
