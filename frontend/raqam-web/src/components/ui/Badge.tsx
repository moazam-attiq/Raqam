import type { ComponentProps } from 'react'
import { cn } from '@/lib/cn'

type Tone = 'neutral' | 'income' | 'expense' | 'transfer' | 'warning'

const tones: Record<Tone, string> = {
  neutral: 'bg-sunken text-muted',
  income: 'bg-income-soft text-income',
  expense: 'bg-expense-soft text-expense',
  transfer: 'bg-transfer-soft text-transfer',
  warning: 'bg-warn-soft text-warn',
}

export function Badge({ tone = 'neutral', className, ...props }: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium', tones[tone], className)}
      {...props}
    />
  )
}
