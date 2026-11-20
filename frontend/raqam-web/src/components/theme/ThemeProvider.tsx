import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { applyTheme, readStoredTheme, storeTheme } from '@/lib/theme'
import type { ThemePreference } from '@/lib/theme'
import { ThemeContext } from './theme-context'

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<ThemePreference>(readStoredTheme)

  useEffect(() => {
    storeTheme(theme)
    applyTheme(theme)

    // "System" follows the OS setting live.
    if (theme !== 'system' || typeof window.matchMedia !== 'function') {
      return
    }
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyTheme('system')
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [theme])

  const value = useMemo(() => ({ theme, setTheme }), [theme])
  return <ThemeContext value={value}>{children}</ThemeContext>
}
