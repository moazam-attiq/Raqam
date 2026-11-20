import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import { groupKey } from './security-api'

const user = { id: '1', email: 'me@example.com' }
const setup = {
  sharedKey: 'ABCDEFGHIJKLMNOP',
  authenticatorUri: 'otpauth://totp/Raqam:me%40example.com?secret=ABCDEFGHIJKLMNOP&issuer=Raqam&digits=6',
}
const recoveryCodes = ['aaaaa-11111', 'bbbbb-22222', 'ccccc-33333']

interface Options {
  enabled?: boolean
  /** Answers the enable call; by default it accepts and returns the recovery codes. */
  enable?: () => Response
  statusError?: boolean
}

/** A fake API where two-step verification is on or off, and the calls flip it. */
function fakeApi({ enabled = false, enable, statusError = false }: Options = {}) {
  let on = enabled
  return mockApi(({ method, path }) => {
    const key = `${method} ${path}`
    if (key === 'GET /auth/me') return json(user)
    if (key === 'GET /auth/two-factor/status') return statusError ? json({ title: 'Boom' }, 500) : json({ enabled: on })
    if (key === 'POST /auth/two-factor/setup') return json(setup)
    if (key === 'POST /auth/two-factor/enable') {
      if (enable) return enable()
      on = true
      return json({ recoveryCodes })
    }
    if (key === 'POST /auth/two-factor/disable') {
      on = false
      return new Response(null, { status: 204 })
    }
    return undefined
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('groupKey', () => {
  it('splits a key into groups of four', () => {
    expect(groupKey('ABCDEFGHIJKLMNOP')).toBe('ABCD EFGH IJKL MNOP')
    expect(groupKey('ABCDEF')).toBe('ABCD EF')
    expect(groupKey('')).toBe('')
  })
})

describe('the security page', () => {
  it('is in the navigation and shows that two-step verification is off', async () => {
    fakeApi()
    renderApp('/security')

    expect(await screen.findByRole('heading', { name: 'Security' })).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Security' }).length).toBeGreaterThan(0)
    expect(await screen.findByText('Off')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument()
  })

  it('shows an error with retry when the status cannot load', async () => {
    fakeApi({ statusError: true })
    renderApp('/security')
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('shows a QR code and the key, and turns on with a valid code, then shows the recovery codes once', async () => {
    const api = fakeApi()
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn on' }))

    expect(await screen.findByRole('img', { name: 'QR code for your authenticator app' })).toBeInTheDocument()
    expect(screen.getByLabelText('Setup key')).toHaveTextContent('ABCD EFGH IJKL MNOP')
    expect(api.sent('POST', '/auth/two-factor/enable')).toHaveLength(0)

    await u.type(screen.getByLabelText('Authenticator code'), '123 456')
    await u.click(screen.getByRole('button', { name: 'Turn on' }))

    await waitFor(() => expect(api.sent('POST', '/auth/two-factor/enable')).toHaveLength(1))
    expect(api.sent('POST', '/auth/two-factor/enable')[0]!.body).toEqual({ code: '123456' })

    const list = await screen.findByRole('list', { name: 'Recovery codes' })
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual(recoveryCodes)

    await u.click(screen.getByRole('button', { name: 'I have saved them' }))
    expect(screen.queryByRole('list', { name: 'Recovery codes' })).not.toBeInTheDocument()
    expect(await screen.findByText('On')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn off' })).toBeInTheDocument()
  })

  it('copies the recovery codes', async () => {
    fakeApi()
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn on' }))
    await u.type(await screen.findByLabelText('Authenticator code'), '123456')
    await u.click(screen.getByRole('button', { name: 'Turn on' }))
    await u.click(await screen.findByRole('button', { name: /Copy codes/ }))

    expect(await navigator.clipboard.readText()).toBe(recoveryCodes.join('\n'))
    expect(await screen.findByText('Recovery codes copied')).toBeInTheDocument()
  })

  it('refuses a code that is not 6 digits without sending it', async () => {
    const api = fakeApi()
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn on' }))
    await u.type(await screen.findByLabelText('Authenticator code'), '12345')
    await u.click(screen.getByRole('button', { name: 'Turn on' }))

    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument()
    expect(api.sent('POST', '/auth/two-factor/enable')).toHaveLength(0)
  })

  it('shows the server message for a wrong code and stays on the setup', async () => {
    fakeApi({ enable: () => new Response('The verification code is invalid.', { status: 400 }) })
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn on' }))
    await u.type(await screen.findByLabelText('Authenticator code'), '000000')
    await u.click(screen.getByRole('button', { name: 'Turn on' }))

    expect(await screen.findByText('The verification code is invalid.')).toBeInTheDocument()
    expect(screen.getByLabelText('Authenticator code')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('img', { name: 'QR code for your authenticator app' })).toBeInTheDocument()
  })

  it('goes back to the start when setup is cancelled', async () => {
    fakeApi()
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn on' }))
    await u.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(screen.queryByLabelText('Authenticator code')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Turn on' })).toBeInTheDocument()
  })

  it('asks before turning off, and sends nothing when cancelled', async () => {
    const api = fakeApi({ enabled: true })
    renderApp('/security')
    const u = userEvent.setup()
    expect(await screen.findByText('On')).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Turn off' }))

    const dialog = within(await screen.findByRole('alertdialog'))
    expect(dialog.getByText('Turn off two-step verification?')).toBeInTheDocument()
    await u.click(dialog.getByRole('button', { name: 'Cancel' }))

    expect(api.sent('POST', '/auth/two-factor/disable')).toHaveLength(0)
    expect(screen.getByText('On')).toBeInTheDocument()
  })

  it('turns off after confirmation and shows it as off', async () => {
    const api = fakeApi({ enabled: true })
    renderApp('/security')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Turn off' }))
    const dialog = within(await screen.findByRole('alertdialog'))
    await u.click(dialog.getByRole('button', { name: 'Turn off' }))

    await waitFor(() => expect(api.sent('POST', '/auth/two-factor/disable')).toHaveLength(1))
    expect(await screen.findByText('Two-step verification is off')).toBeInTheDocument()
    expect(await screen.findByText('Off')).toBeInTheDocument()
  })
})
