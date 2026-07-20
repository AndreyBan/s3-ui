interface PromptOptions {
  title: string
  message?: string
  placeholder?: string
  initialValue?: string
  confirmLabel?: string
  cancelLabel?: string
}

interface PromptState extends PromptOptions {
  open: boolean
  value: string
  resolve: ((v: string | null) => void) | null
}

const state = reactive<PromptState>({
  open: false,
  title: '',
  message: '',
  placeholder: '',
  initialValue: '',
  confirmLabel: 'ОК',
  cancelLabel: 'Отмена',
  value: '',
  resolve: null,
})

export function usePrompt() {
  /** Показать диалог ввода. Возвращает строку или null (отмена). */
  function prompt(opts: PromptOptions): Promise<string | null> {
    state.title = opts.title
    state.message = opts.message ?? ''
    state.placeholder = opts.placeholder ?? ''
    state.initialValue = opts.initialValue ?? ''
    state.confirmLabel = opts.confirmLabel ?? 'ОК'
    state.cancelLabel = opts.cancelLabel ?? 'Отмена'
    state.value = opts.initialValue ?? ''
    state.open = true
    return new Promise<string | null>((resolve) => {
      state.resolve = resolve
    })
  }
  function submit() {
    const v = state.value.trim()
    state.open = false
    state.resolve?.(v ? v : null)
    state.resolve = null
  }
  function cancel() {
    state.open = false
    state.resolve?.(null)
    state.resolve = null
  }
  return { state, prompt, submit, cancel }
}
