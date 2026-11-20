import { Archive, ArrowLeft, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Spinner'
import { Table, Td, Th } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage, isApiError } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { formatPkr } from '@/lib/money'
import type { Transaction } from '@/features/transactions/types'
import { AccountFormDialog } from './AccountFormDialog'
import {
  accountTypeLabels,
  useAccount,
  useAccountBalance,
  useAccountHistory,
  useArchiveAccount,
} from './accounts-api'
import type { AccountBalance } from './accounts-api'

export function AccountDetailPage() {
  const { id = '' } = useParams()
  const account = useAccount(id)
  const [editing, setEditing] = useState(false)
  const [archiving, setArchiving] = useState(false)
  const archive = useArchiveAccount()
  const { notify } = useToast()

  if (account.isPending) {
    return (
      <div role="status" aria-label="Loading account">
        <Skeleton className="h-24 w-full" />
      </div>
    )
  }
  if (account.isError) {
    return (
      <>
        {/* The page needs a title even when the account itself could not be shown. */}
        <h1 className="sr-only">Account</h1>
        {isApiError(account.error) && account.error.kind === 'notFound' ? (
          <EmptyState
            title="Account not found"
            description="It may have been removed, or it belongs to another user."
            action={<BackLink />}
          />
        ) : (
          <ErrorState error={account.error} onRetry={() => void account.refetch()} />
        )}
      </>
    )
  }

  const current = account.data

  function confirmArchive() {
    archive.mutate(id, {
      onSuccess: () => {
        notify(`${current.name} archived`, 'success')
        setArchiving(false)
      },
      onError: (error) => {
        notify(errorMessage(error), 'error')
        setArchiving(false)
      },
    })
  }

  return (
    <>
      <div className="mb-4">
        <BackLink />
      </div>
      <PageHeader
        title={current.name}
        description={[accountTypeLabels[current.accountType], current.institutionName].filter(Boolean).join(' · ')}
        actions={
          !current.isArchived && (
            <>
              <Button variant="secondary" onClick={() => setEditing(true)}>
                <Pencil />
                Edit
              </Button>
              <Button variant="secondary" onClick={() => setArchiving(true)}>
                <Archive />
                Archive
              </Button>
            </>
          )
        }
      />
      {current.isArchived && (
        <p className="mb-4 flex items-center gap-2 text-sm text-muted">
          <Badge tone="warning">Archived</Badge>
          History is kept, but new transactions cannot be added.
        </p>
      )}

      <div className="space-y-5">
        <BalanceCard id={id} />
        <HistoryCard id={id} />
      </div>

      {editing && <AccountFormDialog open onOpenChange={(open) => !open && setEditing(false)} account={current} />}
      <ConfirmDialog
        open={archiving}
        onOpenChange={setArchiving}
        title={`Archive ${current.name}?`}
        description="Its history stays and still counts in your totals, but you will not be able to add new transactions to it. This cannot be undone."
        confirmLabel="Archive"
        pending={archive.isPending}
        onConfirm={confirmArchive}
      />
    </>
  )
}

function BackLink() {
  return (
    <Link to="/accounts" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand underline-offset-4 hover:underline">
      <ArrowLeft className="size-4" aria-hidden="true" />
      All accounts
    </Link>
  )
}

function BalanceCard({ id }: { id: string }) {
  const balance = useAccountBalance(id)

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-fg">Balance</h2>
      </CardHeader>
      {balance.isPending ? (
        <CardBody role="status" aria-label="Loading balance">
          <Skeleton className="h-9 w-48" />
        </CardBody>
      ) : balance.isError ? (
        <ErrorState error={balance.error} onRetry={() => void balance.refetch()} />
      ) : (
        <CardBody>
          <p className={cn('num text-3xl font-semibold tracking-tight', balance.data.balance < 0 ? 'text-expense' : 'text-fg')}>
            {formatPkr(balance.data.balance)}
          </p>
          <BalanceBreakdown balance={balance.data} />
        </CardBody>
      )}
    </Card>
  )
}

/** How the balance is made up, line by line (spec §6.4). */
function BalanceBreakdown({ balance }: { balance: AccountBalance }) {
  const rows: Array<[string, number]> = [
    ['Opening balance', balance.openingBalance],
    ['Income', balance.income],
    ['Expenses', -balance.expense],
    ['Transfers in', balance.transfersIn],
    ['Transfers out', -balance.transfersOut],
  ]
  return (
    <dl className="mt-5 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3 lg:grid-cols-5">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="num mt-0.5 text-sm font-medium text-fg">{formatPkr(value)}</dd>
        </div>
      ))}
    </dl>
  )
}

const typeLabel = (transaction: Transaction, accountId: string) =>
  transaction.type === 'Transfer'
    ? transaction.sourceAccountId === accountId
      ? 'Transfer out'
      : 'Transfer in'
    : transaction.type

function TypeBadge({ transaction, accountId }: { transaction: Transaction; accountId: string }) {
  const tone = transaction.type === 'Income' ? 'income' : transaction.type === 'Expense' ? 'expense' : 'transfer'
  return <Badge tone={tone}>{typeLabel(transaction, accountId)}</Badge>
}

/** The signed effect of a transaction on this account's balance. */
function effectOn(transaction: Transaction, accountId: string): number {
  if (transaction.type === 'Income') return transaction.amount
  if (transaction.type === 'Expense') return -transaction.amount
  return transaction.sourceAccountId === accountId ? -transaction.amount : transaction.amount
}

function HistoryCard({ id }: { id: string }) {
  const [page, setPage] = useState(1)
  const history = useAccountHistory(id, page)

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-fg">History</h2>
      </CardHeader>
      {history.isPending ? (
        <CardBody role="status" aria-label="Loading history" className="space-y-3">
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
        </CardBody>
      ) : history.isError ? (
        <ErrorState error={history.error} onRetry={() => void history.refetch()} />
      ) : history.data.items.length === 0 ? (
        <EmptyState title="No transactions yet" description="Income, expenses and transfers for this account will show up here." />
      ) : (
        <>
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Details</Th>
                <Th className="hidden sm:table-cell">Type</Th>
                <Th className="text-right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {history.data.items.map((transaction) => {
                const effect = effectOn(transaction, id)
                return (
                  <tr key={transaction.id}>
                    <Td className="num">{formatDate(transaction.transactionDate)}</Td>
                    <Td>
                      {transaction.description}
                      {transaction.merchant && <p className="text-xs text-muted">{transaction.merchant}</p>}
                      <span className="mt-1 block sm:hidden">
                        <TypeBadge transaction={transaction} accountId={id} />
                      </span>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <TypeBadge transaction={transaction} accountId={id} />
                    </Td>
                    <Td className={cn('num text-right font-medium', effect >= 0 ? 'text-income' : 'text-expense')}>
                      {effect >= 0 ? '+ ' : '− '}
                      {formatPkr(Math.abs(effect))}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
          <Pagination
            page={history.data.page}
            pageSize={history.data.pageSize}
            totalCount={history.data.totalCount}
            totalPages={history.data.totalPages}
            onPageChange={setPage}
          />
        </>
      )}
    </Card>
  )
}
