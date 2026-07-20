const theme = ref<'light' | 'dark'>('dark')

export function useTheme() {
  function apply(t: 'light' | 'dark') {
    theme.value = t
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', t === 'dark')
    }
    if (typeof localStorage !== 'undefined') localStorage.setItem('theme', t)
  }
  function init() {
    if (typeof localStorage === 'undefined') return
    const saved = localStorage.getItem('theme') as 'light' | 'dark' | null
    const prefers =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    apply(saved ?? (prefers ? 'dark' : 'light'))
  }
  function toggle() {
    apply(theme.value === 'dark' ? 'light' : 'dark')
  }
  return { theme, init, toggle, apply }
}
