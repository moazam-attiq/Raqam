import { describe, expect, it } from 'vitest'
import { canShift, formatMonthParam, monthLabel, parseMonth, shiftMonth } from './budget-month'

describe('parseMonth', () => {
  it('reads YYYY-MM', () => {
    expect(parseMonth('2026-11')).toEqual({ year: 2026, month: 11 })
    expect(parseMonth('2000-01')).toEqual({ year: 2000, month: 1 })
    expect(parseMonth('2100-12')).toEqual({ year: 2100, month: 12 })
  })

  it.each([null, '', '2026', '2026-13', '2026-00', '2026-1', '26-11', '2026-11-05', '1999-12', '2101-01', 'abc'])(
    'rejects %s',
    (text) => {
      expect(parseMonth(text)).toBeNull()
    },
  )
})

describe('shiftMonth', () => {
  it('moves across a year boundary in both directions', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 })
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 })
    expect(shiftMonth({ year: 2026, month: 5 }, 0)).toEqual({ year: 2026, month: 5 })
  })

  it('stops at the years the API accepts', () => {
    expect(canShift({ year: 2000, month: 1 }, -1)).toBe(false)
    expect(canShift({ year: 2000, month: 1 }, 1)).toBe(true)
    expect(canShift({ year: 2100, month: 12 }, 1)).toBe(false)
    expect(canShift({ year: 2100, month: 12 }, -1)).toBe(true)
  })
})

describe('formatting', () => {
  it('pads the month for the address bar', () => {
    expect(formatMonthParam({ year: 2026, month: 3 })).toBe('2026-03')
    expect(formatMonthParam({ year: 2026, month: 11 })).toBe('2026-11')
  })

  it('labels a month in words', () => {
    expect(monthLabel({ year: 2025, month: 9 })).toBe('September 2025')
  })
})
