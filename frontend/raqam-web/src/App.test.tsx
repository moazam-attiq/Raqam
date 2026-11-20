import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'

// The shell is only shown to a signed-in user, so these tests sign one in.
async function renderAt(path: string) {
  renderApp(path)
  await screen.findByRole('main')
}

beforeEach(() => {
  mockApi((call) => (call.path === '/auth/me' ? json({ id: '1', email: 'me@example.com' }) : undefined))
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('App shell and routing', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/accounts', 'Accounts'],
    ['/categories', 'Categories'],
    ['/transactions', 'Transactions'],
    ['/budgets', 'Budgets'],
  ])('shows the %s page', async (path, heading) => {
    await renderAt(path)

    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument()
  })

  it('shows a not-found page for an unknown address', async () => {
    await renderAt('/nowhere')

    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('marks the current page in the navigation', async () => {
    await renderAt('/accounts')

    const nav = screen.getAllByRole('navigation', { name: 'Main' })[0]!
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Accounts')
  })

  it('moves between pages from the navigation', async () => {
    const user = userEvent.setup()
    await renderAt('/')

    await user.click(screen.getAllByRole('link', { name: 'Transactions' })[0]!)

    expect(screen.getByRole('heading', { level: 1, name: 'Transactions' })).toBeInTheDocument()
  })

  it('opens and closes the mobile menu', async () => {
    const user = userEvent.setup()
    await renderAt('/')

    const button = screen.getByRole('button', { name: 'Menu' })
    expect(button).toHaveAttribute('aria-expanded', 'false')

    await user.click(button)
    expect(screen.getByRole('button', { name: 'Close' })).toHaveAttribute('aria-expanded', 'true')
    expect(document.getElementById('mobile-menu')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(document.getElementById('mobile-menu')).not.toBeInTheDocument()
  })

  it('has a skip link to the main content', async () => {
    await renderAt('/')

    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main')
    expect(document.getElementById('main')).toBeInTheDocument()
  })
})
