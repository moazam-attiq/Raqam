import type { ReactNode } from 'react'
import { Wordmark } from '@/components/layout/Wordmark'

interface AuthLayoutProps {
  title: string
  description: string
  children: ReactNode
}

/** The frame for signed-out screens: a lapis panel with the mark, and the form beside it. */
export function AuthLayout({ title, description, children }: AuthLayoutProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[5fr_6fr]">
      <header className="flex flex-col justify-between bg-side px-6 py-5 lg:p-12">
        <Wordmark size="lg" />
        <p className="mt-0 hidden max-w-xs text-2xl font-semibold leading-snug tracking-tight text-side-fg lg:block">
          Your accounts, income and spending in one ledger.
        </p>
      </header>
      <main className="flex items-start justify-center px-6 py-10 lg:pt-[22vh]">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-fg">{title}</h1>
          <p className="mt-1.5 text-sm text-muted">{description}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}
