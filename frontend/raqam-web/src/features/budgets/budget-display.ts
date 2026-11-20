import { formatPkr } from '@/lib/money'
import type { Budget, BudgetStatus } from './budgets-api'

export const statusLabels: Record<BudgetStatus, string> = {
  OnTrack: 'On track',
  NearLimit: 'Near limit',
  LimitReached: 'Limit reached',
}

/** The share used as a whole number, never rounded up: "79%" stays 79 even at 79.99. */
export function percentText(budget: Pick<Budget, 'percentUsed'>): string {
  return `${Math.floor(budget.percentUsed)}%`
}

/** What is left, or by how much the limit was passed. */
export function remainingText(budget: Pick<Budget, 'remaining'>): string {
  if (budget.remaining < 0) {
    return `Over by ${formatPkr(-budget.remaining)}`
  }
  return `${formatPkr(budget.remaining)} left`
}

/** One sentence for the alerts above the list. Null when the budget needs no attention. */
export function alertText(label: string, budget: Budget): string | null {
  if (budget.status === 'OnTrack') {
    return null
  }
  if (budget.status === 'NearLimit') {
    return `${label} has used ${percentText(budget)} of its budget.`
  }
  return budget.remaining < 0
    ? `${label} is over budget by ${formatPkr(-budget.remaining)}.`
    : `${label} has used all of its budget.`
}
