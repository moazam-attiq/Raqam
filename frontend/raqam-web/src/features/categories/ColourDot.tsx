import { cn } from '@/lib/cn'

/** A small round marker for a category's colour; a plain outline when it has none. */
export function ColourDot({ colour, className }: { colour: string | null; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn('inline-block size-3 shrink-0 rounded-full', !colour && 'border border-line bg-sunken', className)}
      style={colour ? { backgroundColor: colour } : undefined}
    />
  )
}
