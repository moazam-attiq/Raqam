import { useLayoutEffect, useRef } from 'react'

/**
 * Radix only hands focus back to a `Trigger` element, and our dialogs are opened from
 * ordinary buttons. This remembers what had focus when `open` became true and puts it back
 * on close, so keyboard users land where they were. If that element is gone (a deleted
 * row), focus goes to the page's main region instead of the top of the document.
 *
 * The opener is read in a layout effect rather than Radix's `onOpenAutoFocus`, because that
 * event is skipped when the dialog's content focuses a field itself (`autoFocus`).
 */
export function useRestoreFocus(open: boolean) {
  const opener = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    if (open) {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    }
  }, [open])

  return {
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault()
      const target = opener.current?.isConnected ? opener.current : document.getElementById('main')
      target?.focus()
    },
  }
}
