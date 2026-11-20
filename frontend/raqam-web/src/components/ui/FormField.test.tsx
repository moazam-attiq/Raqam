import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FormField } from './FormField'
import { Input } from './Input'

describe('FormField', () => {
  it('connects the label to the control', () => {
    render(<FormField label="Name">{(field) => <Input {...field} />}</FormField>)

    expect(screen.getByLabelText('Name')).toBeInTheDocument()
  })

  it('shows an error, marks the control invalid and describes it by the message', () => {
    render(
      <FormField label="Amount" error="Amount must be greater than zero.">
        {(field) => <Input {...field} />}
      </FormField>,
    )

    const input = screen.getByLabelText('Amount')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription('Amount must be greater than zero.')
    expect(screen.getByRole('alert')).toHaveTextContent('Amount must be greater than zero.')
  })

  it('describes the control by both its hint and its error', () => {
    render(
      <FormField label="Amount" hint="In rupees" error="Too large.">
        {(field) => <Input {...field} />}
      </FormField>,
    )

    expect(screen.getByLabelText('Amount')).toHaveAccessibleDescription('In rupees Too large.')
  })

  it('has no error attributes when valid', () => {
    render(<FormField label="Name">{(field) => <Input {...field} />}</FormField>)

    const input = screen.getByLabelText('Name')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})
