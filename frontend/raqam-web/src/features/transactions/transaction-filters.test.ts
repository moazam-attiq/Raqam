import { describe, expect, it } from 'vitest'
import { datesChanged, dateRangeError, defaultDateRange, hasActiveFilters, parseFilters, toSearchParams } from './transaction-filters'

const ID = 'a0000000-0000-4000-8000-000000000001'
// A fixed "today", so the default month range is the same on every day the tests run.
const TODAY = '2026-11-20'
const parse = (query: string) => parseFilters(new URLSearchParams(query), TODAY)
const toParams = (filters: ReturnType<typeof parse>) => toSearchParams(filters, TODAY)

describe('parseFilters', () => {
  it('defaults to this month so far, newest first, first page, no other filters', () => {
    expect(parse('')).toEqual({
      from: '2026-11-01', to: '2026-11-20', type: '', accountId: '', categoryId: '', search: '', sort: 'DateDesc', page: 1,
    })
  })

  it('ignores a date in the future and uses the default instead', () => {
    expect(parse('from=2026-11-21')).toMatchObject({ from: '2026-11-01', to: '2026-11-20' })
    expect(parse('from=2026-10-01&to=2026-12-31')).toMatchObject({ from: '2026-10-01', to: '2026-11-20' })
    expect(parse('to=2026-11-20')).toMatchObject({ to: '2026-11-20' })
  })

  it('reads every filter from the address', () => {
    expect(parse(`from=2026-05-01&to=2026-05-31&type=Income&account=${ID}&category=${ID}&q=lunch&sort=AmountAsc&page=3`)).toEqual({
      from: '2026-05-01', to: '2026-05-31', type: 'Income', accountId: ID, categoryId: ID, search: 'lunch', sort: 'AmountAsc', page: 3,
    })
  })

  it('ignores anything invalid instead of passing it on', () => {
    const filters = parse('from=2026-02-31&to=soon&type=Gift&account=nope&category=1&sort=Random&page=-2')
    expect(filters).toMatchObject({
      from: '2026-11-01', to: '2026-11-20', type: '', accountId: '', categoryId: '', sort: 'DateDesc', page: 1,
    })
  })

  it('trims the search and keeps it within the API limit', () => {
    expect(parse(`q=${encodeURIComponent('  tea  ')}`).search).toBe('tea')
    expect(parse(`q=${'x'.repeat(150)}`).search).toHaveLength(100)
  })
})

describe('toSearchParams', () => {
  it('leaves defaults out, so the plain list has a plain address', () => {
    expect(toParams(parse(''))).toEqual(new URLSearchParams())
  })

  it('writes both dates once either one is changed', () => {
    expect(toParams({ ...parse(''), from: '2026-01-01' }).toString()).toBe('from=2026-01-01&to=2026-11-20')
    expect(toParams({ ...parse(''), to: '2026-11-10' }).toString()).toBe('from=2026-11-01&to=2026-11-10')
  })

  it('treats a cleared date as the default', () => {
    expect(toParams({ ...parse(''), from: '', to: '' }).toString()).toBe('')
    expect(toParams({ ...parse('from=2026-01-01&to=2026-02-01'), from: '' }).toString()).toBe('from=2026-11-01&to=2026-02-01')
  })

  it('round-trips a full set of filters', () => {
    const query = `from=2026-05-01&to=2026-05-31&type=Expense&account=${ID}&category=${ID}&q=tea&sort=DateAsc&page=2`
    expect(parseFilters(toParams(parse(query)), TODAY)).toEqual(parse(query))
  })
})

describe('hasActiveFilters and dateRangeError', () => {
  it('counts filters but not sort, page or the default month', () => {
    expect(hasActiveFilters(parse('sort=AmountDesc&page=4'), TODAY)).toBe(false)
    expect(hasActiveFilters(parse('q=tea'), TODAY)).toBe(true)
  })

  it('counts a changed date range as a filter', () => {
    expect(datesChanged(parse(''), TODAY)).toBe(false)
    expect(datesChanged(parse('from=2026-10-01&to=2026-11-20'), TODAY)).toBe(true)
    expect(hasActiveFilters(parse('from=2026-10-01&to=2026-11-20'), TODAY)).toBe(true)
  })

  it('flags an end date before the start date only', () => {
    expect(dateRangeError(parse('from=2026-05-10&to=2026-05-01'))).toMatch(/before the start/)
    expect(dateRangeError(parse('from=2026-05-01&to=2026-05-01'))).toBeNull()
    expect(dateRangeError(parse('from=2026-05-10'))).toBeNull()
  })
})

describe('defaultDateRange', () => {
  it('runs from the 1st of the current month to today', () => {
    expect(defaultDateRange('2026-11-20')).toEqual({ from: '2026-11-01', to: '2026-11-20' })
    expect(defaultDateRange('2026-01-01')).toEqual({ from: '2026-01-01', to: '2026-01-01' })
    expect(defaultDateRange('2028-02-29')).toEqual({ from: '2028-02-01', to: '2028-02-29' })
  })
})
