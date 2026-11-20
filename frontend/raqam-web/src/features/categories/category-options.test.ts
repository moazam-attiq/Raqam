import { describe, expect, it } from 'vitest'
import type { Category } from './categories-api'
import { categoryOptions } from './category-options'

const make = (id: string, name: string, overrides: Partial<Category> = {}): Category => ({
  id, name, type: 'Expense', parentCategoryId: null, colour: null, icon: null,
  isArchived: false, createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})

const list = [
  make('f', 'Food'),
  make('g', 'Groceries', { parentCategoryId: 'f' }),
  make('t', 'Transport'),
  make('s', 'Salary', { type: 'Income' }),
  make('old', 'Old gym', { isArchived: true }),
]

describe('categoryOptions', () => {
  it('lists each parent followed by its subcategories, labelled with the parent', () => {
    expect(categoryOptions(list, { type: 'Expense' }).map((o) => o.label)).toEqual(['Food', 'Food › Groceries', 'Transport'])
  })

  it('keeps income and expense apart when a type is given', () => {
    expect(categoryOptions(list, { type: 'Income' }).map((o) => o.label)).toEqual(['Salary'])
  })

  it('offers both types, expense first, when none is given', () => {
    expect(categoryOptions(list).map((o) => o.type)).toEqual(['Expense', 'Expense', 'Expense', 'Income'])
  })

  it('hides archived ones unless asked, or unless it is the one already on the record', () => {
    expect(categoryOptions(list, { type: 'Expense' }).some((o) => o.id === 'old')).toBe(false)
    expect(categoryOptions(list, { type: 'Expense', keepId: 'old' }).find((o) => o.id === 'old')?.label).toBe('Old gym (archived)')
    expect(categoryOptions(list, { includeArchived: true }).some((o) => o.id === 'old')).toBe(true)
  })
})
