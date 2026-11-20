import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import dayjs from 'dayjs'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import type { Category } from '@/features/categories/categories-api'
import type { Budget } from './budgets-api'

const user = { id: '1', email: 'me@example.com' }

function category(id: string, name: string, overrides: Partial<Category> = {}): Category {
  return {
    id,
    name,
    type: 'Expense',
    parentCategoryId: null,
    colour: null,
    icon: null,
    isArchived: false,
    createdAtUtc: '',
    updatedAtUtc: '',
    version: 1,
    ...overrides,
  }
}

const food = category('c1', 'Food')
const groceries = category('c2', 'Groceries', { parentCategoryId: 'c1' })
const transport = category('c4', 'Transport')
const salary = category('c5', 'Salary', { type: 'Income' })
const old = category('c9', 'Old', { isArchived: true })
const allCategories = [food, groceries, transport, salary, old]

function budget(id: string, categoryId: string | null, amount: number, spent: number, overrides: Partial<Budget> = {}): Budget {
  const percentUsed = Math.floor((spent / amount) * 10000) / 100
  return {
    id,
    year: 2025,
    month: 9,
    categoryId,
    amount,
    spent,
    remaining: amount - spent,
    percentUsed,
    status: percentUsed >= 100 ? 'LimitReached' : percentUsed >= 80 ? 'NearLimit' : 'OnTrack',
    createdAtUtc: '',
    updatedAtUtc: '',
    version: 3,
    ...overrides,
  }
}

const overall = budget('b1', null, 50000, 41000) //      82%  near the limit
const foodBudget = budget('b2', 'c1', 10000, 12500) //   125% over
const transportBudget = budget('b3', 'c4', 5000, 1000) // 20%  on track

function fakeApi(
  budgets: Budget[],
  options: { categories?: Category[]; extra?: (call: Call) => Response | undefined } = {},
) {
  const { categories = allCategories, extra = () => undefined } = options
  return mockApi((call) => {
    const { method, path } = call
    if (method === 'GET' && path === '/auth/me') return json(user)
    const custom = extra(call)
    if (custom) return custom
    if (method === 'GET' && path === '/categories') return json(categories)
    if (method === 'GET' && path === '/budgets') return json(budgets)
    const match = /^\/budgets\/([^/]+)$/.exec(path)
    if (method === 'GET' && match) {
      const found = budgets.find((b) => b.id === match[1])
      return found ? json(found) : json({ title: 'Not found' }, 404)
    }
    return undefined
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the budgets page', () => {
  it('lists the month with usage, status and what is left', async () => {
    const { sent } = fakeApi([overall, foodBudget, transportBudget])
    renderApp('/budgets?month=2025-09')

    const names = (await screen.findAllByRole('heading', { level: 3 })).map((heading) => heading.textContent)
    expect(names).toEqual(['Overall budget', 'Food', 'Transport'])
    expect(sent('GET', '/budgets')[0]!.query).toEqual({ year: '2025', month: '9' })

    const food = screen.getByRole('progressbar', { name: 'Food budget used' })
    expect(food).toHaveAttribute('aria-valuenow', '100')
    expect(food).toHaveAttribute('aria-valuetext', '125% used')
    expect(screen.getByRole('progressbar', { name: 'Overall budget budget used' })).toHaveAttribute('aria-valuetext', '82% used')
    expect(screen.getByRole('progressbar', { name: 'Transport budget used' })).toHaveAttribute('aria-valuenow', '20')

    expect(screen.getByText(/of Rs 50,000\.00 · 82%/)).toBeInTheDocument()
    expect(screen.getByText('Rs 9,000.00 left')).toBeInTheDocument()
    expect(screen.getByText('Over by Rs 2,500.00')).toBeInTheDocument()
    expect(screen.getByText('Near limit')).toBeInTheDocument()
    expect(screen.getByText('Limit reached')).toBeInTheDocument()
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('never rounds a share up to the next whole percent', async () => {
    fakeApi([budget('b5', null, 10000, 7999)]) // 79.99%
    renderApp('/budgets?month=2025-09')

    expect(await screen.findByRole('progressbar')).toHaveAttribute('aria-valuetext', '79% used')
    expect(screen.getByText('On track')).toBeInTheDocument()
  })

  it('names a subcategory under its parent and marks an archived category', async () => {
    fakeApi([budget('b6', 'c2', 1000, 0), budget('b7', 'c9', 1000, 0)])
    renderApp('/budgets?month=2025-09')

    const names = (await screen.findAllByRole('heading', { level: 3 })).map((heading) => heading.textContent)
    expect(names).toEqual(['Food › Groceries', 'Old (archived)'])
  })

  it('alerts about budgets near or over their limit, and only those', async () => {
    fakeApi([overall, foodBudget, transportBudget])
    renderApp('/budgets?month=2025-09')

    const alerts = await screen.findByRole('region', { name: 'Budget alerts' })
    expect(within(alerts).getByText('Overall budget has used 82% of its budget.')).toBeInTheDocument()
    expect(within(alerts).getByText('Food is over budget by Rs 2,500.00.')).toBeInTheDocument()
    expect(within(alerts).queryByText(/Transport/)).not.toBeInTheDocument()
  })

  it('says a fully used budget is used up, not over', async () => {
    fakeApi([budget('b8', 'c4', 5000, 5000)])
    renderApp('/budgets?month=2025-09')

    const alerts = await screen.findByRole('region', { name: 'Budget alerts' })
    expect(within(alerts).getByText('Transport has used all of its budget.')).toBeInTheDocument()
    expect(screen.getByText('Rs 0.00 left')).toBeInTheDocument()
  })

  it('shows no alert when everything is on track', async () => {
    fakeApi([transportBudget])
    renderApp('/budgets?month=2025-09')

    await screen.findByRole('progressbar')
    expect(screen.queryByRole('region', { name: 'Budget alerts' })).not.toBeInTheDocument()
  })

  it('shows an empty state for a month without budgets', async () => {
    fakeApi([])
    renderApp('/budgets?month=2025-09')

    expect(await screen.findByText('No budgets for September 2025')).toBeInTheDocument()
  })

  it('shows an error with retry when the list cannot load', async () => {
    mockApi((call) => (call.path === '/auth/me' ? json(user) : json({ title: 'Boom' }, 500)))
    renderApp('/budgets?month=2025-09')

    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })
})

describe('choosing the month', () => {
  it('opens on the current month', async () => {
    const { sent } = fakeApi([])
    renderApp('/budgets')

    const today = dayjs()
    expect(await screen.findByRole('heading', { level: 2, name: today.format('MMMM YYYY') })).toBeInTheDocument()
    expect(sent('GET', '/budgets')[0]!.query).toEqual({ year: String(today.year()), month: String(today.month() + 1) })
    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument()
  })

  it('falls back to the current month for an address that is not a month', async () => {
    fakeApi([])
    renderApp('/budgets?month=2025-13')

    expect(await screen.findByRole('heading', { level: 2, name: dayjs().format('MMMM YYYY') })).toBeInTheDocument()
  })

  it('moves to the next and previous month and asks for that month', async () => {
    const { sent } = fakeApi([])
    renderApp('/budgets?month=2025-01')
    const u = userEvent.setup()
    await screen.findByRole('heading', { level: 2, name: 'January 2025' })

    await u.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'December 2024' })).toBeInTheDocument()
    await waitFor(() => expect(sent('GET', '/budgets').at(-1)!.query).toEqual({ year: '2024', month: '12' }))

    await u.click(screen.getByRole('button', { name: 'Next month' }))
    await u.click(screen.getByRole('button', { name: 'Next month' }))
    expect(await screen.findByRole('heading', { level: 2, name: 'February 2025' })).toBeInTheDocument()
    await waitFor(() => expect(sent('GET', '/budgets').at(-1)!.query).toEqual({ year: '2025', month: '2' }))
  })

  it('returns to this month with one click', async () => {
    fakeApi([])
    renderApp('/budgets?month=2025-09')
    const u = userEvent.setup()

    await u.click(await screen.findByRole('button', { name: 'This month' }))

    expect(await screen.findByRole('heading', { level: 2, name: dayjs().format('MMMM YYYY') })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'This month' })).not.toBeInTheDocument()
  })

  it('stops at the first month the API accepts', async () => {
    fakeApi([])
    renderApp('/budgets?month=2000-01')

    expect(await screen.findByRole('button', { name: 'Previous month' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeEnabled()
  })
})

describe('creating a budget', () => {
  async function openNewBudget() {
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New budget/ }))[0]!)
    return u
  }

  it('creates the overall budget for the month being viewed', async () => {
    const { sent } = fakeApi([], {
      extra: (call) => (call.method === 'POST' && call.path === '/budgets' ? json(overall, 201) : undefined),
    })
    renderApp('/budgets?month=2025-09')
    const u = await openNewBudget()

    expect(screen.getByLabelText('Applies to')).toHaveValue('')
    await u.type(screen.getByLabelText('Limit (PKR)'), '25,000')
    await u.click(screen.getByRole('button', { name: 'Create budget' }))

    await waitFor(() => expect(sent('POST', '/budgets')).toHaveLength(1))
    expect(sent('POST', '/budgets')[0]!.body).toEqual({ year: 2025, month: 9, amount: 25000, categoryId: null })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('creates a budget for a category', async () => {
    const { sent } = fakeApi([], {
      extra: (call) => (call.method === 'POST' && call.path === '/budgets' ? json(foodBudget, 201) : undefined),
    })
    renderApp('/budgets?month=2025-09')
    const u = await openNewBudget()

    await u.selectOptions(screen.getByLabelText('Applies to'), 'Food › Groceries')
    await u.type(screen.getByLabelText('Limit (PKR)'), '3000.50')
    await u.click(screen.getByRole('button', { name: 'Create budget' }))

    await waitFor(() => expect(sent('POST', '/budgets')).toHaveLength(1))
    expect(sent('POST', '/budgets')[0]!.body).toEqual({ year: 2025, month: 9, amount: 3000.5, categoryId: 'c2' })
  })

  it('offers the overall budget and expense categories, not income or archived ones', async () => {
    fakeApi([])
    renderApp('/budgets?month=2025-09')
    await openNewBudget()

    const options = within(screen.getByLabelText('Applies to'))
      .getAllByRole('option')
      .map((option) => option.textContent)
    expect(options).toEqual(['Overall budget (all spending)', 'Food', 'Food › Groceries', 'Transport'])
  })

  it('does not offer what already has a budget this month', async () => {
    fakeApi([overall, foodBudget])
    renderApp('/budgets?month=2025-09')
    await openNewBudget()

    const select = screen.getByLabelText('Applies to')
    const options = within(select).getAllByRole('option').map((option) => option.textContent)
    expect(options).toEqual(['Food › Groceries', 'Transport'])
    expect(select).toHaveValue('c2')
  })

  it('says so when every category already has a budget, and blocks the button', async () => {
    fakeApi([overall, transportBudget], { categories: [transport] })
    renderApp('/budgets?month=2025-09')
    await openNewBudget()

    expect(screen.getByText('Every category already has a budget for September 2025.')).toBeInTheDocument()
    expect(screen.queryByLabelText('Applies to')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create budget' })).toBeDisabled()
  })

  it.each([
    ['', 'nothing'],
    ['0', 'zero'],
    ['-5', 'a negative'],
    ['12.345', 'three decimals'],
    ['abc', 'text'],
  ])('refuses %j (%s) before sending anything', async (typed) => {
    const { sent } = fakeApi([])
    renderApp('/budgets?month=2025-09')
    const u = await openNewBudget()
    if (typed) {
      await u.type(screen.getByLabelText('Limit (PKR)'), typed)
    }
    await u.click(screen.getByRole('button', { name: 'Create budget' }))

    expect(await screen.findByText(/Enter an amount above 0/)).toBeInTheDocument()
    expect(sent('POST', '/budgets')).toHaveLength(0)
  })

  it('shows the server message when the category already has a budget', async () => {
    fakeApi([], {
      extra: (call) =>
        call.method === 'POST' && call.path === '/budgets'
          ? json({ title: 'Conflict', detail: 'You already have a budget for Food in September 2025.' }, 409)
          : undefined,
    })
    renderApp('/budgets?month=2025-09')
    const u = await openNewBudget()
    await u.type(screen.getByLabelText('Limit (PKR)'), '100')
    await u.click(screen.getByRole('button', { name: 'Create budget' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('already have a budget for Food')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('refetches the month after a budget is created', async () => {
    const { sent } = fakeApi([], {
      extra: (call) => (call.method === 'POST' && call.path === '/budgets' ? json(overall, 201) : undefined),
    })
    renderApp('/budgets?month=2025-09')
    const u = await openNewBudget()
    await u.type(screen.getByLabelText('Limit (PKR)'), '100')
    await u.click(screen.getByRole('button', { name: 'Create budget' }))

    await waitFor(() => expect(sent('GET', '/budgets').length).toBeGreaterThanOrEqual(2))
  })
})

describe('editing a budget', () => {
  it('changes only the amount and sends the version it saw', async () => {
    const { sent } = fakeApi([foodBudget], {
      extra: (call) =>
        call.method === 'PUT' && call.path === '/budgets/b2' ? json({ ...foodBudget, amount: 15000, version: 4 }) : undefined,
    })
    renderApp('/budgets?month=2025-09')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Food budget' }))

    expect(screen.getByText('Food · September 2025')).toBeInTheDocument()
    expect(screen.queryByLabelText('Applies to')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Limit (PKR)')).toHaveValue('10000.00')

    await u.clear(screen.getByLabelText('Limit (PKR)'))
    await u.type(screen.getByLabelText('Limit (PKR)'), '15,000')
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent('PUT', '/budgets/b2')).toHaveLength(1))
    expect(sent('PUT', '/budgets/b2')[0]!.body).toEqual({ amount: 15000, version: 3 })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('on a stale version, offers to load the latest and saves against the new version', async () => {
    const list = [foodBudget]
    let puts = 0
    const { sent } = fakeApi(list, {
      extra: (call) => {
        if (call.method === 'PUT' && call.path === '/budgets/b2') {
          puts += 1
          if (puts === 1) {
            list[0] = { ...foodBudget, amount: 12000, version: 5 } // someone else saved first
            return json({ title: 'Conflict', detail: 'This record was changed by another request. Reload it and try again.' }, 409)
          }
          return json(list[0])
        }
        return undefined
      },
    })
    renderApp('/budgets?month=2025-09')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Food budget' }))
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    await u.click(await screen.findByRole('button', { name: 'Load latest' }))
    await waitFor(() => expect(screen.getByLabelText('Limit (PKR)')).toHaveValue('12000.00'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent('PUT', '/budgets/b2')).toHaveLength(2))
    expect(sent('PUT', '/budgets/b2')[1]!.body).toEqual({ amount: 12000, version: 5 })
  })
})

describe('deleting a budget', () => {
  it('sends nothing when cancelled', async () => {
    const { sent } = fakeApi([foodBudget])
    renderApp('/budgets?month=2025-09')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Food budget' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/Your transactions are not affected/)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(sent('DELETE', '/budgets/b2')).toHaveLength(0)
  })

  it('deletes after confirmation', async () => {
    const { sent } = fakeApi([foodBudget], {
      extra: (call) => (call.method === 'DELETE' && call.path === '/budgets/b2' ? new Response(null, { status: 204 }) : undefined),
    })
    renderApp('/budgets?month=2025-09')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Food budget' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete budget' }))

    await waitFor(() => expect(sent('DELETE', '/budgets/b2')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})
