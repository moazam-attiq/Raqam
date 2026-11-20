import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import { accountKeys } from '@/features/accounts/accounts-api'
import { budgetKeys } from '@/features/budgets/budgets-api'
import type { Paged, Transaction, TransactionType } from './types'

export const transactionTypes = ['Expense', 'Income', 'Transfer'] as const

export const transactionSorts = ['DateDesc', 'DateAsc', 'AmountDesc', 'AmountAsc'] as const
export type TransactionSort = (typeof transactionSorts)[number]

export const transactionSortLabels: Record<TransactionSort, string> = {
  DateDesc: 'Newest first',
  DateAsc: 'Oldest first',
  AmountDesc: 'Highest amount',
  AmountAsc: 'Lowest amount',
}

export const DESCRIPTION_MAX = 500
export const MERCHANT_MAX = 200
export const SEARCH_MAX = 100
export const PAGE_SIZE = 20

/** What the filter bar and the URL hold. An empty string means "no filter". */
export interface TransactionFilters {
  from: string
  to: string
  type: TransactionType | ''
  accountId: string
  categoryId: string
  search: string
  sort: TransactionSort
  page: number
}

/** Everything the form sends. Type decides which of the account and category fields apply. */
export interface TransactionInput {
  type: TransactionType
  amount: number
  transactionDate: string
  sourceAccountId: string
  destinationAccountId: string | null
  categoryId: string | null
  description: string
  merchant: string | null
}

export const transactionKeys = {
  all: ['transactions'] as const,
  list: (filters: TransactionFilters, pageSize: number) => ['transactions', 'list', filters, pageSize] as const,
}

export const transactionsApi = {
  list: (filters: TransactionFilters, pageSize = PAGE_SIZE) =>
    api.get<Paged<Transaction>>('/transactions', {
      from: filters.from || undefined,
      to: filters.to || undefined,
      type: filters.type || undefined,
      accountId: filters.accountId || undefined,
      categoryId: filters.categoryId || undefined,
      search: filters.search || undefined,
      sort: filters.sort,
      page: filters.page,
      pageSize,
    }),
  get: (id: string) => api.get<Transaction>(`/transactions/${id}`),
  create: (input: TransactionInput) => api.post<Transaction>('/transactions', input),
  update: (id: string, input: TransactionInput, version: number) =>
    api.put<Transaction>(`/transactions/${id}`, { ...input, version }),
  remove: (id: string) => api.delete(`/transactions/${id}`),
}

export function useTransactions(filters: TransactionFilters, { enabled = true, pageSize = PAGE_SIZE } = {}) {
  return useQuery({
    queryKey: transactionKeys.list(filters, pageSize),
    queryFn: () => transactionsApi.list(filters, pageSize),
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Balances and budget progress come from the ledger, so any change here also refreshes account balances, histories and budgets. */
function useRefreshLedger() {
  const queryClient = useQueryClient()
  return async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: transactionKeys.all }),
      queryClient.invalidateQueries({ queryKey: accountKeys.all }),
      queryClient.invalidateQueries({ queryKey: budgetKeys.all }),
    ])
  }
}

export function useCreateTransaction() {
  const refresh = useRefreshLedger()
  return useMutation({ mutationFn: transactionsApi.create, onSuccess: refresh })
}

export function useUpdateTransaction(id: string) {
  const refresh = useRefreshLedger()
  return useMutation({
    mutationFn: ({ input, version }: { input: TransactionInput; version: number }) =>
      transactionsApi.update(id, input, version),
    onSuccess: refresh,
  })
}

export function useDeleteTransaction() {
  const refresh = useRefreshLedger()
  return useMutation({ mutationFn: transactionsApi.remove, onSuccess: refresh })
}
