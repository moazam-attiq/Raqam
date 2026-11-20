import * as RadixDialog from '@radix-ui/react-dialog'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { useRestoreFocus } from './restore-focus'

interface DialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  children: ReactNode
  className?: string
}

/** A modal dialog for forms and details. Focus is trapped and Escape closes it (Radix). */
export function Dialog({ open, onOpenChange, title, description, children, className }: DialogProps) {
  const restoreFocus = useRestoreFocus(open)
  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      <RadixDialog.Portal>
        <RadixDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <RadixDialog.Content
          {...(description ? {} : { 'aria-describedby': undefined })}
          {...restoreFocus}
          className={cn(
            'fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto',
            'rounded-2xl border border-line bg-surface p-6 shadow-overlay',
            className,
          )}
        >
          <RadixDialog.Title className="text-lg font-semibold tracking-tight text-fg">{title}</RadixDialog.Title>
          {description && (
            <RadixDialog.Description className="mt-1 text-sm text-muted">
              {description}
            </RadixDialog.Description>
          )}
          <div className="mt-4">{children}</div>
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  )
}

/** Right-aligned row for a dialog's buttons. */
export function DialogFooter({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>
}
