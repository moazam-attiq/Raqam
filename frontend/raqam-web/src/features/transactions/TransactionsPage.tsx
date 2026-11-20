import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Pagination } from '@/components/ui/Pagination'
import { Skeleton } from '@/components/ui/Spinner'
import { Table, Td, Th } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/dates'
import { formatPkr } from '@/lib/money'
import { useAccounts } from '@/features/accounts/accounts-api'
import { useCategories } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { dateRangeError, hasActiveFilters, parseFilters, toSearchParams } from './transaction-filters'
import { describeTransaction } from './transaction-describe'
import { TransactionAmount } from './TransactionAmount'
import { TransactionFilterBar } from './TransactionFilterBar'
import { TransactionFormDialog } from './TransactionFormDialog'
import { useDeleteTransaction, useTransactions } from './transactions-api'
import type { TransactionFilters } from './transactions-api'
import type { Transaction } from './types'

type FormState = { transaction?: Transaction } | null

export function TransactionsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = parseFilters(searchParams)
  const rangeError = dateRangeError(filters)
  const [form, setForm] = useState<FormState>(null)
  const [deleting, setDeleting] = useState<Transaction | null>(null)
  const { notify } = useToast()

  const accounts = useAccounts(true)
  const categories = useCategories(true)
  const transactions = useTransactions(filters, { enabled: !rangeError })
  const remove = useDeleteTransaction()

  const accountList = accounts.data ?? []
  const categoryList = categories.data ?? []
  const accountNames = new Map(accountList.map((account) => [account.id, account.name]))
  const categoryLabels = new Map(categoryOptions(categoryList, { includeArchived: true }).map((option) => [option.id, option.label]))
  const noAccounts = accounts.isSuccess && accountList.every((account) => account.isArchived)

  /** Changing a filter goes back to the first page; the address always reflects the view. */
  function change(patch: Partial<TransactionFilters>) {
    const next = { ...filters, ...patch }
    if (!('page' in patch)) {
      next.page = 1
    }
    setSearchParams(toSearchParams(next), { replace: true })
  }

  function clearFilters() {
    setSearchParams(toSearchParams({ ...filters, from: '', to: '', type: '', accountId: '', categoryId: '', search: '', page: 1 }), {
      replace: true,
    })
  }

  function confirmDelete() {
    if (!deleting) {
      return
    }
    // Deleting the last row of a later page would leave it empty, so step back one page.
    const lastOnPage = transactions.data?.items.length === 1 && filters.page > 1
    remove.mutate(deleting.id, {
      onSuccess: () => {
        notify('Transaction deleted', 'success')
        setDeleting(null)
        if (lastOnPage) {
          change({ page: filters.page - 1 })
        }
      },
      onError: (error) => {
        notify(errorMessage(error), 'error')
        setDeleting(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Everything you have earned, spent or moved."
        actions={
          <Button onClick={() => setForm({})} disabled={noAccounts}>
            <Plus />
            New transaction
          </Button>
        }
      />

      <TransactionFilterBar
        filters={filters}
        onChange={change}
        onClear={clearFilters}
        accounts={accountList}
        categories={categoryList}
        dateError={rangeError}
      />

      <Card>
        {rangeError ? (
          <EmptyState title="Check the dates" description={rangeError} />
        ) : transactions.isPending ? (
          <div role="status" className="space-y-3 p-5" aria-label="Loading transactions">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : transactions.isError ? (
          <ErrorState error={transactions.error} onRetry={() => void transactions.refetch()} />
        ) : transactions.data.items.length === 0 ? (
          noAccounts ? (
            <EmptyState
              title="Add an account first"
              description="Transactions belong to an account, so create one before recording anything."
              action={
                <Link to="/accounts" className="text-sm font-medium text-brand underline-offset-4 hover:underline">
                  Go to accounts
                </Link>
              }
            />
          ) : transactions.data.totalCount > 0 ? (
            <EmptyState
              title="This page is empty"
              description="The list has changed since you opened it."
              action={
                <Button size="sm" variant="secondary" onClick={() => change({ page: 1 })}>
                  Go to the first page
                </Button>
              }
            />
          ) : hasActiveFilters(filters) ? (
            <EmptyState
              title="No transactions match"
              description="Try different dates or remove a filter."
              action={
                <Button size="sm" variant="secondary" onClick={clearFilters}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState
              title="No transactions this month"
              description="Record an income, expense or transfer, or choose an earlier From date to look back."
              action={
                <Button size="sm" onClick={() => setForm({})}>
                  <Plus />
                  New transaction
                </Button>
              }
            />
          )
        ) : (
          <>
            <Table>
              <thead>
                <tr>
                  <Th className="hidden lg:table-cell">Date</Th>
                  <Th>Details</Th>
                  <Th className="hidden lg:table-cell">Category</Th>
                  <Th className="hidden lg:table-cell">Account</Th>
                  <Th className="text-right">Amount</Th>
                  <Th>
                    <span className="sr-only">Actions</span>
                  </Th>
                </tr>
              </thead>
              <tbody className={cn(transactions.isPlaceholderData && 'opacity-60')}>
                {transactions.data.items.map((transaction) => {
                  const transfer = transaction.type === 'Transfer'
                  const { category, account } = describeTransaction(transaction, accountNames, categoryLabels)
                  return (
                    <tr key={transaction.id}>
                      <Td className="num hidden lg:table-cell">{formatDate(transaction.transactionDate)}</Td>
                      <Td>
                        {transaction.description || <span className="text-muted">No description</span>}
                        {transaction.merchant && <p className="text-xs text-muted">{transaction.merchant}</p>}
                        {/* Below lg the Date, Category and Account columns are hidden, so they move under the details. */}
                        <p className="mt-0.5 text-xs text-muted lg:hidden">
                          {formatDate(transaction.transactionDate)} · {category} · {account}
                        </p>
                      </Td>
                      <Td className="hidden lg:table-cell">
                        {transfer ? <Badge tone="transfer">Transfer</Badge> : category}
                      </Td>
                      <Td className="hidden lg:table-cell">{account}</Td>
                      <Td className="num text-right font-medium">
                        <TransactionAmount transaction={transaction} />
                      </Td>
                      <Td className="w-20 sm:w-24">
                        <span className="flex justify-end gap-0.5 sm:gap-1">
                          <IconButton label={`Edit ${labelFor(transaction)}`} icon={<Pencil />} onClick={() => setForm({ transaction })} />
                          <IconButton
                            label={`Delete ${labelFor(transaction)}`}
                            icon={<Trash2 />}
                            tone="danger"
                            onClick={() => setDeleting(transaction)}
                          />
                        </span>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </Table>
            <Pagination
              page={transactions.data.page}
              pageSize={transactions.data.pageSize}
              totalCount={transactions.data.totalCount}
              totalPages={transactions.data.totalPages}
              onPageChange={(page) => change({ page })}
            />
          </>
        )}
      </Card>

      {form && (
        <TransactionFormDialog
          open
          onOpenChange={(open) => !open && setForm(null)}
          transaction={form.transaction}
          accounts={accountList}
          categories={categoryList}
        />
      )}
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this transaction?"
        description={
          deleting
            ? `${labelFor(deleting)} for ${formatPkr(deleting.amount)} on ${formatDate(deleting.transactionDate)} will be removed and your balances will change. This cannot be undone.`
            : ''
        }
        confirmLabel="Delete"
        pending={remove.isPending}
        onConfirm={confirmDelete}
      />
    </>
  )
}

/** A short name for a row, used in button labels and the delete message. */
function labelFor(transaction: Transaction): string {
  return transaction.description || transaction.merchant || transaction.type.toLowerCase()
}
