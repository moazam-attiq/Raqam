import dayjs from 'dayjs'
import { API_DATE_FORMAT, parseApiDate, todayApiDate } from '@/lib/dates'
import { SEARCH_MAX, transactionSorts, transactionTypes } from './transactions-api'
import type { TransactionFilters, TransactionSort } from './transactions-api'
import type { TransactionType } from './types'

export const DEFAULT_SORT: TransactionSort = 'DateDesc'
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * What the list shows until someone asks for more: the 1st of this month up to today. Older
 * history is only fetched when a From date earlier than this is chosen.
 */
export function defaultDateRange(today: string = todayApiDate()): { from: string; to: string } {
  return { from: dayjs(today, API_DATE_FORMAT).startOf('month').format(API_DATE_FORMAT), to: today }
}

/**
 * Reads the filters out of the address. Anything that is not valid is ignored rather than
 * sent to the API, so a hand-edited or old link still opens the list. A date in the future
 * is ignored too, and a missing date falls back to the default range.
 */
export function parseFilters(params: URLSearchParams, today: string = todayApiDate()): TransactionFilters {
  const range = defaultDateRange(today)
  const date = (name: string) => {
    const value = params.get(name) ?? ''
    return parseApiDate(value) && value <= today ? value : ''
  }
  const id = (name: string) => {
    const value = params.get(name) ?? ''
    return GUID.test(value) ? value : ''
  }
  const type = params.get('type') ?? ''
  const sort = params.get('sort') ?? ''
  const page = Number(params.get('page'))

  return {
    from: date('from') || range.from,
    to: date('to') || range.to,
    type: (transactionTypes as readonly string[]).includes(type) ? (type as TransactionType) : '',
    accountId: id('account'),
    categoryId: id('category'),
    search: (params.get('q') ?? '').trim().slice(0, SEARCH_MAX),
    sort: (transactionSorts as readonly string[]).includes(sort) ? (sort as TransactionSort) : DEFAULT_SORT,
    page: Number.isInteger(page) && page >= 1 ? page : 1,
  }
}

/**
 * The address for a set of filters. Anything at its default is left out, so the plain list has
 * a plain URL. The two dates go together: both are written once either one is changed, and a
 * cleared date counts as the default.
 */
export function toSearchParams(filters: TransactionFilters, today: string = todayApiDate()): URLSearchParams {
  const params = new URLSearchParams()
  const range = defaultDateRange(today)
  const from = filters.from || range.from
  const to = filters.to || range.to
  if (from !== range.from || to !== range.to) {
    params.set('from', from)
    params.set('to', to)
  }
  if (filters.type) params.set('type', filters.type)
  if (filters.accountId) params.set('account', filters.accountId)
  if (filters.categoryId) params.set('category', filters.categoryId)
  if (filters.search) params.set('q', filters.search)
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort)
  if (filters.page > 1) params.set('page', String(filters.page))
  return params
}

/** True when anything other than sort and page narrows the list beyond the default month. */
export function hasActiveFilters(filters: TransactionFilters, today: string = todayApiDate()): boolean {
  return Boolean(filters.type || filters.accountId || filters.categoryId || filters.search) || datesChanged(filters, today)
}

/** True when the dates differ from the default range (this month so far). */
export function datesChanged(filters: TransactionFilters, today: string = todayApiDate()): boolean {
  const range = defaultDateRange(today)
  return (filters.from || range.from) !== range.from || (filters.to || range.to) !== range.to
}

/** The API rejects an end date before the start date; say so here instead of sending it. */
export function dateRangeError(filters: TransactionFilters): string | null {
  return filters.from && filters.to && filters.to < filters.from ? 'The end date is before the start date.' : null
}
