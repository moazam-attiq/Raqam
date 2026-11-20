import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Scrolls sideways on narrow screens instead of squashing the columns. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return (
    <div className="relative overflow-x-auto">
      <table className={cn('w-full text-left text-sm', className)} {...props} />
    </div>
  )
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn('border-b border-line bg-sunken/60 px-3 py-2.5 sm:px-5 text-xs font-medium text-muted', className)}
      {...props}
    />
  )
}

/** Put amounts and dates in a right-aligned cell with the `num` class so digits line up. */
export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('border-b border-line/70 px-3 py-3 sm:px-5 text-fg', className)} {...props} />
}
