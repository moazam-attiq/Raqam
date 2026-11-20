import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/lib/api/errors'

/** Where the signed-in user lives in the cache: the user, or null when signed out. */
export const SESSION_QUERY_KEY = ['session'] as const

/**
 * Server state lives in TanStack Query (D040). A 4xx answer is final, so it is not retried;
 * only network failures and 5xx get up to two more tries. Any 401 from the API means the
 * session has ended, so the cached user is cleared and the route guard sends the person to
 * sign in again.
 */
export function createQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isApiError(error) && error.kind === 'unauthorized' && query.queryKey[0] !== SESSION_QUERY_KEY[0]) {
          client.setQueryData(SESSION_QUERY_KEY, null)
        }
      },
    }),
    mutationCache: new MutationCache({
      onError: (error) => {
        if (isApiError(error) && error.kind === 'unauthorized') {
          client.setQueryData(SESSION_QUERY_KEY, null)
        }
      },
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (isApiError(error) && error.status >= 400 && error.status < 500) {
            return false
          }
          return failureCount < 2
        },
      },
    },
  })
  return client
}
