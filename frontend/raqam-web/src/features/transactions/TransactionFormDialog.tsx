import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, RefreshCw } from 'lucide-react'
import { useRef, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { DateField } from '@/components/ui/DateField'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/toast-context'
import { versionHasMoved } from '@/lib/api/conflict'
import { isApiError } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { formatDate, todayApiDate } from '@/lib/dates'
import { formatPkr, parseAmount } from '@/lib/money'
import { useAccountBalance } from '@/features/accounts/accounts-api'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { availableToSpend } from './available'
import { readLastAccount, rememberLastAccount } from './last-account'
import {
  DESCRIPTION_MAX,
  MERCHANT_MAX,
  transactionTypes,
  transactionsApi,
  useCreateTransaction,
  useUpdateTransaction,
} from './transactions-api'
import type { TransactionInput } from './transactions-api'
import type { Transaction, TransactionType } from './types'

const schema = z
  .object({
    type: z.enum(transactionTypes),
    amount: z.string(),
    transactionDate: z.string(),
    sourceAccountId: z.string(),
    destinationAccountId: z.string(),
    categoryId: z.string(),
    description: z.string().max(DESCRIPTION_MAX, `Use ${DESCRIPTION_MAX} characters or fewer.`),
    merchant: z.string().max(MERCHANT_MAX, `Use ${MERCHANT_MAX} characters or fewer.`),
  })
  .superRefine((values, ctx) => {
    const issue = (path: keyof FormValues, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    const amount = parseAmount(values.amount)
    if (amount === null || amount <= 0) issue('amount', 'Enter an amount above 0, with up to 2 decimals.')
    if (!values.transactionDate) issue('transactionDate', 'Choose a date.')
    else if (values.transactionDate > todayApiDate()) issue('transactionDate', `Choose ${formatDate(todayApiDate())} or earlier.`)
    if (!values.sourceAccountId) issue('sourceAccountId', 'Choose an account.')
    if (values.type === 'Transfer') {
      if (!values.destinationAccountId) issue('destinationAccountId', 'Choose the account it goes to.')
      else if (values.destinationAccountId === values.sourceAccountId) issue('destinationAccountId', 'Choose a different account.')
    } else if (!values.categoryId) {
      issue('categoryId', 'Choose a category.')
    }
  })
type FormValues = z.infer<typeof schema>

const fieldNames: Array<keyof FormValues> = [
  'type',
  'amount',
  'transactionDate',
  'sourceAccountId',
  'destinationAccountId',
  'categoryId',
  'description',
  'merchant',
]

const typeLabels: Record<TransactionType, string> = { Expense: 'Expense', Income: 'Income', Transfer: 'Transfer' }

export interface TransactionFormProps {
  /** Present when editing. */
  transaction?: Transaction
  /** Every account and category, archived ones included: an old transaction may still point at one. */
  accounts: Account[]
  categories: Category[]
}

interface TransactionFormDialogProps extends TransactionFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function TransactionFormDialog({ open, onOpenChange, ...form }: TransactionFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={form.transaction ? 'Edit transaction' : 'New transaction'}>
      {/* The form mounts when the dialog opens, so it always starts from the current values. */}
      <TransactionForm {...form} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function toFormValues(transaction: Transaction): FormValues {
  return {
    type: transaction.type,
    amount: transaction.amount.toFixed(2),
    transactionDate: transaction.transactionDate,
    sourceAccountId: transaction.sourceAccountId,
    destinationAccountId: transaction.destinationAccountId ?? '',
    categoryId: transaction.categoryId ?? '',
    description: transaction.description,
    merchant: transaction.merchant ?? '',
  }
}

function toInput(values: FormValues): TransactionInput {
  const transfer = values.type === 'Transfer'
  return {
    type: values.type,
    amount: parseAmount(values.amount)!,
    transactionDate: values.transactionDate,
    sourceAccountId: values.sourceAccountId,
    destinationAccountId: transfer ? values.destinationAccountId : null,
    categoryId: transfer ? null : values.categoryId,
    description: values.description.trim(),
    merchant: values.merchant.trim() || null,
  }
}

function TransactionForm({ transaction, accounts, categories, onDone }: TransactionFormProps & { onDone: () => void }) {
  const { notify } = useToast()
  const create = useCreateTransaction()
  const update = useUpdateTransaction(transaction?.id ?? '')
  const [version, setVersion] = useState(transaction?.version ?? 0)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)
  const addAnother = useRef(false)

  const activeAccounts = accounts.filter((account) => !account.isArchived)
  const startingAccount = () => {
    const last = readLastAccount()
    if (activeAccounts.some((account) => account.id === last)) return last
    return activeAccounts.length === 1 ? activeAccounts[0]!.id : ''
  }

  const {
    register,
    handleSubmit,
    reset,
    setError,
    clearErrors,
    setValue,
    setFocus,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: transaction
      ? toFormValues(transaction)
      : {
          type: 'Expense',
          amount: '',
          transactionDate: todayApiDate(),
          sourceAccountId: startingAccount(),
          destinationAccountId: '',
          categoryId: '',
          description: '',
          merchant: '',
        },
  })

  const type = useWatch({ control, name: 'type' })
  const sourceId = useWatch({ control, name: 'sourceAccountId' })
  const amountText = useWatch({ control, name: 'amount' })
  const pending = create.isPending || update.isPending
  const transfer = type === 'Transfer'

  // No account goes below zero (D049): an expense or transfer can be at most what the account
  // holds. Without a balance (still loading, or it failed) nothing is blocked here and the
  // server decides.
  const spends = type !== 'Income'
  const sourceBalance = useAccountBalance(sourceId, spends && sourceId !== '')
  const available = spends && sourceBalance.data ? availableToSpend(sourceBalance.data.balance, transaction, sourceId) : null
  const typedAmount = parseAmount(amountText)
  const overdraws = available !== null && typedAmount !== null && typedAmount > available
  const sourceName = accounts.find((account) => account.id === sourceId)?.name ?? 'This account'
  const overdrawMessage = overdraws ? `${sourceName} has ${formatPkr(available)} available.` : undefined

  // A new transaction may only use active accounts and categories; one already on the
  // transaction stays selectable even if archived, so an old entry can still be edited.
  const accountLabel = (account: Account) => account.name + (account.isArchived ? ' (archived)' : '')
  const accountChoices = (keepId: string | null, exceptId = '') =>
    accounts
      .filter((account) => (!account.isArchived || account.id === keepId) && account.id !== exceptId)
      .sort((a, b) => a.name.localeCompare(b.name))
  const sourceChoices = accountChoices(transaction?.sourceAccountId ?? null)
  const destinationChoices = accountChoices(transaction?.destinationAccountId ?? null, sourceId)
  const categoryChoices = transfer
    ? []
    : categoryOptions(categories, { type, keepId: transaction?.categoryId ?? undefined })

  function chooseType(next: TransactionType) {
    if (next === type) {
      return
    }
    setValue('type', next)
    // A category belongs to one type, and only a transfer has a destination.
    setValue('categoryId', '')
    setValue('destinationAccountId', '')
    clearErrors(['categoryId', 'destinationAccountId'])
  }

  function onError(error: unknown) {
    if (!isApiError(error)) {
      setFormError('Something went wrong. Try again.')
      return
    }
    let placed = false
    for (const name of fieldNames) {
      const message = error.fieldErrors[name]?.[0]
      if (message) {
        setError(name, { message })
        placed = true
      }
    }
    if (error.kind === 'conflict' && transaction) {
      void versionHasMoved(() => transactionsApi.get(transaction.id), version).then(setStale)
    }
    if (!placed || error.kind !== 'validation') {
      setFormError(error.message)
    }
  }

  function submit(values: FormValues) {
    if (overdraws) {
      setFocus('amount')
      return
    }
    setFormError(null)
    setStale(false)
    const keepOpen = addAnother.current
    const options = {
      onSuccess: () => {
        rememberLastAccount(values.sourceAccountId)
        notify(transaction ? 'Transaction saved' : 'Transaction added', 'success')
        if (keepOpen) {
          // Keep the type, date, accounts and category; start the next entry at the amount.
          reset({ ...values, amount: '', description: '', merchant: '' })
          setFocus('amount')
        } else {
          onDone()
        }
      },
      onError,
    }
    const input = toInput(values)
    if (transaction) {
      update.mutate({ input, version }, options)
    } else {
      create.mutate(input, options)
    }
  }

  /** The transaction was changed somewhere else: show its latest values and carry on from there. */
  async function loadLatest() {
    if (!transaction) {
      return
    }
    setReloading(true)
    try {
      const latest = await transactionsApi.get(transaction.id)
      reset(toFormValues(latest))
      setVersion(latest.version)
      setStale(false)
      setFormError(null)
    } catch (error) {
      onError(error)
    } finally {
      setReloading(false)
    }
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        addAnother.current = false
        void handleSubmit(submit)(event)
      }}
      className="space-y-4"
    >
      <div role="radiogroup" aria-label="Transaction type" className="grid grid-cols-3 rounded-lg border border-line bg-sunken p-0.5">
        {transactionTypes.map((option) => (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={type === option}
            onClick={() => chooseType(option)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
              type === option ? 'bg-surface text-fg shadow-[0_0_0_1px_var(--line)]' : 'text-muted hover:text-fg',
            )}
          >
            {typeLabels[option]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Amount (PKR)" error={errors.amount?.message ?? overdrawMessage}>
          {(field) => <Input {...field} inputMode="decimal" autoComplete="off" autoFocus {...register('amount')} />}
        </FormField>
        <FormField label="Date" error={errors.transactionDate?.message}>
          {(field) => (
            <Controller
              control={control}
              name="transactionDate"
              render={({ field: date }) => <DateField {...field} value={date.value} onChange={date.onChange} maxDate={todayApiDate()} />}
            />
          )}
        </FormField>
      </div>

      <FormField
        label={transfer ? 'From account' : 'Account'}
        error={errors.sourceAccountId?.message}
        hint={available !== null ? `Available: ${formatPkr(available)}` : undefined}
      >
        {(field) => (
          <Select {...field} invalid={field['aria-invalid'] === true} {...register('sourceAccountId')}>
            <option value="">Choose an account</option>
            {sourceChoices.map((account) => (
              <option key={account.id} value={account.id}>
                {accountLabel(account)}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {transfer ? (
        <FormField label="To account" error={errors.destinationAccountId?.message}>
          {(field) => (
            <Select {...field} invalid={field['aria-invalid'] === true} {...register('destinationAccountId')}>
              <option value="">Choose an account</option>
              {destinationChoices.map((account) => (
                <option key={account.id} value={account.id}>
                  {accountLabel(account)}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : (
        <FormField label="Category" error={errors.categoryId?.message}>
          {(field) => (
            <Select {...field} invalid={field['aria-invalid'] === true} {...register('categoryId')}>
              <option value="">Choose a category</option>
              {categoryChoices.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <FormField label="Description (optional)" error={errors.description?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('description')} />}
      </FormField>
      {!transfer && (
        <FormField label="Merchant (optional)" error={errors.merchant?.message}>
          {(field) => <Input {...field} autoComplete="off" {...register('merchant')} />}
        </FormField>
      )}

      {formError && (
        <p role="alert" className="rounded-lg border border-danger/40 bg-expense-soft px-3 py-2 text-sm text-fg">
          {formError}
        </p>
      )}

      <DialogFooter>
        {stale && (
          <Button variant="secondary" onClick={() => void loadLatest()} loading={reloading}>
            <RefreshCw />
            Load latest
          </Button>
        )}
        <Button variant="secondary" onClick={onDone} disabled={pending}>
          Cancel
        </Button>
        {!transaction && (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() => {
              addAnother.current = true
              void handleSubmit(submit)()
            }}
          >
            <Plus />
            Save and add another
          </Button>
        )}
        <Button type="submit" loading={pending}>
          {transaction ? 'Save changes' : 'Add transaction'}
        </Button>
      </DialogFooter>
    </form>
  )
}
