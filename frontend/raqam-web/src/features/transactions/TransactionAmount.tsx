import { cn } from '@/lib/cn'
import { formatPkr } from '@/lib/money'
import type { Transaction } from './types'

/** The amount with its sign and colour: income "+", expense "−", a transfer plain. */
export function TransactionAmount({ transaction }: { transaction: Transaction }) {
  const { type, amount } = transaction
  return (
    <span className={cn('num', type === 'Income' && 'text-income', type === 'Expense' && 'text-expense')}>
      {type === 'Income' ? '+ ' : type === 'Expense' ? '− ' : ''}
      {formatPkr(amount)}
    </span>
  )
}
