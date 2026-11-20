import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { formatPkr } from '@/lib/money'
import { useCategories } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { alertText, percentText, remainingText, statusLabels } from './budget-display'
import { canShift, currentMonth, formatMonthParam, isSameMonth, monthLabel, parseMonth, shiftMonth } from './budget-month'
import type { Month } from './budget-month'
import { BudgetFormDialog } from './BudgetFormDialog'
import type { BudgetFormProps } from './BudgetFormDialog'
import { useBudgets, useDeleteBudget } from './budgets-api'
import type { Budget, BudgetStatus } from './budgets-api'

const statusTone = { OnTrack: 'income', NearLimit: 'warning', LimitReached: 'expense' } as const
const barFill: Record<BudgetStatus, string> = { OnTrack: 'bg-brand', NearLimit: 'bg-warn', LimitReached: 'bg-expense' }

export function BudgetsPage() {
  const [params, setParams] = useSearchParams()
  const now = currentMonth()
  const month = parseMonth(params.get('month')) ?? now
  const [form, setForm] = useState<Pick<BudgetFormProps, 'budget' | 'label'> | { adding: true } | null>(null)
  const [deleting, setDeleting] = useState<{ budget: Budget; label: string } | null>(null)
  const { notify } = useToast()

  const budgets = useBudgets(month.year, month.month)
  const categories = useCategories(true)
  const remove = useDeleteBudget()

  const list = budgets.data ?? []
  const all = categories.data ?? []
  // "Food › Groceries" for a subcategory, "(archived)" for one that no longer takes new transactions.
  const labels = new Map(categoryOptions(all, { type: 'Expense', includeArchived: true }).map((option) => [option.id, option.label]))
  const labelOf = (budget: Budget) =>
    budget.categoryId === null ? 'Overall budget' : (labels.get(budget.categoryId) ?? 'Unknown category')

  const alerts = list.flatMap((budget) => {
    const text = alertText(labelOf(budget), budget)
    return text ? [{ id: budget.id, text, status: budget.status }] : []
  })

  function go(next: Month) {
    setParams(isSameMonth(next, now) ? {} : { month: formatMonthParam(next) }, { replace: true })
  }

  function confirmDelete() {
    if (!deleting) {
      return
    }
    remove.mutate(deleting.budget.id, {
      onSuccess: () => {
        notify('Budget deleted', 'success')
        setDeleting(null)
      },
      onError: (error) => {
        notify(errorMessage(error), 'error')
        setDeleting(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Budgets"
        description="Set a limit for the month and see how much of it is used."
        actions={
          <Button onClick={() => setForm({ adding: true })}>
            <Plus />
            New budget
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-0.5">
          <IconButton
            label="Previous month"
            icon={<ChevronLeft />}
            disabled={!canShift(month, -1)}
            onClick={() => go(shiftMonth(month, -1))}
          />
          <h2 aria-live="polite" className="min-w-40 px-2 text-center text-sm font-semibold text-fg">
            {monthLabel(month)}
          </h2>
          <IconButton
            label="Next month"
            icon={<ChevronRight />}
            disabled={!canShift(month, 1)}
            onClick={() => go(shiftMonth(month, 1))}
          />
        </div>
        {!isSameMonth(month, now) && (
          <Button variant="secondary" size="sm" onClick={() => go(now)}>
            This month
          </Button>
        )}
      </div>

      {alerts.length > 0 && (
        <section
          aria-label="Budget alerts"
          className={cn(
            'mb-4 flex gap-3 rounded-xl border px-4 py-3 text-sm text-fg',
            alerts.some((alert) => alert.status === 'LimitReached')
              ? 'border-expense/40 bg-expense-soft'
              : 'border-warn/40 bg-warn-soft',
          )}
        >
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <ul className="space-y-1">
            {alerts.map((alert) => (
              <li key={alert.id}>{alert.text}</li>
            ))}
          </ul>
        </section>
      )}

      <Card>
        {budgets.isPending ? (
          <div role="status" aria-label="Loading budgets" className="space-y-4 p-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-2/3" />
          </div>
        ) : budgets.isError ? (
          <ErrorState error={budgets.error} onRetry={() => void budgets.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title={`No budgets for ${monthLabel(month)}`}
            description="Set an overall limit, or one for a category like Food."
            action={
              <Button size="sm" onClick={() => setForm({ adding: true })}>
                <Plus />
                New budget
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((budget) => (
              <BudgetRow
                key={budget.id}
                budget={budget}
                label={labelOf(budget)}
                onEdit={() => setForm({ budget, label: labelOf(budget) })}
                onDelete={() => setDeleting({ budget, label: labelOf(budget) })}
              />
            ))}
          </ul>
        )}
      </Card>

      {form && (
        <BudgetFormDialog
          open
          onOpenChange={(open) => !open && setForm(null)}
          month={month}
          existing={list}
          categories={all}
          {...('adding' in form ? {} : form)}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title={`Delete the ${deleting?.label ?? ''} budget?`}
        description={`This removes the limit for ${monthLabel(month)}. Your transactions are not affected.`}
        confirmLabel="Delete budget"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}

interface BudgetRowProps {
  budget: Budget
  label: string
  onEdit: () => void
  onDelete: () => void
}

function BudgetRow({ budget, label, onEdit, onDelete }: BudgetRowProps) {
  const width = Math.min(100, Math.max(0, budget.percentUsed))
  return (
    <li className="px-5 py-4">
      <div className="flex items-center gap-3">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-fg">{label}</h3>
        <Badge tone={statusTone[budget.status]}>{statusLabels[budget.status]}</Badge>
        <span className="flex shrink-0 gap-1">
          <IconButton label={`Edit ${label} budget`} icon={<Pencil />} onClick={onEdit} />
          <IconButton label={`Delete ${label} budget`} icon={<Trash2 />} tone="danger" onClick={onDelete} />
        </span>
      </div>

      <div
        role="progressbar"
        aria-label={`${label} budget used`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(width)}
        aria-valuetext={`${percentText(budget)} used`}
        className="mt-3 h-2 overflow-hidden rounded-full bg-sunken"
      >
        <div className={cn('h-full rounded-full', barFill[budget.status])} style={{ width: `${width}%` }} />
      </div>

      <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm">
        <p className="num text-muted">
          <span className="font-medium text-fg">{formatPkr(budget.spent)}</span> of {formatPkr(budget.amount)} · {percentText(budget)}{' '}
          used
        </p>
        <p className={cn('num', budget.remaining < 0 ? 'font-medium text-expense' : 'text-muted')}>{remainingText(budget)}</p>
      </div>
    </li>
  )
}
