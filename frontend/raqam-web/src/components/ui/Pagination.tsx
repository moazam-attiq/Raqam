import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'

interface PaginationProps {
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
  onPageChange: (page: number) => void
}

/** "1–20 of 53" with Previous and Next. Renders nothing when everything fits on one page. */
export function Pagination({ page, pageSize, totalCount, totalPages, onPageChange }: PaginationProps) {
  if (totalPages <= 1) {
    return null
  }
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, totalCount)

  return (
    <nav aria-label="Pages" className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
      <p className="num text-sm text-muted">
        {first}–{last} of {totalCount}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          <ChevronLeft />
          Previous
        </Button>
        <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Next
          <ChevronRight />
        </Button>
      </div>
    </nav>
  )
}
