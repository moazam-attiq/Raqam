import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { api, resetCsrfToken } from './client'
import { ApiError, normalizeFieldName } from './errors'

const fetchMock = vi.fn<typeof fetch>()

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

function lastCall(index = -1) {
  const calls = fetchMock.mock.calls
  const [url, init] = calls.at(index)!
  return { url: String(url), init: init as RequestInit, headers: init?.headers as Record<string, string> }
}

async function failure(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => null,
    (e: unknown) => e,
  )
  expect(error).toBeInstanceOf(ApiError)
  return error as ApiError
}

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  resetCsrfToken()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('requests', () => {
  it('sends credentials and builds the query string, skipping empty values', async () => {
    fetchMock.mockResolvedValueOnce(json({ ok: true }))

    await api.get('/transactions', { type: 'Expense', search: '', accountId: undefined, page: 2, from: null })

    const { url, init } = lastCall()
    expect(url).toBe('/api/v1/transactions?type=Expense&page=2')
    expect(init.credentials).toBe('include')
    expect(init.method).toBe('GET')
  })

  it('fetches a CSRF token before the first unsafe request and reuses it', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ token: 'token-1' }))
      .mockResolvedValueOnce(json({ id: 'a' }, 201))
      .mockResolvedValueOnce(json({ id: 'b' }, 201))

    await api.post('/accounts', { name: 'Cash' })
    await api.post('/accounts', { name: 'Bank' })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(lastCall(0).url).toBe('/api/v1/auth/csrf-token')
    expect(lastCall(1).headers['X-CSRF-TOKEN']).toBe('token-1')
    expect(lastCall(2).headers['X-CSRF-TOKEN']).toBe('token-1')
    expect(lastCall(1).init.body).toBe(JSON.stringify({ name: 'Cash' }))
  })

  it('does not fetch or send a CSRF token for calls the API exempts', async () => {
    fetchMock.mockResolvedValueOnce(json({ succeeded: true, requiresTwoFactor: false, lockedOut: false }))

    await api.post('/auth/login', { email: 'a@b.c', password: 'x' }, { csrf: false })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(lastCall().headers['X-CSRF-TOKEN']).toBeUndefined()
  })

  it('does not send a CSRF token on GET requests', async () => {
    fetchMock.mockResolvedValueOnce(json([]))

    await api.get('/accounts')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('gets a fresh CSRF token once when the API rejects a stale one', async () => {
    fetchMock
      .mockResolvedValueOnce(json({ token: 'old' }))
      .mockResolvedValueOnce(new Response('A valid CSRF token is required.', { status: 400 }))
      .mockResolvedValueOnce(json({ token: 'new' }))
      .mockResolvedValueOnce(json({ id: 'a' }, 201))

    const result = await api.post<{ id: string }>('/accounts', { name: 'Cash' })

    expect(result).toEqual({ id: 'a' })
    expect(fetchMock).toHaveBeenCalledTimes(4)
    expect(lastCall().headers['X-CSRF-TOKEN']).toBe('new')
  })

  it('does not retry forever when the CSRF token keeps being rejected', async () => {
    const rejection = () => new Response('A valid CSRF token is required.', { status: 400 })
    fetchMock
      .mockResolvedValueOnce(json({ token: 'old' }))
      .mockResolvedValueOnce(rejection())
      .mockResolvedValueOnce(json({ token: 'new' }))
      .mockResolvedValueOnce(rejection())

    const error = await failure(api.post('/accounts', { name: 'Cash' }))

    expect(error.kind).toBe('rule')
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('returns undefined for 204 No Content', async () => {
    fetchMock.mockResolvedValueOnce(json({ token: 't' })).mockResolvedValueOnce(new Response(null, { status: 204 }))

    await expect(api.delete('/transactions/1')).resolves.toBeUndefined()
  })
})

describe('errors', () => {
  it('maps a validation 400 to field errors with camelCase names', async () => {
    fetchMock.mockResolvedValueOnce(
      json(
        {
          title: 'One or more validation errors occurred.',
          status: 400,
          errors: { Amount: ["'Amount' must be greater than '0'."], TransactionDate: ['Required'], '$.sourceAccountId': ['Bad id'] },
        },
        400,
      ),
    )

    const error = await failure(api.get('/transactions'))

    expect(error.kind).toBe('validation')
    expect(error.status).toBe(400)
    expect(error.fieldErrors).toEqual({
      amount: ["'Amount' must be greater than '0'."],
      transactionDate: ['Required'],
      sourceAccountId: ['Bad id'],
    })
  })

  it('maps a business-rule 400 to its detail message', async () => {
    fetchMock.mockResolvedValueOnce(json({ title: 'The request breaks a business rule.', detail: 'Source and destination accounts must differ.' }, 400))

    const error = await failure(api.get('/transactions'))

    expect(error.kind).toBe('rule')
    expect(error.message).toBe('Source and destination accounts must differ.')
  })

  it.each([
    [401, 'unauthorized'],
    [404, 'notFound'],
    [409, 'conflict'],
    [429, 'tooManyRequests'],
    [500, 'server'],
    [503, 'server'],
  ] as const)('maps %i to %s', async (status, kind) => {
    fetchMock.mockResolvedValueOnce(json({ title: 'x' }, status))

    const error = await failure(api.get('/accounts'))

    expect(error.kind).toBe(kind)
    expect(error.status).toBe(status)
  })

  it('uses the server detail for a 404 and a 409 when there is one', async () => {
    fetchMock.mockResolvedValueOnce(json({ detail: 'Account was not found.' }, 404))
    fetchMock.mockResolvedValueOnce(json({ detail: 'An account with that name already exists.' }, 409))

    expect((await failure(api.get('/a'))).message).toBe('Account was not found.')
    expect((await failure(api.get('/b'))).message).toBe('An account with that name already exists.')
  })

  it('reports a network failure without throwing a raw TypeError', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    const error = await failure(api.get('/accounts'))

    expect(error.kind).toBe('network')
    expect(error.status).toBe(0)
  })

  it('lets an aborted request through as an abort, not an API error', async () => {
    fetchMock.mockRejectedValueOnce(new DOMException('Aborted', 'AbortError'))

    await expect(api.get('/accounts')).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('normalizeFieldName', () => {
  it.each([
    ['Amount', 'amount'],
    ['TransactionDate', 'transactionDate'],
    ['$.amount', 'amount'],
    ['$.Items.Name', 'items.name'],
    ['', ''],
  ])('%s -> %s', (input, expected) => {
    expect(normalizeFieldName(input)).toBe(expected)
  })
})
