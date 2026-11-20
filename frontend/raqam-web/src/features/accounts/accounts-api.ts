import { keepPreviousData, useMutation, useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'
import type { Paged, Transaction } from '@/features/transactions/types'

export const accountTypes = ['Cash', 'BankAccount', 'DigitalWallet', 'SavingsAccount'] as const
export type AccountType = (typeof accountTypes)[number]

export const accountTypeLabels: Record<AccountType, string> = {
  Cash: 'Cash',
  BankAccount: 'Bank account',
  DigitalWallet: 'Digital wallet',
  SavingsAccount: 'Savings account',
}

export const ACCOUNT_NAME_MAX = 100
export const INSTITUTION_NAME_MAX = 100
export const HISTORY_PAGE_SIZE = 20

export interface Account {
  id: string
  name: string
  accountType: AccountType
  openingBalance: number
  currencyCode: string
  institutionName: string | null
  isArchived: boolean
  createdAtUtc: string
  updatedAtUtc: string
  /** Echoed back on edit; a stale one is rejected with 409. */
  version: number
}

export interface AccountInput {
  name: string
  accountType: AccountType
  openingBalance: number
  institutionName: string | null
}

/** Balance = opening + income − expense + transfers in − transfers out (spec §6.4). */
export interface AccountBalance {
  accountId: string
  currencyCode: string
  openingBalance: number
  income: number
  expense: number
  transfersIn: number
  transfersOut: number
  balance: number
}

export const accountKeys = {
  all: ['accounts'] as const,
  list: (includeArchived: boolean) => ['accounts', 'list', includeArchived] as const,
  detail: (id: string) => ['accounts', 'detail', id] as const,
  balance: (id: string) => ['accounts', 'balance', id] as const,
  history: (id: string, page: number) => ['accounts', 'history', id, page] as const,
}

export const accountsApi = {
  list: (includeArchived: boolean) => api.get<Account[]>('/accounts', { includeArchived: includeArchived || undefined }),
  get: (id: string) => api.get<Account>(`/accounts/${id}`),
  balance: (id: string) => api.get<AccountBalance>(`/accounts/${id}/balance`),
  history: (id: string, page: number) =>
    api.get<Paged<Transaction>>(`/accounts/${id}/transactions`, { page, pageSize: HISTORY_PAGE_SIZE }),
  create: (input: AccountInput) => api.post<Account>('/accounts', input),
  update: (id: string, input: AccountInput, version: number) => api.put<Account>(`/accounts/${id}`, { ...input, version }),
  archive: (id: string) => api.post<Account>(`/accounts/${id}/archive`),
}

export function useAccounts(includeArchived: boolean) {
  return useQuery({ queryKey: accountKeys.list(includeArchived), queryFn: () => accountsApi.list(includeArchived) })
}

/** One balance request per account; returns them by account id as they arrive. */
export function useAccountBalances(ids: string[]) {
  return useQueries({
    queries: ids.map((id) => ({ queryKey: accountKeys.balance(id), queryFn: () => accountsApi.balance(id) })),
    combine: (results) => new Map(ids.map((id, index) => [id, results[index]!] as const)),
  })
}

export function useAccount(id: string) {
  return useQuery({ queryKey: accountKeys.detail(id), queryFn: () => accountsApi.get(id) })
}

export function useAccountBalance(id: string, enabled = true) {
  return useQuery({ queryKey: accountKeys.balance(id), queryFn: () => accountsApi.balance(id), enabled })
}

export function useAccountHistory(id: string, page: number) {
  return useQuery({
    queryKey: accountKeys.history(id, page),
    queryFn: () => accountsApi.history(id, page),
    placeholderData: keepPreviousData,
  })
}

/** Creating, editing or archiving changes balances and lists, so all account data is refetched. */
function useRefreshAccounts() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: accountKeys.all })
}

export function useCreateAccount() {
  const refresh = useRefreshAccounts()
  return useMutation({ mutationFn: accountsApi.create, onSuccess: refresh })
}

export function useUpdateAccount(id: string) {
  const refresh = useRefreshAccounts()
  return useMutation({
    mutationFn: ({ input, version }: { input: AccountInput; version: number }) => accountsApi.update(id, input, version),
    onSuccess: refresh,
  })
}

export function useArchiveAccount() {
  const refresh = useRefreshAccounts()
  return useMutation({ mutationFn: accountsApi.archive, onSuccess: refresh })
}
