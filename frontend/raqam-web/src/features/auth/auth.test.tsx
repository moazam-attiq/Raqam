import { QueryClient } from '@tanstack/react-query'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/errors'
import { createQueryClient, SESSION_QUERY_KEY } from '@/lib/query-client'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'

const user = { id: '1', email: 'me@example.com' }
const ok = { succeeded: true, requiresTwoFactor: false, lockedOut: false }
const wrong = { succeeded: false, requiresTwoFactor: false, lockedOut: false }

/** What a sign-in step answers: a status and a JSON body. */
type Answer = { status?: number; body?: unknown }

/**
 * A fake API with a session: signed out until a sign-in step answers `succeeded: true`.
 * `answers` maps "METHOD /path" to what that call returns.
 */
function fakeApi(answers: Record<string, () => Answer>) {
  let signedIn = false
  return mockApi((call: Call) => {
    const key = `${call.method} ${call.path}`
    if (key === 'GET /auth/me') {
      return signedIn ? json(user) : new Response(null, { status: 401 })
    }
    if (key === 'POST /auth/logout') {
      signedIn = false
      return new Response(null, { status: 204 })
    }
    const answer = answers[key]?.()
    if (!answer) {
      return undefined
    }
    if ((answer.body as { succeeded?: boolean } | undefined)?.succeeded) {
      signedIn = true
    }
    return answer.body === undefined ? new Response(null, { status: answer.status }) : json(answer.body, answer.status)
  })
}

async function typeCredentials(email = 'me@example.com', password = 'Pa55word!') {
  const u = userEvent.setup()
  await u.type(await screen.findByLabelText('Email'), email)
  await u.type(screen.getByLabelText('Password'), password)
  await u.click(screen.getByRole('button', { name: 'Sign in' }))
  return u
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the route guard', () => {
  it('sends a signed-out visitor to sign in', async () => {
    fakeApi({})
    renderApp('/accounts')

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Main' })).not.toBeInTheDocument()
  })

  it('takes a signed-in visitor straight past the sign-in screen', async () => {
    mockApi((call) => (call.path === '/auth/me' ? json(user) : undefined))
    renderApp('/sign-in')

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
  })

  it('shows a retry when the session check itself fails', async () => {
    mockApi(() => json({ title: 'down' }, 503))
    renderApp('/')

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('signing in', () => {
  it('opens the page the person asked for after signing in', async () => {
    const api = fakeApi({ 'POST /auth/login': () => ({ body: ok }) })
    renderApp('/transactions')

    await typeCredentials()

    expect(await screen.findByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument()
    expect(api.sent('POST', '/auth/login')[0]!.body).toEqual({ email: 'me@example.com', password: 'Pa55word!' })
  })

  it('sends the sign-in without a CSRF header (the API exempts it)', async () => {
    const api = fakeApi({ 'POST /auth/login': () => ({ body: ok }) })
    renderApp('/sign-in')

    await typeCredentials()
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    expect(api.sent('POST', '/auth/login')[0]!.headers['X-CSRF-TOKEN']).toBeUndefined()
  })

  it('says the details are wrong without saying which one', async () => {
    fakeApi({ 'POST /auth/login': () => ({ body: wrong }) })
    renderApp('/sign-in')

    await typeCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect.')
    expect(screen.getByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  })

  it('tells the person when the account is locked', async () => {
    fakeApi({ 'POST /auth/login': () => ({ body: { ...wrong, lockedOut: true } }) })
    renderApp('/sign-in')

    await typeCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(/locked/i)
  })

  it('tells the person to wait after too many attempts', async () => {
    fakeApi({ 'POST /auth/login': () => ({ status: 429 }) })
    renderApp('/sign-in')

    await typeCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many attempts/i)
  })

  it('checks the form before sending anything', async () => {
    const api = fakeApi({ 'POST /auth/login': () => ({ body: ok }) })
    const u = userEvent.setup()
    renderApp('/sign-in')

    await u.click(await screen.findByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText('Enter your email.')).toBeInTheDocument()
    expect(screen.getByText('Enter your password.')).toBeInTheDocument()
    expect(api.sent('POST', '/auth/login')).toHaveLength(0)
  })

  it('shows and hides the password', async () => {
    fakeApi({})
    const u = userEvent.setup()
    renderApp('/sign-in')

    const field = await screen.findByLabelText('Password')
    expect(field).toHaveAttribute('type', 'password')
    await u.click(screen.getByRole('button', { name: 'Show password' }))
    expect(field).toHaveAttribute('type', 'text')
    await u.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(field).toHaveAttribute('type', 'password')
  })

  it('explains when the browser did not keep the session cookie', async () => {
    mockApi((call) => {
      if (call.path === '/auth/me') return new Response(null, { status: 401 })
      if (call.path === '/auth/login') return json(ok)
      return undefined
    })
    renderApp('/sign-in')

    await typeCredentials()

    expect(await screen.findByRole('alert')).toHaveTextContent(/did not keep the session/i)
  })
})

describe('two-step verification', () => {
  const twoFactor = { succeeded: false, requiresTwoFactor: true, lockedOut: false }

  async function toCodeStep() {
    renderApp('/sign-in')
    const u = await typeCredentials()
    await screen.findByRole('heading', { level: 1, name: 'Two-step verification' })
    return u
  }

  it('asks for the code and signs in with it', async () => {
    const api = fakeApi({
      'POST /auth/login': () => ({ body: twoFactor }),
      'POST /auth/two-factor/verify': () => ({ body: ok }),
    })
    const u = await toCodeStep()

    // People type the code with a space in the middle; the API gets plain digits.
    await u.type(screen.getByLabelText('Authenticator code'), '123 456')
    await u.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(api.sent('POST', '/auth/two-factor/verify')[0]!.body).toEqual({ code: '123456' })
  })

  it('rejects a code that is not six digits without calling the API', async () => {
    const api = fakeApi({ 'POST /auth/login': () => ({ body: twoFactor }) })
    const u = await toCodeStep()

    await u.type(screen.getByLabelText('Authenticator code'), '12ab')
    await u.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByText('Enter the 6-digit code.')).toBeInTheDocument()
    expect(api.sent('POST', '/auth/two-factor/verify')).toHaveLength(0)
  })

  it('says when the code is wrong', async () => {
    fakeApi({ 'POST /auth/login': () => ({ body: twoFactor }), 'POST /auth/two-factor/verify': () => ({ body: wrong }) })
    const u = await toCodeStep()

    await u.type(screen.getByLabelText('Authenticator code'), '000000')
    await u.click(screen.getByRole('button', { name: 'Verify' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/code is not valid/i)
  })

  it('signs in with a recovery code instead', async () => {
    const api = fakeApi({
      'POST /auth/login': () => ({ body: twoFactor }),
      'POST /auth/two-factor/recovery-code': () => ({ body: ok }),
    })
    const u = await toCodeStep()

    await u.click(screen.getByRole('button', { name: 'Use a recovery code' }))
    await u.type(await screen.findByLabelText('Recovery code'), 'ABCDE-12345')
    await u.click(screen.getByRole('button', { name: 'Use recovery code' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument()
    expect(api.sent('POST', '/auth/two-factor/recovery-code')[0]!.body).toEqual({ code: 'ABCDE-12345' })
  })

  it('goes back to the password step', async () => {
    fakeApi({ 'POST /auth/login': () => ({ body: twoFactor }) })
    const u = await toCodeStep()

    await u.click(screen.getByRole('button', { name: 'Back to sign in' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
  })
})

describe('signing out', () => {
  it('ends the session and returns to sign-in', async () => {
    const api = fakeApi({ 'POST /auth/login': () => ({ body: ok }) })
    renderApp('/sign-in')
    const u = await typeCredentials()
    await screen.findByRole('heading', { level: 1, name: 'Dashboard' })

    expect(screen.getAllByText('me@example.com').length).toBeGreaterThan(0)
    await u.click(screen.getAllByRole('button', { name: 'Sign out' })[0]!)

    expect(await screen.findByRole('heading', { level: 1, name: 'Sign in' })).toBeInTheDocument()
    expect(api.sent('POST', '/auth/logout')).toHaveLength(1)
    // Unsafe requests carry the CSRF token (D018).
    expect(api.sent('POST', '/auth/logout')[0]!.headers['X-CSRF-TOKEN']).toBe('test-token')
  })
})

describe('an expired session', () => {
  it('clears the signed-in user when any request answers 401', async () => {
    const client: QueryClient = createQueryClient()
    client.setQueryData(SESSION_QUERY_KEY, user)

    await client
      .fetchQuery({
        queryKey: ['accounts'],
        queryFn: () => Promise.reject(new ApiError({ kind: 'unauthorized', status: 401, message: 'ended' })),
        retry: false,
      })
      .catch(() => undefined)

    await waitFor(() => expect(client.getQueryData(SESSION_QUERY_KEY)).toBeNull())
  })

  it('leaves the session alone for other failures', async () => {
    const client = createQueryClient()
    client.setQueryData(SESSION_QUERY_KEY, user)

    await client
      .fetchQuery({
        queryKey: ['accounts'],
        queryFn: () => Promise.reject(new ApiError({ kind: 'server', status: 500, message: 'oops' })),
        retry: false,
      })
      .catch(() => undefined)

    expect(client.getQueryData(SESSION_QUERY_KEY)).toEqual(user)
  })
})
