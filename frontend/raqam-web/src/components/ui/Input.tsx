import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

interface InputProps extends ComponentProps<'input'> {
  invalid?: boolean
}

export function Input({ invalid = false, className, ...props }: InputProps) {
  return (
    <input
      aria-invalid={invalid || undefined}
      className={cn(
        'h-10 w-full rounded-lg border bg-surface px-3 text-sm text-fg placeholder:text-subtle',
        'focus-visible:outline-offset-0',
        'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted',
        invalid ? 'border-danger' : 'border-line',
        className,
      )}
      {...props}
    />
  )
}
