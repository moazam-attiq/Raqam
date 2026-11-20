import { describe, expect, it } from 'vitest'
import { formatPkr, parseAmount, sumMoney } from './money'

describe('formatPkr', () => {
  it('always shows two decimals and thousands separators', () => {
    expect(formatPkr(1234.5)).toMatch(/1,234\.50$/)
    expect(formatPkr(0)).toMatch(/0\.00$/)
    expect(formatPkr('250')).toMatch(/250\.00$/)
  })

  it('names the currency in the Pakistani style', () => {
    expect(formatPkr(100)).toContain('Rs')
  })

  it('shows a negative balance with a minus sign', () => {
    expect(formatPkr(-1500)).toMatch(/^-.*1,500\.00$/)
  })

  it('returns an empty string for something that is not a number', () => {
    expect(formatPkr('abc')).toBe('')
    expect(formatPkr(Number.NaN)).toBe('')
  })
})

describe('parseAmount', () => {
  it.each([
    ['250', 250],
    ['250.5', 250.5],
    ['250.50', 250.5],
    ['1,234.50', 1234.5],
    ['  99.99 ', 99.99],
    ['0', 0],
    ['999999999999.99', 999999999999.99],
  ])('accepts %s', (text, expected) => {
    expect(parseAmount(text)).toBe(expected)
  })

  it.each(['', 'abc', '1.234', '12.', '.5', '1e5', '1 000', '--5', '1000000000000'])('rejects %s', (text) => {
    expect(parseAmount(text)).toBeNull()
  })

  it('rejects a third decimal instead of rounding it (D030)', () => {
    expect(parseAmount('10.005')).toBeNull()
  })

  it('accepts a negative only where allowed', () => {
    expect(parseAmount('-200')).toBeNull()
    expect(parseAmount('-200', { allowNegative: true })).toBe(-200)
  })
})

describe('sumMoney', () => {
  it('adds without floating-point drift', () => {
    expect(0.1 + 0.2).not.toBe(0.3)
    expect(sumMoney([0.1, 0.2])).toBe(0.3)
    expect(sumMoney([1000.1, 2000.2, 0.3])).toBe(3000.6)
  })

  it('handles negatives, zero and an empty list', () => {
    expect(sumMoney([100, -250.5])).toBe(-150.5)
    expect(sumMoney([0, 0])).toBe(0)
    expect(sumMoney([])).toBe(0)
  })
})
