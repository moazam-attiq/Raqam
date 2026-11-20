import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './Button'
import { useRestoreFocus } from './restore-focus'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmLabel: string
  /** Called when the user confirms. The caller closes the dialog when the work succeeds. */
  onConfirm: () => void
  /** True while the confirmed work is running; blocks both buttons. */
  pending?: boolean
  destructive?: boolean
}

/** Every destructive action asks first (spec §3.14). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending = false,
  destructive = true,
}: ConfirmDialogProps) {
  const restoreFocus = useRestoreFocus(open)
  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-40 bg-scrim" />
        <AlertDialog.Content
          {...restoreFocus}
          className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-line bg-surface p-6 shadow-overlay">
          <AlertDialog.Title className="text-lg font-semibold tracking-tight text-fg">{title}</AlertDialog.Title>
          <AlertDialog.Description className="mt-2 text-sm text-muted">
            {description}
          </AlertDialog.Description>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <AlertDialog.Cancel asChild>
              <Button variant="secondary" disabled={pending}>
                Cancel
              </Button>
            </AlertDialog.Cancel>
            <Button variant={destructive ? 'danger' : 'primary'} loading={pending} onClick={onConfirm}>
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
