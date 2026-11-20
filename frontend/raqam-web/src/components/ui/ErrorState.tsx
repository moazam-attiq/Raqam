import { RefreshCw } from 'lucide-react'
import { errorMessage } from '@/lib/api/errors'
import { Button } from './Button'

interface ErrorStateProps {
  /** Whatever was thrown; an API error shows its own message. */
  error: unknown
  onRetry?: () => void
}

export function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <p className="text-sm font-medium text-danger">{errorMessage(error)}</p>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          Try again
        </Button>
      )}
    </div>
  )
}
