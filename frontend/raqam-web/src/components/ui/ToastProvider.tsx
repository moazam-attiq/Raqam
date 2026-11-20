import { Toaster, dynaura } from 'dynaura'
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { ToastContext } from './toast-context'
import type { ToastApi } from './toast-context'

// The colours are CSS variables (see index.css), so the toasts follow light and dark mode.
const toastTheme = {
  background: 'var(--toast-bg)',
  foreground: 'var(--toast-fg)',
  muted: 'var(--toast-muted)',
  success: '#52d6a0',
  error: '#ff937f',
  warning: '#f2c25e',
  info: '#8fa3ff',
}

/**
 * Short messages that vanish on their own ("Account archived"), shown by dynaura as a
 * small island at the top of the screen. `notify` keeps one simple shape for the whole app.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const api = useMemo<ToastApi>(
    () => ({
      notify: (message, tone = 'info') => {
        dynaura[tone]({ title: message })
      },
    }),
    [],
  )

  return (
    <ToastContext value={api}>
      {children}
      <Toaster position="top" theme={toastTheme} />
    </ToastContext>
  )
}
