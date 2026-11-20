import { Archive, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Spinner'
import { Table, Td, Th } from '@/components/ui/Table'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { formatPkr } from '@/lib/money'
import { AccountFormDialog } from './AccountFormDialog'
import { accountTypeLabels, useAccountBalances, useAccounts, useArchiveAccount } from './accounts-api'
import type { Account } from './accounts-api'

export function AccountsPage() {
  const [showArchived, setShowArchived] = useState(false)
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [archiving, setArchiving] = useState<Account | null>(null)
  const { notify } = useToast()

  const accounts = useAccounts(showArchived)
  const list = accounts.data ?? []
  const balances = useAccountBalances(list.map((account) => account.id))
  const archive = useArchiveAccount()

  function confirmArchive() {
    if (!archiving) {
      return
    }
    archive.mutate(archiving.id, {
      onSuccess: () => {
        notify(`${archiving.name} archived`, 'success')
        setArchiving(null)
      },
      onError: (error) => {
        notify(errorMessage(error), 'error')
        setArchiving(null)
      },
    })
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Where your money lives, with each balance."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus />
            New account
          </Button>
        }
      />

      <label className="mb-3 flex w-fit items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          checked={showArchived}
          onChange={(event) => setShowArchived(event.target.checked)}
          className="size-4 accent-brand"
        />
        Show archived accounts
      </label>

      <Card>
        {accounts.isPending ? (
          <div role="status" className="space-y-3 p-5" aria-label="Loading accounts">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : accounts.isError ? (
          <ErrorState error={accounts.error} onRetry={() => void accounts.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            title={showArchived ? 'No accounts yet' : 'No accounts yet'}
            description="Add the places your money lives: cash, bank accounts, wallets."
            action={
              <Button size="sm" onClick={() => setCreating(true)}>
                <Plus />
                New account
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th className="hidden sm:table-cell">Type</Th>
                <Th className="text-right">Balance</Th>
                <Th>
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {list.map((account) => {
                const balance = balances.get(account.id)
                return (
                  <tr key={account.id} className={cn(account.isArchived && 'text-muted')}>
                    <Td>
                      <Link to={`/accounts/${account.id}`} className="font-medium text-fg underline-offset-4 hover:underline">
                        {account.name}
                      </Link>
                      {account.institutionName && <p className="text-xs text-muted">{account.institutionName}</p>}
                      {/* On phones the Type column is hidden, so the type moves under the name. */}
                      <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted sm:hidden">
                        {accountTypeLabels[account.accountType]}
                        {account.isArchived && <Badge tone="warning">Archived</Badge>}
                      </p>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <span className="flex flex-wrap gap-1.5">
                        <Badge>{accountTypeLabels[account.accountType]}</Badge>
                        {account.isArchived && <Badge tone="warning">Archived</Badge>}
                      </span>
                    </Td>
                    <Td className="num text-right font-medium">
                      {balance?.isPending ? (
                        <Skeleton className="ml-auto h-5 w-24" />
                      ) : balance?.data ? (
                        <span className={cn(balance.data.balance < 0 && 'text-expense')}>{formatPkr(balance.data.balance)}</span>
                      ) : (
                        <span title="The balance could not be loaded">—</span>
                      )}
                    </Td>
                    <Td className="w-24">
                      {!account.isArchived && (
                        <span className="flex justify-end gap-1">
                          <IconButton label={`Edit ${account.name}`} icon={<Pencil />} onClick={() => setEditing(account)} />
                          <IconButton
                            label={`Archive ${account.name}`}
                            icon={<Archive />}
                            tone="danger"
                            onClick={() => setArchiving(account)}
                          />
                        </span>
                      )}
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </Table>
        )}
      </Card>

      <AccountFormDialog open={creating} onOpenChange={setCreating} />
      {editing && <AccountFormDialog open onOpenChange={(open) => !open && setEditing(null)} account={editing} />}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? 'this account'}?`}
        description="Its history stays and still counts in your totals, but you will not be able to add new transactions to it. This cannot be undone."
        confirmLabel="Archive"
        pending={archive.isPending}
        onConfirm={confirmArchive}
      />
    </>
  )
}
