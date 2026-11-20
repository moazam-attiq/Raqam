import dayjs from 'dayjs'

/** The API accepts budgets from 2000 to 2100 (D053). */
export const MIN_YEAR = 2000
export const MAX_YEAR = 2100

export interface Month {
  year: number
  /** 1 to 12. */
  month: number
}

export function currentMonth(): Month {
  const now = dayjs()
  return { year: now.year(), month: now.month() + 1 }
}

export function isSameMonth(a: Month, b: Month): boolean {
  return a.year === b.year && a.month === b.month
}

/** "2026-11" in the address bar, or null when it is not a month the API accepts. */
export function parseMonth(text: string | null): Month | null {
  const match = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(text ?? '')
  if (!match) {
    return null
  }
  const year = Number(match[1])
  return year >= MIN_YEAR && year <= MAX_YEAR ? { year, month: Number(match[2]) } : null
}

export function formatMonthParam({ year, month }: Month): string {
  return `${year}-${String(month).padStart(2, '0')}`
}

/** The month `delta` months away; the caller checks the bounds with `canShift`. */
export function shiftMonth({ year, month }: Month, delta: number): Month {
  const shifted = dayjs(new Date(year, month - 1 + delta, 1))
  return { year: shifted.year(), month: shifted.month() + 1 }
}

export function canShift(month: Month, delta: number): boolean {
  const { year } = shiftMonth(month, delta)
  return year >= MIN_YEAR && year <= MAX_YEAR
}

/** "November 2026". */
export function monthLabel({ year, month }: Month): string {
  return dayjs(new Date(year, month - 1, 1)).format('MMMM YYYY')
}
