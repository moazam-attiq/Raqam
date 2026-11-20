import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

/** Flat and outlined: hierarchy comes from spacing and type, not from shadows. */
export function Card({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('min-w-0 rounded-xl border border-line bg-surface', className)} {...props} />
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('flex items-center justify-between gap-3 border-b border-line px-5 py-3.5', className)} {...props} />
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />
}
