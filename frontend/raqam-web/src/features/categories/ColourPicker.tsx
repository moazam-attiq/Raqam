import { X } from 'lucide-react'
import type { UseFormRegisterReturn } from 'react-hook-form'
import { categoryColours } from './categories-api'

interface ColourPickerProps {
  registration: UseFormRegisterReturn
  /** The colour the category already has, if it is not one of the swatches (set through the API). */
  current: string | null
}

const swatch =
  'flex size-8 items-center justify-center rounded-full ring-offset-2 ring-offset-surface ' +
  'peer-checked:ring-2 peer-checked:ring-fg peer-focus-visible:ring-2 peer-focus-visible:ring-brand'

/** One optional colour from a fixed set: radio buttons drawn as round swatches. */
export function ColourPicker({ registration, current }: ColourPickerProps) {
  const options: Array<{ name: string; value: string }> = [...categoryColours]
  if (current && !options.some((option) => option.value.toLowerCase() === current.toLowerCase())) {
    options.push({ name: 'Current colour', value: current })
  }

  return (
    <fieldset>
      <legend className="mb-1.5 text-sm font-medium text-fg">Colour (optional)</legend>
      <div className="flex flex-wrap gap-2.5">
        <label title="No colour">
          <input type="radio" value="" className="peer sr-only" aria-label="No colour" {...registration} />
          <span className={`${swatch} border border-dashed border-line text-muted`}>
            <X className="size-4" aria-hidden="true" />
          </span>
        </label>
        {options.map((option) => (
          <label key={option.value} title={option.name}>
            <input type="radio" value={option.value} className="peer sr-only" aria-label={option.name} {...registration} />
            <span className={swatch} style={{ backgroundColor: option.value }} />
          </label>
        ))}
      </div>
    </fieldset>
  )
}
