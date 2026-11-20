export type TransactionType = 'Income' | 'Expense' | 'Transfer'

/** One transaction as the API returns it. Amounts are JSON numbers (at most 2 decimals). */
export interface Transaction {
  id: string
  type: TransactionType
  amount: number
  /** The calendar date, "2026-05-18" (never shifted through UTC, D041). */
  transactionDate: string
  sourceAccountId: string
  destinationAccountId: string | null
  categoryId: string | null
  description: string
  merchant: string | null
  createdAtUtc: string
  updatedAtUtc: string
  version: number
}

export interface Paged<T> {
  items: T[]
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}
