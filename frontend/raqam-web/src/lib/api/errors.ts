export type ApiErrorKind =
  | 'validation' // 400 with per-field messages
  | 'rule' // 400 for a broken business rule or an unusable request
  | 'unauthorized' // 401
  | 'notFound' // 404
  | 'conflict' // 409 (stale version or duplicate)
  | 'tooManyRequests' // 429
  | 'server' // 5xx
  | 'network' // the request never got an answer
  | 'unknown'

/** Field name -> messages. Keys are camelCase so they match form field names. */
export type FieldErrors = Record<string, string[]>

interface ApiErrorInit {
  kind: ApiErrorKind
  status: number
  message: string
  fieldErrors?: FieldErrors
}

/** Every failed API call becomes one of these; `message` is safe to show to the user. */
export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(init: ApiErrorInit) {
    super(init.message)
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status
    this.fieldErrors = init.fieldErrors ?? {}
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/**
 * The API names fields as the C# property ("TransactionDate") or a JSON path
 * ("$.amount"); forms use camelCase ("transactionDate"). Nested names keep their dots.
 */
export function normalizeFieldName(name: string): string {
  return name
    .replace(/^\$\.?/, '')
    .split('.')
    .filter((segment) => segment.length > 0)
    .map((segment) => segment.charAt(0).toLowerCase() + segment.slice(1))
    .join('.')
}

/** A message that is safe to show for any thrown value. */
export function errorMessage(error: unknown): string {
  return isApiError(error) ? error.message : 'Something went wrong. Try again.'
}
