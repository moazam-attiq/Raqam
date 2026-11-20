import { useId } from 'react'
import type { ReactNode } from 'react'

export interface FieldControlProps {
  id: string
  'aria-invalid': true | undefined
  'aria-describedby': string | undefined
}

interface FormFieldProps {
  label: string
  /** The message to show under the control; its presence marks the field invalid. */
  error?: string
  hint?: string
  children: (control: FieldControlProps) => ReactNode
}

/**
 * Label, control, hint and error message wired together for screen readers. The control
 * is a render prop so it receives the id and ARIA attributes:
 *
 *   <FormField label="Name" error={errors.name?.message}>
 *     {(field) => <Input {...field} {...register('name')} />}
 *   </FormField>
 */
export function FormField({ label, error, hint, children }: FormFieldProps) {
  const id = useId()
  const hintId = `${id}-hint`
  const errorId = `${id}-error`
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ') || undefined

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-fg">
        {label}
      </label>
      {children({ id, 'aria-invalid': error ? true : undefined, 'aria-describedby': describedBy })}
      {hint && (
        <p id={hintId} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
