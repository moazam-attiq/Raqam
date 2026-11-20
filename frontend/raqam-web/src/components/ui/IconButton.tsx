import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface IconButtonProps extends Omit<ComponentProps<'button'>, 'aria-label' | 'children'> {
  /** What the button does ("Edit account"). Required: an icon alone has no name for screen readers. */
  label: string
  icon: ReactNode
  tone?: 'neutral' | 'danger'
}

/** An icon-only button for row actions (edit, archive, delete). The label shows as a tooltip. */
export function IconButton({ label, icon, tone = 'neutral', className, type = 'button', ...props }: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors [&_svg]:size-4',
        'hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-60',
        tone === 'danger' ? 'hover:text-danger' : 'hover:text-fg',
        className,
      )}
      {...props}
    >
      {icon}
    </button>
  )
}
