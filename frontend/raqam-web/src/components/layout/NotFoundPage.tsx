import { Link } from 'react-router'
import { EmptyState } from '@/components/ui/EmptyState'

export function NotFoundPage() {
  return (
    <EmptyState
      title="Page not found"
      description="That page does not exist."
      action={
        <Link to="/" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
          Go to the dashboard
        </Link>
      }
    />
  )
}
