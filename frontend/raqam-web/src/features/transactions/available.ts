import { sumMoney } from '@/lib/money'
import type { Transaction } from './types'

/**
 * What a saved transaction does to one account's balance: income and money transferred in add
 * to it, expenses and money transferred out take from it. The same definition the server uses.
 */
export function effectOn(transaction: Transaction, accountId: string): number {
  const leaves = transaction.sourceAccountId === accountId
  switch (transaction.type) {
    case 'Income':
      return leaves ? transaction.amount : 0
    case 'Expense':
      return leaves ? -transaction.amount : 0
    case 'Transfer':
      return sumMoney([leaves ? -transaction.amount : 0, transaction.destinationAccountId === accountId ? transaction.amount : 0])
  }
}

/**
 * How much an account can pay out in the form (D049: no account goes below zero). When editing,
 * the transaction being edited is taken back out of the balance first, so changing an expense
 * of 60 on an account that now holds 40 can go up to 100. Never negative: an account that is
 * already below zero has nothing available.
 */
export function availableToSpend(balance: number, editing: Transaction | undefined, accountId: string): number {
  const base = editing ? sumMoney([balance, -effectOn(editing, accountId)]) : balance
  return Math.max(base, 0)
}
