const KEY = 'raqam.lastAccountId'

/** The account used for the last transaction, kept so the next one starts there. Best effort: storage can be blocked. */
export function readLastAccount(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

export function rememberLastAccount(id: string): void {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // Not remembering is fine.
  }
}
