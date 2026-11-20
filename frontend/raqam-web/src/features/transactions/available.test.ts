import { describe, expect, it } from 'vitest'
import { availableToSpend, effectOn } from './available'
import type { Transaction } from './types'

const A = 'a0000000-0000-4000-8000-000000000001'
const B = 'a0000000-0000-4000-8000-000000000002'
const tx = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1', type: 'Expense', amount: 60, transactionDate: '2026-05-18', sourceAccountId: A, destinationAccountId: null,
  categoryId: 'c', description: '', merchant: null, createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})

describe('effectOn', () => {
  it('takes an expense from its account and ignores others', () => {
    expect(effectOn(tx({}), A)).toBe(-60)
    expect(effectOn(tx({}), B)).toBe(0)
  })

  it('adds income to its account', () => {
    expect(effectOn(tx({ type: 'Income' }), A)).toBe(60)
  })

  it('takes a transfer from the source and adds it to the destination', () => {
    const transfer = tx({ type: 'Transfer', destinationAccountId: B, categoryId: null })
    expect(effectOn(transfer, A)).toBe(-60)
    expect(effectOn(transfer, B)).toBe(60)
    expect(effectOn(transfer, 'other')).toBe(0)
  })
})

describe('availableToSpend', () => {
  it('is the whole balance for a new transaction', () => {
    expect(availableToSpend(1000, undefined, A)).toBe(1000)
  })

  it('gives back an expense that is being edited', () => {
    expect(availableToSpend(40, tx({}), A)).toBe(100)
    expect(availableToSpend(40, tx({}), B)).toBe(40)
  })

  it('takes away income that is being edited, since it is part of the balance', () => {
    expect(availableToSpend(500, tx({ type: 'Income', amount: 300 }), A)).toBe(200)
  })

  it('adds up in whole paise', () => {
    expect(availableToSpend(0.1, tx({ amount: 0.2 }), A)).toBe(0.3)
  })

  it('is never negative', () => {
    expect(availableToSpend(-200, undefined, A)).toBe(0)
    expect(availableToSpend(100, tx({ type: 'Income', amount: 300 }), A)).toBe(0)
  })
})
