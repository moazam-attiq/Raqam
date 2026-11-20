import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmDialog } from './ConfirmDialog'

function renderDialog(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  const onConfirm = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title="Archive account?"
      description="It keeps its history."
      confirmLabel="Archive"
      onConfirm={onConfirm}
      {...overrides}
    />,
  )
  return { onConfirm, onOpenChange }
}

describe('ConfirmDialog', () => {
  it('names the action and explains it', () => {
    renderDialog()

    expect(screen.getByRole('alertdialog', { name: 'Archive account?' })).toBeInTheDocument()
    expect(screen.getByText('It keeps its history.')).toBeInTheDocument()
  })

  it('does nothing until the user confirms', async () => {
    const user = userEvent.setup()
    const { onConfirm } = renderDialog()

    expect(onConfirm).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Archive' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('cancels without confirming', async () => {
    const user = userEvent.setup()
    const { onConfirm, onOpenChange } = renderDialog()

    await user.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('cancels on Escape', async () => {
    const user = userEvent.setup()
    const { onConfirm, onOpenChange } = renderDialog()

    await user.keyboard('{Escape}')

    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it('blocks both buttons while the work is running', () => {
    renderDialog({ pending: true })

    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /Archive/ })).toBeDisabled()
  })

  it('renders nothing when closed', () => {
    renderDialog({ open: false })

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
})
