import { buildTree } from './category-tree'
import type { Category, CategoryType } from './categories-api'

export interface CategoryOption {
  id: string
  type: CategoryType
  /** "Food" for a top-level category, "Food › Groceries" for a subcategory. */
  label: string
}

interface Options {
  /** Only this type; leave out for both. */
  type?: CategoryType
  /** Keep archived ones (filters need history). Otherwise only `keepId` survives. */
  includeArchived?: boolean
  /** A category already on the record being edited: offered even if archived. */
  keepId?: string
}

/** Categories as a flat, ordered list for a select: each parent followed by its subcategories. */
export function categoryOptions(categories: Category[], { type, includeArchived = false, keepId }: Options = {}): CategoryOption[] {
  const visible = categories.filter((c) => includeArchived || !c.isArchived || c.id === keepId)
  const types: CategoryType[] = type ? [type] : ['Expense', 'Income']
  const suffix = (c: Category) => (c.isArchived ? ' (archived)' : '')

  return types.flatMap((t) =>
    buildTree(visible, t).flatMap(({ category, children }) => [
      { id: category.id, type: t, label: category.name + suffix(category) },
      ...children.map((child) => ({
        id: child.id,
        type: t,
        label: `${category.name} › ${child.name}${suffix(child)}`,
      })),
    ]),
  )
}
