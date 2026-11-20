import type { Category, CategoryType } from './categories-api'

export interface CategoryBranch {
  category: Category
  children: Category[]
}

const byName = (a: Category, b: Category) => a.name.localeCompare(b.name)

/**
 * Groups one type's categories as parents with their subcategories, each sorted by name.
 * A subcategory whose parent is missing from the list is shown as a top-level entry rather
 * than silently dropped.
 */
export function buildTree(categories: Category[], type: CategoryType): CategoryBranch[] {
  const ofType = categories.filter((category) => category.type === type)
  const ids = new Set(ofType.map((category) => category.id))
  const isTop = (category: Category) => category.parentCategoryId === null || !ids.has(category.parentCategoryId)

  return ofType
    .filter(isTop)
    .sort(byName)
    .map((category) => ({
      category,
      children: ofType.filter((child) => child.parentCategoryId === category.id).sort(byName),
    }))
}
