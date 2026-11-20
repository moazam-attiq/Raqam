import { cn } from '@/lib/cn'

export function Spinner({ className, label = 'Loading' }: { className?: string; label?: string }) {
  return (
    <svg
      role="status"
      aria-label={label}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('size-5 animate-spin text-brand', className)}
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
      <path d="M4 12a8 8 0 0 1 8-8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
    </svg>
  )
}

/** A grey placeholder block shown while content loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn('animate-pulse rounded-md bg-sunken', className)} />
}
