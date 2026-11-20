import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from './ToastProvider'
import { useToast } from './toast-context'

const shown = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }))
vi.mock('dynaura', () => ({ Toaster: () => <div data-testid="toaster" />, dynaura: shown }))

function Trigger() {
  const { notify } = useToast()
  return (
    <>
      <button onClick={() => notify('Account archived', 'success')}>Success</button>
      <button onClick={() => notify('Could not save', 'error')}>Error</button>
      <button onClick={() => notify('Nothing changed')}>Plain</button>
    </>
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('ToastProvider', () => {
  it('mounts one toaster for the whole app', () => {
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })

  it('shows each message with its tone', async () => {
    const user = userEvent.setup()
    render(
      <ToastProvider>
        <Trigger />
      </ToastProvider>,
    )

    await user.click(screen.getByRole('button', { name: 'Success' }))
    await user.click(screen.getByRole('button', { name: 'Error' }))
    await user.click(screen.getByRole('button', { name: 'Plain' }))

    expect(shown.success).toHaveBeenCalledWith({ title: 'Account archived' })
    expect(shown.error).toHaveBeenCalledWith({ title: 'Could not save' })
    expect(shown.info).toHaveBeenCalledWith({ title: 'Nothing changed' })
  })
})
