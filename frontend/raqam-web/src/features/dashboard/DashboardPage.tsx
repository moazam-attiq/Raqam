import type { UseQueryResult } from '@tanstack/react-query'
import { ArrowRight, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Skeleton } from '@/components/ui/Spinner'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { formatPkr, sumMoney } from '@/lib/money'
import { accountTypeLabels, useAccountBalances, useAccounts } from '@/features/accounts/accounts-api'
import type { Account, AccountBalance } from '@/features/accounts/accounts-api'
import { useCategories } from '@/features/categories/categories-api'
import type { Category } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { parseFilters } from '@/features/transactions/transaction-filters'
import { describeTransaction } from '@/features/transactions/transaction-describe'
import { TransactionAmount } from '@/features/transactions/TransactionAmount'
import { TransactionFormDialog } from '@/features/transactions/TransactionFormDialog'
import { useTransactions } from '@/features/transactions/transactions-api'
import type { TransactionFilters } from '@/features/transactions/transactions-api'

const RECENT_COUNT = 8
/** The newest first, no filters: the same default view as the transactions page. */
// The newest entries overall, not just this month: the page's default is a month, and early in a month that could be empty.
const LATEST: TransactionFilters = { ...parseFilters(new URLSearchParams()), from: '', to: '' }

export function DashboardPage() {
  const [adding, setAdding] = useState(false)
  const accounts = useAccounts(true)
  const categories = useCategories(true)
  const list = accounts.data ?? []
  const noAccounts = accounts.isSuccess && list.every((account) => account.isArchived)

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Where your money stands, and what moved lately."
        actions={
          <Button onClick={() => setAdding(true)} disabled={noAccounts}>
            <Plus />
            New transaction
          </Button>
        }
      />

      <div className="space-y-5">
        <BalancesSection accounts={accounts} />
        <RecentTransactions accounts={list} categories={categories.data ?? []} onAdd={() => setAdding(true)} noAccounts={noAccounts} />
      </div>

      {adding && (
        <TransactionFormDialog open onOpenChange={(open) => !open && setAdding(false)} accounts={list} categories={categories.data ?? []} />
      )}
    </>
  )
}

interface BalancesSectionProps {
  accounts: ReturnType<typeof useAccounts>
}

/** The total across accounts, then each account with its own balance. */
function BalancesSection({ accounts }: BalancesSectionProps) {
  const list = accounts.data ?? []
  const balances = useAccountBalances(list.map((account) => account.id))
  const active = list.filter((account) => !account.isArchived)
  const archivedCount = list.length - active.length

  // Archived accounts keep their history and their money, so they stay in the total.
  const loaded = list.map((account) => balances.get(account.id)?.data?.balance)
  const total = loaded.every((value) => value !== undefined) ? sumMoney(loaded as number[]) : null
  const waiting = list.some((account) => balances.get(account.id)?.isPending)

  if (accounts.isPending) {
    return <Skeleton className="h-40 w-full" />
  }
  if (accounts.isError) {
    return (
      <Card>
        <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
      </Card>
    )
  }
  if (active.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No accounts yet"
          description="Add your cash, bank accounts and wallets to see where your money stands."
          action={
            <Link to="/accounts" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
              Go to accounts
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <div className="grid gap-5 lg:grid-cols-5">
      <Card className="lg:col-span-2">
        <CardHeader>
          <h2 className="text-sm font-semibold text-fg">Total balance</h2>
        </CardHeader>
        <CardBody>
          {waiting ? (
            <Skeleton className="h-10 w-48" />
          ) : total === null ? (
            <p className="text-sm text-muted" role="status">
              Some balances could not be loaded, so there is no total yet.
            </p>
          ) : (
            <p className={cn('num text-3xl font-semibold tracking-tight', total < 0 ? 'text-expense' : 'text-fg')}>{formatPkr(total)}</p>
          )}
          <p className="mt-2 text-sm text-muted">
            Across {list.length} {list.length === 1 ? 'account' : 'accounts'}
            {archivedCount > 0 && `, including ${archivedCount} archived`}
          </p>
        </CardBody>
      </Card>

      <Card className="lg:col-span-3">
        <CardHeader className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-fg">Accounts</h2>
          <SeeAll to="/accounts" label="All accounts" />
        </CardHeader>
        <ul className="divide-y divide-line">
          {active.map((account) => (
            <AccountRow key={account.id} account={account} balance={balances.get(account.id)} />
          ))}
        </ul>
      </Card>
    </div>
  )
}

function AccountRow({ account, balance }: { account: Account; balance: UseQueryResult<AccountBalance> | undefined }) {
  return (
    <li>
      <Link to={`/accounts/${account.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/60">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-fg">{account.name}</span>
          <span className="block text-xs text-muted">{accountTypeLabels[account.accountType]}</span>
        </span>
        <span className="num text-sm font-medium">
          {balance?.isPending ? (
            <Skeleton className="h-5 w-24" />
          ) : balance?.data ? (
            <span className={cn(balance.data.balance < 0 ? 'text-expense' : 'text-fg')}>{formatPkr(balance.data.balance)}</span>
          ) : (
            <span className="text-muted" title="The balance could not be loaded">
              —
            </span>
          )}
        </span>
      </Link>
    </li>
  )
}

interface RecentProps {
  accounts: Account[]
  categories: Category[]
  onAdd: () => void
  noAccounts: boolean
}

function RecentTransactions({ accounts, categories, onAdd, noAccounts }: RecentProps) {
  const recent = useTransactions(LATEST, { pageSize: RECENT_COUNT })
  const accountNames = new Map(accounts.map((account) => [account.id, account.name]))
  const categoryLabels = new Map(categoryOptions(categories, { includeArchived: true }).map((option) => [option.id, option.label]))

  return (
    <Card>
      <CardHeader className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-fg">Recent transactions</h2>
        <SeeAll to="/transactions" label="All transactions" />
      </CardHeader>
      {recent.isPending ? (
        <CardBody role="status" className="space-y-3" aria-label="Loading recent transactions">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-2/3" />
        </CardBody>
      ) : recent.isError ? (
        <ErrorState error={recent.error} onRetry={() => void recent.refetch()} />
      ) : recent.data.items.length === 0 ? (
        <EmptyState
          title="No transactions yet"
          description={noAccounts ? 'Add an account, then record your first transaction.' : 'Record your first income, expense or transfer.'}
          action={
            !noAccounts && (
              <Button size="sm" onClick={onAdd}>
                <Plus />
                New transaction
              </Button>
            )
          }
        />
      ) : (
        <ul className="divide-y divide-line">
          {recent.data.items.map((transaction) => {
            const { category, account } = describeTransaction(transaction, accountNames, categoryLabels)
            return (
              <li key={transaction.id} className="flex items-center gap-3 px-5 py-3">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-fg">
                    {transaction.description || transaction.merchant || <span className="text-muted">No description</span>}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {formatDate(transaction.transactionDate)} · {category} · {account}
                  </span>
                </span>
                <span className="text-sm font-medium">
                  <TransactionAmount transaction={transaction} />
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

function SeeAll({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline">
      {label}
      <ArrowRight className="size-4" aria-hidden="true" />
    </Link>
  )
}
