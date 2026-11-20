import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ThemePreference } from '@/lib/theme'
import { useTheme } from './theme-context'

const options = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] satisfies Array<{ value: ThemePreference; label: string; icon: typeof Sun }>

/** `plain` sits on the page background (the navbar); `side` sits on the lapis panel (the mobile top bar). */
export function ThemeToggle({ variant = 'plain' }: { variant?: 'plain' | 'side' }) {
  const { theme, setTheme } = useTheme()
  const side = variant === 'side'

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={cn('inline-flex rounded-lg border p-0.5', side ? 'border-side-line' : 'border-line bg-surface')}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={theme === option.value}
          aria-label={option.label}
          title={option.label}
          onClick={() => setTheme(option.value)}
          className={cn(
            'inline-flex items-center justify-center rounded-md px-2.5 py-1.5 transition-colors',
            side
              ? cn('focus-visible:outline-side-fg', theme === option.value ? 'bg-side-active text-side-fg' : 'text-side-muted hover:text-side-fg')
              : theme === option.value
                ? 'bg-brand-soft text-brand-soft-fg'
                : 'text-muted hover:text-fg',
          )}
        >
          <option.icon className="size-4" aria-hidden="true" />
        </button>
      ))}
    </div>
  )
}
