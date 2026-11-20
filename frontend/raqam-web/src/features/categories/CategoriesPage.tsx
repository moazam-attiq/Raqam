import { Archive, Pencil, Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { ErrorState } from '@/components/ui/ErrorState'
import { IconButton } from '@/components/ui/IconButton'
import { Skeleton } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/toast-context'
import { errorMessage } from '@/lib/api/errors'
import { cn } from '@/lib/cn'
import { categoryTypeLabels, categoryTypes, useArchiveCategory, useCategories } from './categories-api'
import type { Category, CategoryType } from './categories-api'
import { buildTree } from './category-tree'
import { CategoryFormDialog } from './CategoryFormDialog'
import type { CategoryFormProps } from './CategoryFormDialog'
import { ColourDot } from './ColourDot'

const typeTabLabels: Record<CategoryType, string> = { Expense: 'Expenses', Income: 'Income' }

export function CategoriesPage() {
  const [type, setType] = useState<CategoryType>('Expense')
  const [showArchived, setShowArchived] = useState(false)
  const [form, setForm] = useState<Omit<CategoryFormProps, 'all'> | null>(null)
  const [archiving, setArchiving] = useState<Category | null>(null)
  const { notify } = useToast()

  const categories = useCategories(showArchived)
  const all = categories.data ?? []
  const tree = buildTree(all, type)
  const archive = useArchiveCategory()

  const activeChildren = archiving ? all.filter((c) => c.parentCategoryId === archiving.id && !c.isArchived).length : 0

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
        title="Categories"
        description="Group your income and spending."
        actions={
          <Button onClick={() => setForm({ defaultType: type })}>
            <Plus />
            New category
          </Button>
        }
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div role="radiogroup" aria-label="Category type" className="inline-flex rounded-lg border border-line bg-surface p-0.5">
          {categoryTypes.map((option) => (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={type === option}
              onClick={() => setType(option)}
              className={cn(
                'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
                type === option ? 'bg-brand text-on-brand' : 'text-muted hover:text-fg',
              )}
            >
              {typeTabLabels[option]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={showArchived}
            onChange={(event) => setShowArchived(event.target.checked)}
            className="size-4 accent-brand"
          />
          Show archived categories
        </label>
      </div>

      <Card>
        {categories.isPending ? (
          <div role="status" className="space-y-3 p-5" aria-label="Loading categories">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
        ) : categories.isError ? (
          <ErrorState error={categories.error} onRetry={() => void categories.refetch()} />
        ) : tree.length === 0 ? (
          <EmptyState
            title={`No ${categoryTypeLabels[type].toLowerCase()} categories yet`}
            description="Add one to start sorting your transactions."
            action={
              <Button size="sm" onClick={() => setForm({ defaultType: type })}>
                <Plus />
                New category
              </Button>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {tree.map(({ category, children }) => (
              <li key={category.id}>
                <Row
                  category={category}
                  onEdit={() => setForm({ category })}
                  onArchive={() => setArchiving(category)}
                  onAddChild={() => setForm({ fixedParent: category })}
                />
                {children.length > 0 && (
                  <ul className="mb-2 ml-[1.625rem] border-l border-line">
                    {children.map((child) => (
                      <li key={child.id}>
                        <Row
                          category={child}
                          nested
                          onEdit={() => setForm({ category: child })}
                          onArchive={() => setArchiving(child)}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {form && <CategoryFormDialog open onOpenChange={(open) => !open && setForm(null)} all={all} {...form} />}
      <ConfirmDialog
        open={archiving !== null}
        onOpenChange={(open) => !open && setArchiving(null)}
        title={`Archive ${archiving?.name ?? 'this category'}?`}
        description={
          (activeChildren > 0
            ? `This also archives its ${activeChildren} ${activeChildren === 1 ? 'subcategory' : 'subcategories'}. `
            : '') +
          'Past transactions keep it, but you will not be able to use it for new ones. This cannot be undone.'
        }
        confirmLabel="Archive"
        pending={archive.isPending}
        onConfirm={confirmArchive}
      />
    </>
  )
}

interface RowProps {
  category: Category
  nested?: boolean
  onEdit: () => void
  onArchive: () => void
  /** Only top-level categories can have subcategories. */
  onAddChild?: () => void
}

function Row({ category, nested = false, onEdit, onArchive, onAddChild }: RowProps) {
  return (
    <div className={cn('flex items-center gap-3 py-2.5 pr-5', nested ? 'pl-5' : 'pl-5 pt-3', category.isArchived && 'text-muted')}>
      <ColourDot colour={category.colour} />
      <span className={cn('min-w-0 flex-1 truncate text-sm', nested ? 'text-fg' : 'font-medium text-fg')}>{category.name}</span>
      {category.isArchived && <Badge tone="warning">Archived</Badge>}
      {!category.isArchived && (
        <span className="flex shrink-0 gap-1">
          {onAddChild && (
            <IconButton label={`Add subcategory to ${category.name}`} icon={<Plus />} onClick={onAddChild} />
          )}
          <IconButton label={`Edit ${category.name}`} icon={<Pencil />} onClick={onEdit} />
          <IconButton label={`Archive ${category.name}`} icon={<Archive />} tone="danger" onClick={onArchive} />
        </span>
      )}
    </div>
  )
}
