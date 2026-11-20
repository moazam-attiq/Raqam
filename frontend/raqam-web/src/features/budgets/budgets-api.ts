import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const budgetStatuses = ['OnTrack', 'NearLimit', 'LimitReached'] as const
export type BudgetStatus = (typeof budgetStatuses)[number]

/** A monthly spending limit with how much of it is used (D053). Spending is computed by the server. */
export interface Budget {
  id: string
  year: number
  month: number
  /** Null for the overall budget, which counts all spending. */
  categoryId: string | null
  amount: number
  spent: number
  /** Negative once the limit is passed. */
  remaining: number
  /** Truncated to 2 decimals by the server, so 80 means 80% is really reached. */
  percentUsed: number
  status: BudgetStatus
  createdAtUtc: string
  updatedAtUtc: string
  /** Echoed back on edit; a stale one is rejected with 409. */
  version: number
}

/** Month, year and category are fixed once a budget exists; only the amount changes. */
export interface CreateBudgetInput {
  year: number
  month: number
  amount: number
  categoryId: string | null
}

export const budgetKeys = {
  all: ['budgets'] as const,
  month: (year: number, month: number) => ['budgets', 'month', year, month] as const,
}

export const budgetsApi = {
  list: (year: number, month: number) => api.get<Budget[]>('/budgets', { year, month }),
  get: (id: string) => api.get<Budget>(`/budgets/${id}`),
  create: (input: CreateBudgetInput) => api.post<Budget>('/budgets', input),
  update: (id: string, amount: number, version: number) => api.put<Budget>(`/budgets/${id}`, { amount, version }),
  remove: (id: string) => api.delete(`/budgets/${id}`),
}

export function useBudgets(year: number, month: number) {
  return useQuery({ queryKey: budgetKeys.month(year, month), queryFn: () => budgetsApi.list(year, month) })
}

/** One budget's progress follows its month's transactions, so every budget query is refetched on any change. */
function useRefreshBudgets() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: budgetKeys.all })
}

export function useCreateBudget() {
  const refresh = useRefreshBudgets()
  return useMutation({ mutationFn: budgetsApi.create, onSuccess: refresh })
}

export function useUpdateBudget(id: string) {
  const refresh = useRefreshBudgets()
  return useMutation({
    mutationFn: ({ amount, version }: { amount: number; version: number }) => budgetsApi.update(id, amount, version),
    onSuccess: refresh,
  })
}

export function useDeleteBudget() {
  const refresh = useRefreshBudgets()
  return useMutation({ mutationFn: budgetsApi.remove, onSuccess: refresh })
}
