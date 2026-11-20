import * as Popover from '@radix-ui/react-popover'
import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { DayPicker } from 'react-day-picker'
import { formatDate, parseTypedDate, toApiDate, toCalendarDate } from '@/lib/dates'
import { cn } from '@/lib/cn'
import { Input } from './Input'

interface DateFieldProps {
  /** The date as the API carries it ("2026-05-18"), or "" for none. */
  value: string
  onChange: (value: string) => void
  /** The latest date that can be chosen, in API format. Later days are greyed out in the calendar and refused when typed. */
  maxDate?: string
  id?: string
  disabled?: boolean
  'aria-invalid'?: true | undefined
  'aria-describedby'?: string
}

/**
 * A date shown as "18 May 2026" (D041). Type it, or open the calendar. The value going in
 * and out is always the API format. A typed date that does not parse is flagged and the
 * previous value is kept, so a half-typed date can never be saved by accident.
 */
export function DateField({ value, onChange, maxDate, id, disabled, ...aria }: DateFieldProps) {
  const [text, setText] = useState(formatDate(value))
  const [typedError, setTypedError] = useState<string | null>(null)
  const [syncedValue, setSyncedValue] = useState(value)
  const [open, setOpen] = useState(false)

  // The value changed from outside (form reset, calendar pick): show it.
  if (value !== syncedValue) {
    setSyncedValue(value)
    setText(formatDate(value))
    setTypedError(null)
  }

  function commit() {
    if (text.trim() === '') {
      setTypedError(null)
      onChange('')
      return
    }
    const parsed = parseTypedDate(text)
    if (!parsed) {
      setTypedError('Enter a date like 18 May 2026.')
      return
    }
    if (maxDate && toApiDate(parsed) > maxDate) {
      setTypedError(`Choose ${formatDate(maxDate)} or earlier.`)
      return
    }
    setTypedError(null)
    setText(formatDate(parsed))
    onChange(toApiDate(parsed))
  }

  const selected = toCalendarDate(value)
  const latest = maxDate ? toCalendarDate(maxDate) : undefined

  return (
    <div className="relative">
      <Input
        id={id}
        type="text"
        inputMode="text"
        autoComplete="off"
        placeholder="e.g. 18 May 2026"
        value={text}
        disabled={disabled}
        invalid={typedError !== null || aria['aria-invalid'] === true}
        aria-describedby={aria['aria-describedby']}
        className="pr-11"
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
        }}
      />
      {typedError && (
        <p role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {typedError}
        </p>
      )}
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            aria-label="Choose date"
            disabled={disabled}
            className={cn(
              'absolute right-1 top-1 inline-flex size-8 items-center justify-center rounded-md text-muted hover:bg-sunken hover:text-fg',
              'disabled:opacity-50',
            )}
          >
            <CalendarDays className="size-4" aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            aria-label="Calendar"
            align="end"
            sideOffset={6}
            className="z-[60] rounded-xl border border-line bg-surface p-2 text-fg shadow-overlay"
          >
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected}
              captionLayout="dropdown"
              startMonth={new Date(2000, 0)}
              endMonth={latest ?? new Date(2100, 11)}
              disabled={latest ? { after: latest } : undefined}
              onSelect={(date) => {
                if (date) {
                  onChange(toApiDate(date))
                  setOpen(false)
                }
              }}
            />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
