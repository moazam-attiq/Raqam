import { zodResolver } from '@hookform/resolvers/zod'
import { RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import { Button } from '@/components/ui/Button'
import { Dialog, DialogFooter } from '@/components/ui/Dialog'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/toast-context'
import { versionHasMoved } from '@/lib/api/conflict'
import { isApiError } from '@/lib/api/errors'
import {
  CATEGORY_NAME_MAX,
  categoriesApi,
  categoryTypeLabels,
  categoryTypes,
  useCreateCategory,
  useUpdateCategory,
} from './categories-api'
import type { Category, CategoryType } from './categories-api'
import { ColourPicker } from './ColourPicker'

const schema = z.object({
  name: z.string().trim().min(1, 'Enter a name.').max(CATEGORY_NAME_MAX, `Use ${CATEGORY_NAME_MAX} characters or fewer.`),
  type: z.enum(categoryTypes),
  /** '' means a top-level category. */
  parentCategoryId: z.string(),
  /** '' means no colour. */
  colour: z.string(),
})
type FormValues = z.infer<typeof schema>

export interface CategoryFormProps {
  /** Present when editing. Type and parent are fixed after creation, so only name and colour change. */
  category?: Category
  /** When adding a subcategory: its parent, which also fixes the type. */
  fixedParent?: Category
  /** The type pre-selected for a new top-level category. */
  defaultType?: CategoryType
  /** Every category, to offer as parents. */
  all: Category[]
}

interface CategoryFormDialogProps extends CategoryFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CategoryFormDialog({ open, onOpenChange, ...form }: CategoryFormDialogProps) {
  const title = form.category ? 'Edit category' : form.fixedParent ? 'New subcategory' : 'New category'
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      {/* The form mounts when the dialog opens, so it always starts from the current values. */}
      <CategoryForm {...form} onDone={() => onOpenChange(false)} />
    </Dialog>
  )
}

function CategoryForm({ category, fixedParent, defaultType = 'Expense', all, onDone }: CategoryFormProps & { onDone: () => void }) {
  const { notify } = useToast()
  const create = useCreateCategory()
  const update = useUpdateCategory(category?.id ?? '')
  const [version, setVersion] = useState(category?.version ?? 0)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)
  const [reloading, setReloading] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    setError,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category?.name ?? '',
      type: category?.type ?? fixedParent?.type ?? defaultType,
      parentCategoryId: fixedParent?.id ?? '',
      colour: category?.colour ?? '',
    },
  })

  const type = useWatch({ control, name: 'type' })
  const parentOptions = all
    .filter((candidate) => candidate.parentCategoryId === null && !candidate.isArchived && candidate.type === type)
    .sort((a, b) => a.name.localeCompare(b.name))
  const pending = create.isPending || update.isPending

  function onError(error: unknown) {
    if (!isApiError(error)) {
      setFormError('Something went wrong. Try again.')
      return
    }
    const nameError = error.fieldErrors.name?.[0]
    if (nameError) {
      setError('name', { message: nameError })
    }
    if (error.kind === 'conflict' && category) {
      // A duplicate name is also a 409; only a moved version means "changed elsewhere".
      void versionHasMoved(() => categoriesApi.get(category.id), version).then(setStale)
    }
    if (!nameError || error.kind !== 'validation') {
      setFormError(error.message)
    }
  }

  function submit(values: FormValues) {
    setFormError(null)
    setStale(false)
    const name = values.name.trim()
    const colour = values.colour || null
    const options = {
      onSuccess: () => {
        notify(category ? 'Category saved' : 'Category created', 'success')
        onDone()
      },
      onError,
    }
    if (category) {
      // The icon has no editor yet; send back what is stored so it is never wiped.
      update.mutate({ input: { name, colour, icon: category.icon }, version }, options)
    } else {
      create.mutate(
        { name, type: values.type, parentCategoryId: values.parentCategoryId || null, colour, icon: null },
        options,
      )
    }
  }

  /** The category was changed somewhere else: show its latest values and carry on from there. */
  async function loadLatest() {
    if (!category) {
      return
    }
    setReloading(true)
    try {
      const latest = await categoriesApi.get(category.id)
      reset({ name: latest.name, type: latest.type, parentCategoryId: latest.parentCategoryId ?? '', colour: latest.colour ?? '' })
      setVersion(latest.version)
      setStale(false)
      setFormError(null)
    } catch (error) {
      onError(error)
    } finally {
      setReloading(false)
    }
  }

  const parentName = category
    ? all.find((candidate) => candidate.id === category.parentCategoryId)?.name
    : fixedParent?.name

  return (
    <form noValidate onSubmit={handleSubmit(submit)} className="space-y-4">
      <FormField label="Name" error={errors.name?.message}>
        {(field) => <Input {...field} autoComplete="off" {...register('name')} />}
      </FormField>

      {category || fixedParent ? (
        // Type and parent cannot change once a category exists, and a subcategory takes its parent's type.
        <p className="text-sm text-muted">
          {categoryTypeLabels[category?.type ?? fixedParent!.type]} category
          {parentName ? ` · subcategory of ${parentName}` : category?.parentCategoryId ? '' : ' · top level'}
        </p>
      ) : (
        <>
          <FormField label="Type">
            {(field) => (
              <Select
                {...field}
                {...register('type', { onChange: () => setValue('parentCategoryId', '') })}
              >
                {categoryTypes.map((option) => (
                  <option key={option} value={option}>
                    {categoryTypeLabels[option]}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
          <FormField label="Parent category (optional)" hint="Leave empty for a top-level category.">
            {(field) => (
              <Select {...field} {...register('parentCategoryId')}>
                <option value="">None, top level</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </Select>
            )}
          </FormField>
        </>
      )}

      <ColourPicker registration={register('colour')} current={category?.colour ?? null} />

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
          {category ? 'Save changes' : 'Create category'}
        </Button>
      </DialogFooter>
    </form>
  )
}
