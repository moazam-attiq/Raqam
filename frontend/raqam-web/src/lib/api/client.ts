import { ApiError, normalizeFieldName } from './errors'
import type { FieldErrors } from './errors'

// D037: a relative path in development (the Vite proxy forwards it); a hosted build sets
// the full API URL.
const baseUrl = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1').replace(/\/+$/, '')

type Method = 'GET' | 'POST' | 'PUT' | 'DELETE'
type QueryValue = string | number | boolean | null | undefined

export interface RequestOptions {
  body?: unknown
  query?: Record<string, QueryValue>
  /** Set false for calls the API exempts from CSRF (sign-in and 2FA verification, D018). */
  csrf?: boolean
  signal?: AbortSignal
}

// ---- CSRF (D018) -----------------------------------------------------------------------

let csrfToken: string | null = null
let csrfRequest: Promise<string> | null = null

/**
 * The token is tied to the signed-in identity, so it must be dropped whenever the
 * identity changes: after sign-in, 2FA verification and sign-out.
 */
export function resetCsrfToken(): void {
  csrfToken = null
}

async function getCsrfToken(): Promise<string> {
  if (csrfToken) {
    return csrfToken
  }
  csrfRequest ??= fetchCsrfToken().finally(() => {
    csrfRequest = null
  })
  csrfToken = await csrfRequest
  return csrfToken
}

async function fetchCsrfToken(): Promise<string> {
  const response = await doFetch(buildUrl('/auth/csrf-token'), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    credentials: 'include',
  })
  if (!response.ok) {
    throw await toApiError(response)
  }
  const body = (await response.json()) as { token?: string }
  if (!body.token) {
    throw new ApiError({ kind: 'unknown', status: response.status, message: 'Could not start a secure session.' })
  }
  return body.token
}

/** The API answers a missing or stale CSRF token with a plain-text 400. */
async function isCsrfRejection(response: Response): Promise<boolean> {
  if (response.status !== 400) {
    return false
  }
  const text = await response.clone().text()
  return text.includes('valid CSRF token')
}

// ---- Requests --------------------------------------------------------------------------

function buildUrl(path: string, query?: Record<string, QueryValue>): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value))
    }
  }
  const queryString = params.toString()
  return `${baseUrl}${path}${queryString ? `?${queryString}` : ''}`
}

async function doFetch(input: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init)
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === 'AbortError') {
      throw cause
    }
    throw new ApiError({
      kind: 'network',
      status: 0,
      message: 'Could not reach the server. Check your connection and try again.',
    })
  }
}

async function execute(method: Method, path: string, options: RequestOptions, isRetry: boolean): Promise<Response> {
  const needsCsrf = method !== 'GET' && options.csrf !== false
  const headers: Record<string, string> = { Accept: 'application/json' }
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
  }
  if (needsCsrf) {
    headers['X-CSRF-TOKEN'] = await getCsrfToken()
  }

  const response = await doFetch(buildUrl(path, options.query), {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: 'include',
    signal: options.signal,
  })

  // The token can go stale (session changed in another tab): fetch a fresh one, once.
  if (needsCsrf && !isRetry && (await isCsrfRejection(response))) {
    resetCsrfToken()
    return execute(method, path, options, true)
  }
  return response
}

export async function apiRequest<T>(method: Method, path: string, options: RequestOptions = {}): Promise<T> {
  const response = await execute(method, path, options, false)
  if (!response.ok) {
    throw await toApiError(response)
  }
  if (response.status === 204) {
    return undefined as T
  }
  return (await readBody(response)) as T
}

export const api = {
  get: <T>(path: string, query?: Record<string, QueryValue>, signal?: AbortSignal) =>
    apiRequest<T>('GET', path, { query, signal }),
  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>) =>
    apiRequest<T>('POST', path, { ...options, body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>('PUT', path, { body }),
  delete: <T = void>(path: string) => apiRequest<T>('DELETE', path),
}

// ---- Errors ----------------------------------------------------------------------------

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) {
    return undefined
  }
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

interface ProblemBody {
  title?: string
  detail?: string
  errors?: Record<string, unknown>
}

function asProblem(body: unknown): ProblemBody {
  return typeof body === 'object' && body !== null ? (body as ProblemBody) : {}
}

function toFieldErrors(errors: ProblemBody['errors']): FieldErrors {
  const result: FieldErrors = {}
  for (const [name, messages] of Object.entries(errors ?? {})) {
    if (Array.isArray(messages)) {
      result[normalizeFieldName(name)] = messages.map(String)
    }
  }
  return result
}

async function toApiError(response: Response): Promise<ApiError> {
  const body = await readBody(response)
  const problem = asProblem(body)
  const { status } = response

  if (status === 400) {
    const fieldErrors = toFieldErrors(problem.errors)
    if (Object.keys(fieldErrors).length > 0) {
      return new ApiError({ kind: 'validation', status, message: 'Please correct the highlighted fields.', fieldErrors })
    }
    const text = typeof body === 'string' ? body : undefined
    return new ApiError({
      kind: 'rule',
      status,
      message: problem.detail ?? text ?? problem.title ?? 'The request could not be completed.',
    })
  }
  if (status === 401) {
    return new ApiError({ kind: 'unauthorized', status, message: 'Your session has ended. Sign in again.' })
  }
  if (status === 404) {
    return new ApiError({ kind: 'notFound', status, message: problem.detail ?? 'That record was not found.' })
  }
  if (status === 409) {
    return new ApiError({
      kind: 'conflict',
      status,
      message: problem.detail ?? 'This was changed elsewhere. Reload it and try again.',
    })
  }
  if (status === 429) {
    return new ApiError({ kind: 'tooManyRequests', status, message: 'Too many attempts. Wait a minute and try again.' })
  }
  if (status >= 500) {
    return new ApiError({ kind: 'server', status, message: 'Something went wrong on our side. Try again.' })
  }
  return new ApiError({ kind: 'unknown', status, message: 'The request could not be completed.' })
}
