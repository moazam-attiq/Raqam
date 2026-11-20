import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DateField } from './DateField'

function Harness({ initial = '', maxDate, onChange }: { initial?: string; maxDate?: string; onChange?: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <label>
      Date
      <DateField
        value={value}
        maxDate={maxDate}
        onChange={(next) => {
          setValue(next)
          onChange?.(next)
        }}
      />
    </label>
  )
}

describe('DateField', () => {
  it('shows an API date as "18 May 2026"', () => {
    render(<Harness initial="2026-05-18" />)

    expect(screen.getByRole('textbox')).toHaveValue('18 May 2026')
  })

  it('turns a typed date into the API format on blur', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(screen.getByRole('textbox'), '5 jan 2026')
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith('2026-01-05')
    expect(screen.getByRole('textbox')).toHaveValue('5 Jan 2026')
  })

  it('commits a typed date on Enter', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness onChange={onChange} />)

    await user.type(screen.getByRole('textbox'), '18 May 2026{Enter}')

    expect(onChange).toHaveBeenLastCalledWith('2026-05-18')
  })

  it('flags a date that does not exist and keeps the previous value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2026-05-18" onChange={onChange} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '31 Feb 2026')
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Enter a date like 18 May 2026.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('clears the value when the text is emptied', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2026-05-18" onChange={onChange} />)

    await user.clear(screen.getByRole('textbox'))
    await user.tab()

    expect(onChange).toHaveBeenLastCalledWith('')
  })

  it('picks a day from the calendar', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2026-05-18" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Choose date' }))
    await user.click(await screen.findByRole('button', { name: /20(th)? May(,)? 2026|May 20/i }))

    expect(onChange).toHaveBeenLastCalledWith('2026-05-20')
    expect(screen.getByRole('textbox')).toHaveValue('20 May 2026')
  })

  it('refuses a typed date after the latest allowed one and keeps the previous value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2026-05-10" maxDate="2026-05-18" onChange={onChange} />)

    const input = screen.getByRole('textbox')
    await user.clear(input)
    await user.type(input, '19 May 2026')
    await user.tab()

    expect(screen.getByRole('alert')).toHaveTextContent('Choose 18 May 2026 or earlier.')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(onChange).not.toHaveBeenCalled()
  })

  it('accepts the latest allowed date itself', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness maxDate="2026-05-18" onChange={onChange} />)

    await user.type(screen.getByRole('textbox'), '18 May 2026{Enter}')

    expect(onChange).toHaveBeenLastCalledWith('2026-05-18')
  })

  it('greys out calendar days after the latest allowed date', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Harness initial="2026-05-10" maxDate="2026-05-18" onChange={onChange} />)

    await user.click(screen.getByRole('button', { name: 'Choose date' }))
    expect(await screen.findByRole('dialog', { name: 'Calendar' })).toBeInTheDocument()
    const after = await screen.findByRole('button', { name: /19(th)? May(,)? 2026|May 19/i })
    const allowed = screen.getByRole('button', { name: /18(th)? May(,)? 2026|May 18/i })

    expect(after).toBeDisabled()
    expect(allowed).toBeEnabled()
  })
})
