import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'
import { Dialog } from './Dialog'

function Harness({ removeOpenerOnClose = false }: { removeOpenerOnClose?: boolean }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [gone, setGone] = useState(false)
  const [mounted, setMounted] = useState(false)
  return (
    <>
      <main id="main" tabIndex={-1}>
        {!gone && <button onClick={() => setOpen(true)}>Open form</button>}
        {!gone && <button onClick={() => setConfirming(true)}>Open confirm</button>}
        <button onClick={() => setMounted(true)}>Open mounted form</button>
      </main>
      <Dialog open={open} onOpenChange={setOpen} title="Form">
        <button>Inside</button>
      </Dialog>
      {mounted && (
        <Dialog open onOpenChange={(next) => !next && setMounted(false)} title="Mounted form">
          {/* The real forms focus their first field themselves, which makes Radix skip its own focus event. */}
          <input aria-label="Amount" autoFocus />
        </Dialog>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Sure?"
        description="Really."
        confirmLabel="Yes"
        onConfirm={() => {
          if (removeOpenerOnClose) setGone(true)
          setConfirming(false)
        }}
      />
    </>
  )
}

describe('focus after a dialog closes', () => {
  it('returns to the button that opened a dialog', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open form' })

    await user.click(opener)
    await screen.findByRole('dialog', { name: 'Form' })
    await user.keyboard('{Escape}')

    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('returns to the opener when the dialog mounts open and focuses its own field', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open mounted form' })

    await user.click(opener)
    expect(await screen.findByLabelText('Amount')).toHaveFocus()
    await user.keyboard('{Escape}')

    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('returns to the button that opened a confirmation', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    const opener = screen.getByRole('button', { name: 'Open confirm' })

    await user.click(opener)
    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    await waitFor(() => expect(opener).toHaveFocus())
  })

  it('falls back to the main region when the opener was removed', async () => {
    const user = userEvent.setup()
    render(<Harness removeOpenerOnClose />)

    await user.click(screen.getByRole('button', { name: 'Open confirm' }))
    await user.click(await screen.findByRole('button', { name: 'Yes' }))

    await waitFor(() => expect(document.getElementById('main')).toHaveFocus())
  })
})
