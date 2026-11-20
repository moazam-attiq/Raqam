import { Navigate, Outlet, useLocation } from 'react-router'
import { ErrorState } from '@/components/ui/ErrorState'
import { Spinner } from '@/components/ui/Spinner'
import { useSession } from './session'

/** Wraps every page that needs a signed-in user; anyone else goes to the sign-in screen and back. */
export function RequireAuth() {
  const session = useSession()
  const location = useLocation()

  if (session.isPending) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Spinner className="size-8" label="Checking your session" />
      </div>
    )
  }
  if (session.isError) {
    return (
      <div className="grid min-h-screen place-items-center">
        <ErrorState error={session.error} onRetry={() => void session.refetch()} />
      </div>
    )
  }
  if (!session.data) {
    return <Navigate to="/sign-in" replace state={{ from: `${location.pathname}${location.search}` }} />
  }
  return <Outlet />
}
