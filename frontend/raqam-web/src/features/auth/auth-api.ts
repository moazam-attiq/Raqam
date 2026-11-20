import { api } from '@/lib/api/client'
import { isApiError } from '@/lib/api/errors'

export interface SessionUser {
  id: string
  email: string
}

/** The API answers every sign-in step with 200 and these flags, so a wrong password is not an error. */
export interface SignInResult {
  succeeded: boolean
  requiresTwoFactor: boolean
  lockedOut: boolean
}

export const authApi = {
  /** The signed-in user, or null when there is no session (the API answers 401). */
  async me(): Promise<SessionUser | null> {
    try {
      return await api.get<SessionUser>('/auth/me')
    } catch (error) {
      if (isApiError(error) && error.kind === 'unauthorized') {
        return null
      }
      throw error
    }
  },

  // Sign-in and the 2FA steps are exempt from CSRF: there is no session yet to tie a token to (D018).
  signIn: (email: string, password: string) =>
    api.post<SignInResult>('/auth/login', { email, password }, { csrf: false }),
  verifyCode: (code: string) => api.post<SignInResult>('/auth/two-factor/verify', { code }, { csrf: false }),
  redeemRecoveryCode: (code: string) => api.post<SignInResult>('/auth/two-factor/recovery-code', { code }, { csrf: false }),

  signOut: () => api.post<void>('/auth/logout'),
}
