import type { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Buttons shown beside the title (e.g. "New account"). */
  actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-fg md:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}
