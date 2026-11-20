import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { THEME_STORAGE_KEY } from '@/lib/theme'
import { ThemeProvider } from './ThemeProvider'
import { ThemeToggle } from './ThemeToggle'

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  )
}

describe('ThemeToggle', () => {
  it('defaults to the system setting', () => {
    renderToggle()

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
    expect(document.documentElement).not.toHaveClass('dark')
  })

  it('switches to dark, marks the page and remembers the choice', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(screen.getByRole('radio', { name: 'Dark' }))

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark')
  })

  it('switches back to light', async () => {
    const user = userEvent.setup()
    renderToggle()

    await user.click(screen.getByRole('radio', { name: 'Dark' }))
    await user.click(screen.getByRole('radio', { name: 'Light' }))

    expect(document.documentElement).not.toHaveClass('dark')
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
  })

  it('restores the saved theme on the next visit', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark')

    renderToggle()

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked()
    expect(document.documentElement).toHaveClass('dark')
  })

  it('ignores a corrupt saved value', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple')

    renderToggle()

    expect(screen.getByRole('radio', { name: 'System' })).toBeChecked()
  })
})
