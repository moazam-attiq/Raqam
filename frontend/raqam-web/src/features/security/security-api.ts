import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

const BASE = '/auth/two-factor'

export interface TwoFactorStatus {
  enabled: boolean
}

/** What an authenticator app needs: the key to type in and the otpauth:// link a QR code carries. */
export interface TwoFactorSetup {
  sharedKey: string
  authenticatorUri: string
}

export const twoFactorKeys = { status: ['two-factor', 'status'] as const }

export function useTwoFactorStatus() {
  return useQuery({ queryKey: twoFactorKeys.status, queryFn: () => api.get<TwoFactorStatus>(`${BASE}/status`) })
}

/** Asks for the key to add to an authenticator app. Does not turn anything on by itself. */
export function useStartTwoFactorSetup() {
  return useMutation({ mutationFn: () => api.post<TwoFactorSetup>(`${BASE}/setup`) })
}

/** Turns two-step verification on once the app has produced a valid code; answers with the recovery codes, once. */
export function useEnableTwoFactor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (code: string) => api.post<{ recoveryCodes: string[] }>(`${BASE}/enable`, { code }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: twoFactorKeys.status }),
  })
}

export function useDisableTwoFactor() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>(`${BASE}/disable`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: twoFactorKeys.status }),
  })
}

/** "ABCD EFGH IJKL": a key is easier to copy by eye in groups of four. */
export function groupKey(key: string): string {
  return key.replace(/\s+/g, '').replace(/(.{4})(?=.)/g, '$1 ')
}
