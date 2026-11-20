import { describe, expect, it } from 'vitest'
import type { Category } from './categories-api'
import { buildTree } from './category-tree'

const make = (id: string, name: string, overrides: Partial<Category> = {}): Category => ({
  id,
  name,
  type: 'Expense',
  parentCategoryId: null,
  colour: null,
  icon: null,
  isArchived: false,
  createdAtUtc: '',
  updatedAtUtc: '',
  version: 1,
  ...overrides,
})

describe('buildTree', () => {
  it('nests subcategories under their parent, sorted by name', () => {
    const tree = buildTree(
      [make('f', 'Food'), make('b', 'Bills'), make('g', 'Groceries', { parentCategoryId: 'f' }), make('d', 'Dining', { parentCategoryId: 'f' })],
      'Expense',
    )
    expect(tree.map((branch) => branch.category.name)).toEqual(['Bills', 'Food'])
    expect(tree[1]!.children.map((child) => child.name)).toEqual(['Dining', 'Groceries'])
  })

  it('keeps income and expense apart', () => {
    const list = [make('f', 'Food'), make('s', 'Salary', { type: 'Income' })]
    expect(buildTree(list, 'Income').map((branch) => branch.category.name)).toEqual(['Salary'])
    expect(buildTree(list, 'Expense').map((branch) => branch.category.name)).toEqual(['Food'])
  })

  it('shows a subcategory whose parent is missing as top level instead of dropping it', () => {
    const tree = buildTree([make('g', 'Groceries', { parentCategoryId: 'gone' })], 'Expense')
    expect(tree.map((branch) => branch.category.name)).toEqual(['Groceries'])
  })
})
