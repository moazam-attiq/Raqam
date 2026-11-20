import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { DateField } from '@/components/ui/DateField'
import { FormField } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { cn } from '@/lib/cn'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { categoryOptions } from '@/features/categories/category-options'
import { todayApiDate } from '@/lib/dates'
import { datesChanged, hasActiveFilters } from './transaction-filters'
import { SEARCH_MAX, transactionSortLabels, transactionSorts, transactionTypes } from './transactions-api'
import type { TransactionFilters, TransactionSort } from './transactions-api'
import type { TransactionType } from './types'

interface TransactionFilterBarProps {
  filters: TransactionFilters
  onChange: (patch: Partial<TransactionFilters>) => void
  onClear: () => void
  accounts: Account[]
  categories: Category[]
  /** Shown under the dates when the range is wrong. */
  dateError: string | null
}

export function TransactionFilterBar({ filters, onChange, onClear, accounts, categories, dateError }: TransactionFilterBarProps) {
  // History matters here, so archived accounts and categories are offered too.
  const accountList = [...accounts].sort((a, b) => a.name.localeCompare(b.name))
  const options = categoryOptions(categories, { includeArchived: true })
  // On a phone everything but the search is folded away until asked for.
  const [expanded, setExpanded] = useState(false)
  const narrowing = [datesChanged(filters), filters.type, filters.accountId, filters.categoryId].filter(Boolean).length
  // Nothing after today can have happened yet, so no date after it can be chosen.
  const today = todayApiDate()

  return (
    <div className="mb-4 space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="sm:col-span-2">
          <FormField label="Search">
            {(field) => <SearchBox {...field} value={filters.search} onCommit={(search) => onChange({ search })} />}
          </FormField>
        </div>
        <div className="sm:col-span-2 md:hidden">
          <Button variant="secondary" size="sm" aria-expanded={expanded} onClick={() => setExpanded((open) => !open)}>
            <SlidersHorizontal />
            {expanded ? 'Hide filters' : narrowing > 0 ? `Filters (${narrowing})` : 'Filters'}
          </Button>
        </div>
        {/* Folded away on a phone until expanded; from md up it adds no box, so its fields join the grid above. */}
        <div className={cn(expanded ? 'grid gap-3 sm:col-span-2 sm:grid-cols-2' : 'hidden', 'md:contents')}>
        <FormField label="From" error={dateError ?? undefined}>
          {(field) => <DateField {...field} value={filters.from} maxDate={today} onChange={(from) => onChange({ from })} />}
        </FormField>
        <FormField label="To">
          {(field) => <DateField {...field} value={filters.to} maxDate={today} onChange={(to) => onChange({ to })} />}
        </FormField>
        <FormField label="Type">
          {(field) => (
            <Select {...field} value={filters.type} onChange={(event) => onChange({ type: event.target.value as TransactionType | '' })}>
              <option value="">All types</option>
              {transactionTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Account">
          {(field) => (
            <Select {...field} value={filters.accountId} onChange={(event) => onChange({ accountId: event.target.value })}>
              <option value="">All accounts</option>
              {accountList.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name + (account.isArchived ? ' (archived)' : '')}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Category" hint={undefined}>
          {(field) => (
            <Select {...field} value={filters.categoryId} onChange={(event) => onChange({ categoryId: event.target.value })}>
              <option value="">All categories</option>
              {(['Expense', 'Income'] as const).map((type) => (
                <optgroup key={type} label={type}>
                  {options
                    .filter((option) => option.type === type)
                    .map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                </optgroup>
              ))}
            </Select>
          )}
        </FormField>
        <FormField label="Sort by">
          {(field) => (
            <Select {...field} value={filters.sort} onChange={(event) => onChange({ sort: event.target.value as TransactionSort })}>
              {transactionSorts.map((sort) => (
                <option key={sort} value={sort}>
                  {transactionSortLabels[sort]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
        </div>
      </div>
      {hasActiveFilters(filters) && (
        <Button variant="ghost" size="sm" onClick={onClear}>
          <X />
          Clear filters
        </Button>
      )}
    </div>
  )
}

interface SearchBoxProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
  value: string
  onCommit: (value: string) => void
}

/** Types freely, and updates the list once typing pauses. */
function SearchBox({ value, onCommit, ...aria }: SearchBoxProps) {
  const [text, setText] = useState(value)
  const [syncedValue, setSyncedValue] = useState(value)

  // The filter changed from outside (cleared, or a link was opened): show it.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(value)
  }

  useEffect(() => {
    const trimmed = text.trim()
    if (trimmed === value) {
      return
    }
    const timer = setTimeout(() => onCommit(trimmed), 300)
    return () => clearTimeout(timer)
  }, [text, value, onCommit])

  return (
    <div className="relative">
      <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-3 size-4 text-muted" />
      <Input
        {...aria}
        type="search"
        value={text}
        maxLength={SEARCH_MAX}
        placeholder="Description or merchant"
        autoComplete="off"
        className="pl-9"
        onChange={(event) => setText(event.target.value)}
      />
    </div>
  )
}
