import dayjs from 'dayjs'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import utc from 'dayjs/plugin/utc'
import type { Dayjs } from 'dayjs'

dayjs.extend(customParseFormat)
dayjs.extend(utc)

// D041: users see "18 May 2026" everywhere; the API and URLs use "2026-05-18".
export const API_DATE_FORMAT = 'YYYY-MM-DD'
export const DISPLAY_DATE_FORMAT = 'D MMM YYYY'
export const DISPLAY_TIMESTAMP_FORMAT = 'D MMM YYYY, h:mm A'

// Strict formats, so each form a person might type (5 / 05, Jan / January) is listed.
const TYPED_FORMATS = [DISPLAY_DATE_FORMAT, 'DD MMM YYYY', 'D MMMM YYYY', 'DD MMMM YYYY', API_DATE_FORMAT]

/**
 * A plain date from the API ("2026-05-18") as a local calendar date. Strict, so "2026-02-31"
 * is rejected. It is never routed through UTC, so it cannot shift by a day (spec rule 8).
 */
export function parseApiDate(value: string): Dayjs | null {
  const parsed = dayjs(value, API_DATE_FORMAT, true)
  return parsed.isValid() ? parsed : null
}

/** What a user types into a date field: "18 May 2026" (also "18 may 2026" and "2026-05-18"). */
export function parseTypedDate(text: string): Dayjs | null {
  const normalized = text
    .trim()
    .replace(/[A-Za-z]+/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  if (!normalized) {
    return null
  }
  for (const format of TYPED_FORMATS) {
    const parsed = dayjs(normalized, format, true)
    if (parsed.isValid()) {
      return parsed
    }
  }
  return null
}

/** "18 May 2026" for an API date string, a Date or a Dayjs; an empty string when invalid. */
export function formatDate(value: string | Date | Dayjs | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }
  const parsed = typeof value === 'string' ? parseApiDate(value) : dayjs(value)
  return parsed?.isValid() ? parsed.format(DISPLAY_DATE_FORMAT) : ''
}

/** "2026-05-18": what the API and the URL carry. */
export function toApiDate(value: Date | Dayjs): string {
  return dayjs(value).format(API_DATE_FORMAT)
}

export function todayApiDate(): string {
  return dayjs().format(API_DATE_FORMAT)
}

/** A UTC timestamp from the API ("...Z") shown in the user's local time: "18 May 2026, 3:42 PM". */
export function formatTimestamp(iso: string): string {
  const parsed = dayjs.utc(iso)
  return parsed.isValid() ? parsed.local().format(DISPLAY_TIMESTAMP_FORMAT) : ''
}

/** For the calendar popover, which works with Date objects. */
export function toCalendarDate(value: string): Date | undefined {
  return parseApiDate(value)?.toDate()
}
