import { ChevronDown } from 'lucide-react'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

interface SelectProps extends ComponentProps<'select'> {
  invalid?: boolean
}

/** A native select (best on phones and for screen readers) dressed like an Input. */
export function Select({ invalid = false, className, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        aria-invalid={invalid || undefined}
        className={cn(
          'h-10 w-full appearance-none rounded-lg border bg-surface pl-3 pr-9 text-sm text-fg',
          'focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted',
          invalid ? 'border-danger' : 'border-line',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-3 size-4 text-muted" />
    </div>
  )
}
