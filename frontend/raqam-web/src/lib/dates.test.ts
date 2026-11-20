import { describe, expect, it } from 'vitest'
import { formatDate, formatTimestamp, parseApiDate, parseTypedDate, toApiDate, toCalendarDate, todayApiDate } from './dates'

describe('formatDate', () => {
  it('shows an API date as "18 May 2026"', () => {
    expect(formatDate('2026-05-18')).toBe('18 May 2026')
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026')
  })

  it('formats a Date at its local calendar day', () => {
    expect(formatDate(new Date(2026, 4, 18))).toBe('18 May 2026')
  })

  it('returns an empty string for nothing or an invalid date', () => {
    expect(formatDate('')).toBe('')
    expect(formatDate(null)).toBe('')
    expect(formatDate(undefined)).toBe('')
    expect(formatDate('2026-02-31')).toBe('')
    expect(formatDate('18 May 2026')).toBe('')
  })
})

describe('parseApiDate / toApiDate', () => {
  it('round-trips without shifting the day', () => {
    for (const value of ['2026-05-18', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(toApiDate(parseApiDate(value)!)).toBe(value)
    }
  })

  it('rejects dates that do not exist', () => {
    expect(parseApiDate('2026-02-31')).toBeNull()
    expect(parseApiDate('2025-02-29')).toBeNull()
    expect(parseApiDate('not a date')).toBeNull()
  })
})

describe('parseTypedDate', () => {
  it.each([
    ['18 May 2026', '2026-05-18'],
    ['5 Jan 2026', '2026-01-05'],
    ['05 Jan 2026', '2026-01-05'],
    ['  18 MAY 2026  ', '2026-05-18'],
    ['18 may 2026', '2026-05-18'],
    ['18 September 2026', '2026-09-18'],
    ['2026-05-18', '2026-05-18'],
  ])('reads "%s"', (text, expected) => {
    expect(toApiDate(parseTypedDate(text)!)).toBe(expected)
  })

  it.each(['', '   ', '31 Feb 2026', '18 Mayy 2026', '18/05/2026', 'May 18 2026', '18 May'])('rejects "%s"', (text) => {
    expect(parseTypedDate(text)).toBeNull()
  })
})

describe('toCalendarDate', () => {
  it('gives the local midnight of that calendar day', () => {
    const date = toCalendarDate('2026-05-18')!
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([2026, 4, 18])
  })

  it('gives undefined for no date', () => {
    expect(toCalendarDate('')).toBeUndefined()
  })
})

describe('todayApiDate', () => {
  it('is an API-format date', () => {
    expect(todayApiDate()).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('formatTimestamp', () => {
  it('shows a UTC timestamp as "D MMM YYYY, h:mm A" in local time', () => {
    expect(formatTimestamp('2026-05-18T10:42:00Z')).toMatch(/^\d{1,2} \w{3} 2026, \d{1,2}:42 (AM|PM)$/)
  })

  it('returns an empty string for garbage', () => {
    expect(formatTimestamp('nope')).toBe('')
  })
})
