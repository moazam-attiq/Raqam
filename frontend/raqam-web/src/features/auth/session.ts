import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { resetCsrfToken } from '@/lib/api/client'
import { SESSION_QUERY_KEY } from '@/lib/query-client'
import { authApi } from './auth-api'

/** The signed-in user: `data` is the user, null when signed out. */
export function useSession() {
  return useQuery({ queryKey: SESSION_QUERY_KEY, queryFn: authApi.me, staleTime: Infinity })
}

/** Stores the user after a successful sign-in. The CSRF token belongs to the old identity, so it is dropped. */
export function useStartSession() {
  const queryClient = useQueryClient()
  return async () => {
    resetCsrfToken()
    const user = await authApi.me()
    queryClient.setQueryData(SESSION_QUERY_KEY, user)
    return user
  }
}

export function useSignOut() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  return useMutation({
    mutationFn: authApi.signOut,
    onSettled: () => {
      // Whatever the server said, this browser is done: forget the identity and everything cached for it.
      resetCsrfToken()
      queryClient.clear()
      queryClient.setQueryData(SESSION_QUERY_KEY, null)
      navigate('/sign-in', { replace: true })
    },
  })
}
