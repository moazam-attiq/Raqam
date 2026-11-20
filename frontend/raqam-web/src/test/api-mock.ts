import { vi } from 'vitest'
import { resetCsrfToken } from '@/lib/api/client'

export interface Call {
  method: string
  path: string
  /** The query string as name/value pairs. */
  query: Record<string, string>
  body: unknown
  headers: Record<string, string>
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

/**
 * Replaces `fetch` for one test. The handler answers each call by method and path (the
 * `/api/v1` prefix is removed); the CSRF token endpoint is answered automatically. `calls`
 * records everything that was sent.
 */
export function mockApi(handler: (call: Call) => Response | undefined) {
  const calls: Call[] = []
  resetCsrfToken()
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const [path = '', search = ''] = String(input).replace(/^.*\/api\/v1/, '').split('?')
      const call: Call = {
        method: init?.method ?? 'GET',
        path,
        query: Object.fromEntries(new URLSearchParams(search)),
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      }
      calls.push(call)
      if (path === '/auth/csrf-token') {
        return json({ token: 'test-token' })
      }
      return handler(call) ?? json({ title: `No test answer for ${call.method} ${path}` }, 500)
    }),
  )
  return { calls, sent: (method: string, path: string) => calls.filter((c) => c.method === method && c.path === path) }
}
