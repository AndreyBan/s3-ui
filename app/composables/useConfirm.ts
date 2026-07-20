interface ConfirmOptions {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

interface ConfirmState extends ConfirmOptions {
  open: boolean
  resolve: ((v: boolean) => void) | null
}

const state = reactive<ConfirmState>({
  open: false,
  title: '',
  message: '',
  confirmLabel: 'ОК',
  cancelLabel: 'Отмена',
  danger: false,
  resolve: null,
})

export function useConfirm() {
  function confirm(opts: ConfirmOptions): Promise<boolean> {
    state.title = opts.title
    state.message = opts.message
    state.confirmLabel = opts.confirmLabel ?? 'ОК'
    state.cancelLabel = opts.cancelLabel ?? 'Отмена'
    state.danger = opts.danger ?? false
    state.open = true
    return new Promise<boolean>((resolve) => {
      state.resolve = resolve
    })
  }
  function answer(v: boolean) {
    state.open = false
    state.resolve?.(v)
    state.resolve = null
  }
  return { state, confirm, answer }
}
