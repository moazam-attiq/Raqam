export type ThemePreference = 'light' | 'dark' | 'system'

// index.html applies the same rule before first paint; keep the two in step.
export const THEME_STORAGE_KEY = 'raqam-theme'

export function readStoredTheme(): ThemePreference {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') {
      return stored
    }
  } catch {
    // Storage can be blocked (private mode); fall back to the system setting.
  }
  return 'system'
}

export function storeTheme(theme: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // Not persisted; the choice still applies for this visit.
  }
}

export function systemPrefersDark(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function resolveTheme(theme: ThemePreference): 'light' | 'dark' {
  if (theme === 'system') {
    return systemPrefersDark() ? 'dark' : 'light'
  }
  return theme
}

export function applyTheme(theme: ThemePreference): void {
  document.documentElement.classList.toggle('dark', resolveTheme(theme) === 'dark')
}
