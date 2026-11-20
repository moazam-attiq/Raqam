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
import type { Category } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { monthLabel } from './budget-month'
import type { Month } from './budget-month'
import { budgetsApi, useCreateBudget, useUpdateBudget } from './budgets-api'
import type { Budget } from './budgets-api'

// Mirrors the API's rule (a positive amount, at most 2 decimals) so mistakes show before a request is sent.
const schema = z.object({
  /** '' means the overall budget. */
  categoryId: z.string(),
  amount: z.string().refine((value) => {
    const amount = parseAmount(value)
    return amount !== null && amount > 0
  }, 'Enter an amount above 0, with up to 2 decimals, like 25,000.'),
})
type FormValues = z.infer<typeof schema>

const fieldNames = ['categoryId', 'amount'] as const

export interface BudgetFormProps {
  month: Month
  /** Present when editing: only the amount can change. */
  budget?: Budget
  /** The category's name, for the edit heading ("Overall budget" when there is none). */
  label?: string
  /** The month's existing budgets, so a category that already has one is not offered again. */
  existing: Budget[]
  categories: Category[]
}

interface BudgetFormDialogProps extends BudgetFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BudgetFormDialog({ open, onOpenChange, ...form }: BudgetFormDialogProps) {
  const title = form.budget ? 'Edit budget' : 'New budget'
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={form.budget ? undefined : `Set a spending limit for ${monthLabel(form.month)}.`}
    >
      {/* The form mounts when the dialog opens, so it always starts from the budget's current values. */}
      <BudgetForm {...form} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function BudgetForm({ month, budget, label, existing, categories, onDone }: BudgetFormProps & { onDone: () => void }) {
  const { notify } = useToast()
  const create = useCreateBudget()
  const update = useUpdateBudget(budget?.id ?? '')
  const [version, setVersion] = useState(budget?.version ?? 0)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)

  const hasOverall = existing.some((item) => item.categoryId === null)
  const taken = new Set(existing.map((item) => item.categoryId))
  const options = categoryOptions(categories, { type: 'Expense' }).filter((option) => !taken.has(option.id))
  const nothingToAdd = !budget && hasOverall && options.length === 0
  const pending = create.isPending || update.isPending
  // With an overall budget already set, the first free category is what the select starts on.
  const firstChoice = hasOverall ? (options[0]?.id ?? '') : ''

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { categoryId: budget ? (budget.categoryId ?? '') : firstChoice, amount: budget ? budget.amount.toFixed(2) : '' },
  })


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
    if (error.kind === 'conflict' && budget) {
      // A 409 on edit can only be a stale version, but check, as the other forms do.
      void versionHasMoved(() => budgetsApi.get(budget.id), version).then(setStale)
    }
    if (!placed || error.kind !== 'validation') {
      setFormError(error.message)
    }
  }

  function submit(values: FormValues) {
    setFormError(null)
    setStale(false)
    const amount = parseAmount(values.amount)!
    const options = {
      onSuccess: () => {
        notify(budget ? 'Budget saved' : 'Budget created', 'success')
        onDone()
      },
      onError,
    }
    if (budget) {
      update.mutate({ amount, version }, options)
    } else {
      create.mutate({ year: month.year, month: month.month, amount, categoryId: values.categoryId || null }, options)
    }
  }

  /** The budget was changed somewhere else: show its latest amount and carry on from there. */
  async function loadLatest() {
    if (!budget) {
      return
    }
    setReloading(true)
    try {
      const latest = await budgetsApi.get(budget.id)
      reset({ categoryId: latest.categoryId ?? '', amount: latest.amount.toFixed(2) })
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
      {budget ? (
        // The month and category cannot change once a budget exists (D053).
        <p className="text-sm text-muted">
          {label ?? 'Budget'} · {monthLabel(month)}
        </p>
      ) : nothingToAdd ? (
        <p className="rounded-lg bg-sunken px-3 py-2 text-sm text-muted">
          Every category already has a budget for {monthLabel(month)}.
        </p>
      ) : (
        <FormField
          label="Applies to"
          hint="An overall budget counts all your spending. A category budget counts that category and its subcategories."
          error={errors.categoryId?.message}
        >
          {(field) => (
            <Select {...field} invalid={field['aria-invalid'] === true} {...register('categoryId')}>
              {!hasOverall && <option value="">Overall budget (all spending)</option>}
              {options.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}

      <FormField label="Limit (PKR)" error={errors.amount?.message}>
        {(field) => <Input {...field} inputMode="decimal" autoComplete="off" {...register('amount')} />}
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
        <Button type="submit" loading={pending} disabled={nothingToAdd}>
          {budget ? 'Save changes' : 'Create budget'}
        </Button>
      </DialogFooter>
    </form>
  )
}
