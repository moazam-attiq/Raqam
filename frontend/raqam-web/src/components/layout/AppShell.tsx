import { useState } from 'react'
import { ArrowLeftRight, LayoutDashboard, LogOut, Menu, PiggyBank, ShieldCheck, Tags, Wallet, X } from 'lucide-react'
import { NavLink, Outlet } from 'react-router'
import { cn } from '@/lib/cn'
import { ThemeToggle } from '@/components/theme/ThemeToggle'
import { useSession, useSignOut } from '@/features/auth/session'
import { Wordmark } from './Wordmark'

const navigation = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/accounts', label: 'Accounts', icon: Wallet, end: false },
  { to: '/categories', label: 'Categories', icon: Tags, end: false },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, end: false },
  { to: '/budgets', label: 'Budgets', icon: PiggyBank, end: false },
  { to: '/security', label: 'Security', icon: ShieldCheck, end: false },
]

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="flex flex-col gap-0.5">
      {navigation.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          className={({ isActive }) =>
            cn(
              'relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-side-fg',
              isActive
                ? 'bg-side-active text-side-fg before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-full before:bg-gold'
                : 'text-side-muted hover:bg-side-hover hover:text-side-fg',
            )
          }
        >
          <item.icon className="size-[18px] shrink-0" aria-hidden="true" />
          {item.label}
        </NavLink>
      ))}
    </nav>
  )
}

function SignOutButton({ variant }: { variant: 'plain' | 'side' }) {
  const signOut = useSignOut()
  return (
    <button
      type="button"
      onClick={() => signOut.mutate()}
      disabled={signOut.isPending}
      className={cn(
        'inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors disabled:opacity-60',
        variant === 'side'
          ? 'text-side-muted hover:bg-side-hover hover:text-side-fg focus-visible:outline-side-fg'
          : 'text-muted hover:bg-sunken hover:text-fg',
      )}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Sign out
    </button>
  )
}

/**
 * The frame around every signed-in page: a lapis sidebar for navigation and a navbar on top
 * with the theme toggle and the account. Below the `md` width the sidebar becomes a lapis top
 * bar with a menu button, and the theme toggle stays on that bar.
 */
export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false)
  const session = useSession()

  return (
    <div className="min-h-screen md:flex">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm focus:text-fg focus:shadow-overlay"
      >
        Skip to content
      </a>

      <aside className="hidden w-64 shrink-0 border-r border-side-line bg-side p-5 md:block">
        <div className="mb-8 px-3 pt-1">
          <Wordmark />
        </div>
        <NavLinks />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="hidden h-14 items-center justify-end gap-4 border-b border-line bg-surface px-10 md:flex">
          <ThemeToggle />
          <span aria-hidden="true" className="h-5 w-px bg-line" />
          {session.data && (
            <span className="max-w-56 truncate text-sm text-muted" title={session.data.email}>
              {session.data.email}
            </span>
          )}
          <SignOutButton variant="plain" />
        </header>

        <header className="bg-side md:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Wordmark />
            <div className="flex items-center gap-2">
              <ThemeToggle variant="side" />
              <button
                type="button"
                aria-expanded={menuOpen}
                aria-controls="mobile-menu"
                onClick={() => setMenuOpen((open) => !open)}
                className="inline-flex items-center gap-2 rounded-lg border border-side-line px-3 py-1.5 text-sm font-medium text-side-fg focus-visible:outline-side-fg"
              >
                {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
                {menuOpen ? 'Close' : 'Menu'}
              </button>
            </div>
          </div>
          {menuOpen && (
            <div id="mobile-menu" className="space-y-3 border-t border-side-line px-4 py-4">
              <NavLinks onNavigate={() => setMenuOpen(false)} />
              <div className="border-t border-side-line pt-3">
                {session.data && (
                  <p className="truncate px-2.5 pb-1 text-xs text-side-muted" title={session.data.email}>
                    {session.data.email}
                  </p>
                )}
                <SignOutButton variant="side" />
              </div>
            </div>
          )}
        </header>

        <main id="main" tabIndex={-1} className="mx-auto outline-none w-full max-w-5xl flex-1 p-4 md:px-10 md:py-9">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
