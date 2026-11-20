import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/toast-context'
import { versionHasMoved } from '@/lib/api/conflict'
import { isApiError } from '@/lib/api/errors'
import { parseAmount } from '@/lib/money'
import {
  ACCOUNT_NAME_MAX,
  INSTITUTION_NAME_MAX,
  accountTypeLabels,
  accountTypes,
  accountsApi,
  useCreateAccount,
  useUpdateAccount,
} from './accounts-api'
import type { Account, AccountInput, AccountType } from './accounts-api'

// Mirrors the API's rules (AccountValidators) so mistakes show before a request is sent.
const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(ACCOUNT_NAME_MAX, `Use ${ACCOUNT_NAME_MAX} characters or fewer.`),
  accountType: z.string().refine((value) => accountTypes.includes(value as AccountType), 'Choose a type.'),
  openingBalance: z
    .string()
    .refine((value) => parseAmount(value) !== null, 'Enter 0 or more, with up to 2 decimals, like 1,500.50.'),
  institutionName: z.string().trim().max(INSTITUTION_NAME_MAX, `Use ${INSTITUTION_NAME_MAX} characters or fewer.`),
})
type FormValues = z.infer<typeof schema>

const fieldNames = ['name', 'accountType', 'openingBalance', 'institutionName'] as const

function toFormValues(account?: Account): FormValues {
  return {
    name: account?.name ?? '',
    accountType: account?.accountType ?? '',
    openingBalance: account ? account.openingBalance.toFixed(2) : '0',
    institutionName: account?.institutionName ?? '',
  }
}

function toInput(values: FormValues): AccountInput {
  return {
    name: values.name.trim(),
    accountType: values.accountType as AccountType,
    openingBalance: parseAmount(values.openingBalance)!,
    institutionName: values.institutionName.trim() || null,
  }
}

interface AccountFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Present when editing; absent when creating. */
  account?: Account
}

export function AccountFormDialog({ open, onOpenChange, account }: AccountFormDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={account ? 'Edit account' : 'New account'}
      description={account ? undefined : 'Add a place where your money lives.'}
    >
      {/* The form mounts when the dialog opens, so it always starts from the account's current values. */}
      <AccountForm account={account} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const { notify } = useToast()
  const create = useCreateAccount()
  const update = useUpdateAccount(account?.id ?? '')
  const [version, setVersion] = useState(account?.version ?? 0)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema), defaultValues: toFormValues(account) })

  const pending = create.isPending || update.isPending

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
    if (error.kind === 'conflict' && account) {
      // A duplicate name is also a 409; only a moved version means "changed elsewhere".
      void versionHasMoved(() => accountsApi.get(account.id), version).then(setStale)
    }
    // Field messages sit under their fields; anything else is shown above the buttons.
    if (!placed || error.kind !== 'validation') {
      setFormError(error.message)
    }
  }

  function submit(values: FormValues) {
    setFormError(null)
    setStale(false)
    const input = toInput(values)
    const options = {
      onSuccess: () => {
        notify(account ? 'Account saved' : 'Account created', 'success')
        onDone()
      },
      onError,
    }
    if (account) {
      update.mutate({ input, version }, options)
    } else {
      create.mutate(input, options)
    }
  }

  /** The account was changed somewhere else: show its latest values and carry on from there. */
  async function loadLatest() {
    if (!account) {
      return
    }
    setReloading(true)
    try {
      const latest = await accountsApi.get(account.id)
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
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormField label="Name" error={errors.name?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
      </FormField>
      <FormField label="Type" error={errors.accountType?.message}>
        {(field) => (
          <Select {...field} invalid={field['aria-invalid'] === true} {...register('accountType')}>
            <option value="">Choose a type</option>
            {accountTypes.map((type) => (
              <option key={type} value={type}>
                {accountTypeLabels[type]}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        label="Opening balance (PKR)"
        hint="What the account holds when you start tracking. Use a minus sign if it starts overdrawn."
        error={errors.openingBalance?.message}
      >
        {(field) => <Input {...field} inputMode="decimal" autoComplete="off" {...register('openingBalance')} />}
      </FormField>
      <FormField label="Bank or provider (optional)" error={errors.institutionName?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('institutionName')} />}
      </FormField>

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
        <Button type="submit" loading={pending}>
          {account ? 'Save changes' : 'Create account'}
        </Button>
      </DialogFooter>
    </form>
  )
}
