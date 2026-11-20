import type { Transaction } from './types'

/** The category and account text for a row: a transfer reads "Transfer" and "From → To". */
export function describeTransaction(
  transaction: Transaction,
  accountNames: Map<string, string>,
  categoryLabels: Map<string, string>,
): { category: string; account: string } {
  const account = (id: string | null) => (id ? (accountNames.get(id) ?? '—') : '—')
  if (transaction.type === 'Transfer') {
    return {
      category: 'Transfer',
      account: `${account(transaction.sourceAccountId)} → ${account(transaction.destinationAccountId)}`,
    }
  }
  return {
    category: transaction.categoryId ? (categoryLabels.get(transaction.categoryId) ?? '—') : '—',
    account: account(transaction.sourceAccountId),
  }
}
