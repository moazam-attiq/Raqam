import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import dayjs from 'dayjs'
import { formatDate, todayApiDate, toApiDate } from '@/lib/dates'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import { defaultDateRange } from './transaction-filters'
import type { Transaction } from './types'

const user = { id: '1', email: 'me@example.com' }
const A1 = 'a0000000-0000-4000-8000-000000000001'
const A2 = 'a0000000-0000-4000-8000-000000000002'
const A3 = 'a0000000-0000-4000-8000-000000000003'
const C1 = 'c0000000-0000-4000-8000-000000000001'

const account = (id: string, name: string, isArchived = false): Account => ({
  id, name, accountType: 'BankAccount', openingBalance: 0, currencyCode: 'PKR', institutionName: null,
  isArchived, createdAtUtc: '', updatedAtUtc: '', version: 1,
})
const category = (id: string, name: string, overrides: Partial<Category> = {}): Category => ({
  id, name, type: 'Expense', parentCategoryId: null, colour: null, icon: null,
  isArchived: false, createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})
const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1', type: 'Expense', amount: 200, transactionDate: '2026-05-18', sourceAccountId: A1,
  destinationAccountId: null, categoryId: 'groceries', description: 'Weekly shop', merchant: 'Imtiaz',
  createdAtUtc: '', updatedAtUtc: '', version: 4, ...overrides,
})

const accounts = [account(A1, 'Meezan'), account(A2, 'Wallet'), account(A3, 'Old card', true)]
const categories = [
  category('food', 'Food'),
  category('groceries', 'Groceries', { parentCategoryId: 'food' }),
  category('salary', 'Salary', { type: 'Income' }),
  category('oldgym', 'Old gym', { isArchived: true }),
]
const expense = transaction({})
const income = transaction({ id: 't2', type: 'Income', amount: 50000, categoryId: 'salary', description: 'May salary', merchant: null })
const transfer = transaction({ id: 't3', type: 'Transfer', amount: 1500, destinationAccountId: A2, categoryId: null, description: 'Top up', merchant: null })

const page = (items: Transaction[], extra: Record<string, number> = {}) => ({
  items, page: 1, pageSize: 20, totalCount: items.length, totalPages: 1, ...extra,
})

interface Setup {
  accounts?: Account[]
  items?: Transaction[]
  list?: (call: Call) => Response | undefined
  /** What each account holds; an account not listed holds plenty, so only tests about the limit need this. */
  balances?: Record<string, number>
}

/** A fake API: accounts, categories and a transaction list; each test adds routes through `extra`. */
function fakeApi({ accounts: accountList = accounts, items = [expense, income, transfer], list, balances = {} }: Setup = {}, extra: (call: Call) => Response | undefined = () => undefined) {
  return mockApi((call) => {
    const { method, path } = call
    if (method === 'GET' && path === '/auth/me') return json(user)
    const custom = extra(call)
    if (custom) return custom
    if (method === 'GET' && path === '/accounts') return json(accountList)
    if (method === 'GET' && path === '/categories') return json(categories)
    const balanceOf = /^\/accounts\/([^/]+)\/balance$/.exec(path)
    if (method === 'GET' && balanceOf) {
      const balance = balances[balanceOf[1]!] ?? 1_000_000
      return json({ accountId: balanceOf[1], currencyCode: 'PKR', openingBalance: 0, income: 0, expense: 0, transfersIn: 0, transfersOut: 0, balance })
    }
    if (method === 'GET' && path === '/transactions') return list?.(call) ?? json(page(items))
    return undefined
  })
}

const lastList = (api: ReturnType<typeof fakeApi>) => api.sent('GET', '/transactions').at(-1)!

async function openNew() {
  const u = userEvent.setup()
  await u.click((await screen.findAllByRole('button', { name: /New transaction/ }))[0]!)
  return { u, dialog: within(await screen.findByRole('dialog')) }
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('the transactions list', () => {
  it('shows each transaction with its category, account and a signed amount', async () => {
    fakeApi()
    renderApp('/transactions')

    expect(await screen.findByText('Weekly shop')).toBeInTheDocument()
    expect(screen.getByText('− Rs 200.00')).toBeInTheDocument()
    expect(screen.getByText('+ Rs 50,000.00')).toBeInTheDocument()
    expect(screen.getByText('Rs 1,500.00')).toBeInTheDocument()
    expect(screen.getAllByText(/Food › Groceries/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Meezan → Wallet/).length).toBeGreaterThan(0)
    expect(screen.getByText('Imtiaz')).toBeInTheDocument()
  })

  it('explains an empty list and offers the first transaction', async () => {
    fakeApi({ items: [] })
    renderApp('/transactions')
    expect(await screen.findByText('No transactions this month')).toBeInTheDocument()
    expect(screen.getByText(/choose an earlier From date/)).toBeInTheDocument()
  })

  it('shows only this month so far until asked for more', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    await screen.findByText('Weekly shop')

    const { from, to } = defaultDateRange()
    expect(lastList(api).query).toMatchObject({ from, to })
    expect(screen.getByLabelText('From')).toHaveValue(formatDate(from))
    expect(screen.getByLabelText('To')).toHaveValue(formatDate(to))
    expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument()
  })

  it('looks further back when an earlier From date is chosen, and can return to this month', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    await screen.findByText('Weekly shop')
    const u = userEvent.setup()

    const input = screen.getByLabelText('From')
    await u.clear(input)
    await u.type(input, '1 Jan 2025')
    await u.tab()

    await waitFor(() => expect(lastList(api).query).toMatchObject({ from: '2025-01-01', to: todayApiDate() }))
    // Back to this month: the dates reset and nothing is left to clear (the list itself comes from the cache).
    await u.click(screen.getByRole('button', { name: /Clear filters/ }))
    await waitFor(() => expect(screen.getByLabelText('From')).toHaveValue(formatDate(defaultDateRange().from)))
    expect(screen.queryByRole('button', { name: /Clear filters/ })).not.toBeInTheDocument()
  })

  it('refuses a date in the future', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    await screen.findByText('Weekly shop')
    const u = userEvent.setup()
    const calls = api.sent('GET', '/transactions').length

    const input = screen.getByLabelText('To')
    await u.clear(input)
    await u.type(input, formatDate(dayjs().add(1, 'day')))
    await u.tab()

    expect(await screen.findByText(`Choose ${formatDate(todayApiDate())} or earlier.`)).toBeInTheDocument()
    expect(api.sent('GET', '/transactions')).toHaveLength(calls)
  })

  it('ignores a future date in the address', async () => {
    const api = fakeApi()
    renderApp(`/transactions?from=2026-01-01&to=${toApiDate(dayjs().add(30, 'day'))}`)
    await screen.findByText('Weekly shop')

    expect(lastList(api).query).toMatchObject({ from: '2026-01-01', to: todayApiDate() })
  })

  it('asks for an account first when there is none to use', async () => {
    fakeApi({ accounts: [account(A3, 'Old card', true)], items: [] })
    renderApp('/transactions')
    expect(await screen.findByText('Add an account first')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New transaction/ })).toBeDisabled()
  })

  it('shows an error with retry when the list cannot load', async () => {
    fakeApi({ list: () => json({ title: 'Boom' }, 500) })
    renderApp('/transactions')
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })
})

describe('filters, sort and paging live in the address', () => {
  it('sends the filters from the address and shows them in the controls', async () => {
    const api = fakeApi()
    renderApp(`/transactions?from=2026-05-01&to=2026-05-31&type=Expense&account=${A1}&category=${C1}&q=lunch&sort=AmountDesc&page=2`)
    await screen.findByText('Weekly shop')

    expect(lastList(api).query).toMatchObject({
      from: '2026-05-01', to: '2026-05-31', type: 'Expense', accountId: A1, categoryId: C1, search: 'lunch', sort: 'AmountDesc', page: '2', pageSize: '20',
    })
    expect(screen.getByLabelText('Type')).toHaveValue('Expense')
    expect(screen.getByLabelText('Search')).toHaveValue('lunch')
    expect(screen.getByLabelText('Sort by')).toHaveValue('AmountDesc')
  })

  it('applies a filter and goes back to the first page', async () => {
    const api = fakeApi({ list: (call) => json(page([expense], { page: Number(call.query.page), totalCount: 45, totalPages: 3 })) })
    renderApp('/transactions?page=2')
    await screen.findByText('Weekly shop')
    await userEvent.setup().selectOptions(screen.getByLabelText('Type'), 'Income')

    await waitFor(() => expect(lastList(api).query).toMatchObject({ type: 'Income', page: '1' }))
  })

  it('searches once typing pauses', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    await screen.findByText('Weekly shop')
    await userEvent.setup().type(screen.getByLabelText('Search'), 'tea')

    await waitFor(() => expect(lastList(api).query.search).toBe('tea'))
  })

  it('does not ask the API for an end date before the start date', async () => {
    const api = fakeApi()
    renderApp('/transactions?from=2026-05-10&to=2026-05-01')
    expect((await screen.findAllByText('The end date is before the start date.')).length).toBeGreaterThan(0)
    expect(api.sent('GET', '/transactions')).toHaveLength(0)
  })

  it('clears every filter', async () => {
    const api = fakeApi()
    renderApp(`/transactions?type=Expense&account=${A1}&q=tea`)
    await screen.findByText('Weekly shop')
    await userEvent.setup().click(screen.getByRole('button', { name: /Clear filters/ }))

    await waitFor(() => expect(lastList(api).query.type).toBeUndefined())
    expect(lastList(api).query.search).toBeUndefined()
    expect(lastList(api).query.accountId).toBeUndefined()
    expect(screen.getByLabelText('Search')).toHaveValue('')
  })

  it('folds the filters behind a button on a phone and counts what is applied', async () => {
    fakeApi()
    renderApp(`/transactions?type=Expense&account=${A1}`)
    const toggle = await screen.findByRole('button', { name: 'Filters (2)' })
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    await userEvent.setup().click(toggle)
    expect(screen.getByRole('button', { name: 'Hide filters' })).toHaveAttribute('aria-expanded', 'true')
  })

  it('says when nothing matches the filters', async () => {
    fakeApi({ items: [] })
    renderApp('/transactions?type=Income')
    expect(await screen.findByText('No transactions match')).toBeInTheDocument()
  })

  it('moves between pages', async () => {
    const api = fakeApi({ list: (call) => json(page([expense], { page: Number(call.query.page ?? 1), totalCount: 25, totalPages: 2 })) })
    renderApp('/transactions')
    await userEvent.setup().click(await screen.findByRole('button', { name: /Next/ }))

    await waitFor(() => expect(lastList(api).query.page).toBe('2'))
  })
})

describe('adding a transaction', () => {
  it('validates before sending anything', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    expect(await dialog.findByText(/Enter an amount above 0/)).toBeInTheDocument()
    expect(dialog.getByText('Choose an account.')).toBeInTheDocument()
    expect(dialog.getByText('Choose a category.')).toBeInTheDocument()
    expect(api.sent('POST', '/transactions')).toHaveLength(0)
  })

  it('rejects zero and more than 2 decimals instead of rounding', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '10.555')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))
    expect(await dialog.findByText(/Enter an amount above 0/)).toBeInTheDocument()

    await u.clear(dialog.getByLabelText('Amount (PKR)'))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '0')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))
    expect(dialog.getByText(/Enter an amount above 0/)).toBeInTheDocument()
    expect(api.sent('POST', '/transactions')).toHaveLength(0)
  })

  it('creates an expense with the typed values and closes', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined))
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '1,200.50')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food › Groceries')
    await u.type(dialog.getByLabelText('Description (optional)'), '  Weekly shop ')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    expect(api.sent('POST', '/transactions')[0]!.body).toEqual({
      type: 'Expense', amount: 1200.5, transactionDate: todayApiDate(), sourceAccountId: A1,
      destinationAccountId: null, categoryId: 'groceries', description: 'Weekly shop', merchant: null,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('refuses a typed future date and keeps the last valid one', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined))
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '50')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food › Groceries')

    const date = dialog.getByLabelText('Date')
    await u.clear(date)
    await u.type(date, formatDate(dayjs().add(1, 'day')))
    await u.tab()

    expect(await dialog.findByText(`Choose ${formatDate(todayApiDate())} or earlier.`)).toBeInTheDocument()
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))
    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    expect(api.sent('POST', '/transactions')[0]!.body).toMatchObject({ transactionDate: todayApiDate() })
  })

  it('will not save an existing transaction that is dated in the future until the date is fixed', async () => {
    const future = dayjs().add(3, 'day').format('YYYY-MM-DD')
    const api = fakeApi({ items: [transaction({ transactionDate: future })] })
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Weekly shop' }))
    const dialog = within(screen.getByRole('dialog'))
    await u.click(dialog.getByRole('button', { name: 'Save changes' }))

    expect(await dialog.findByText(`Choose ${formatDate(todayApiDate())} or earlier.`)).toBeInTheDocument()
    expect(api.sent('PUT', '/transactions/t1')).toHaveLength(0)
  })

  it('allows today', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined))
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '50')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food › Groceries')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    expect(api.sent('POST', '/transactions')[0]!.body).toMatchObject({ transactionDate: todayApiDate() })
  })

  it('starts at the account used last time', async () => {
    localStorage.setItem('raqam.lastAccountId', A2)
    fakeApi()
    renderApp('/transactions')
    const { dialog } = await openNew()
    expect(dialog.getByLabelText('Account')).toHaveValue(A2)
  })

  it('starts at the only account when there is just one', async () => {
    fakeApi({ accounts: [account(A1, 'Meezan')] })
    renderApp('/transactions')
    const { dialog } = await openNew()
    expect(dialog.getByLabelText('Account')).toHaveValue(A1)
  })

  it('offers only active accounts and only categories of the chosen type', async () => {
    fakeApi()
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    const names = (label: string) => within(dialog.getByLabelText(label)).getAllByRole('option').map((o) => o.textContent)

    expect(names('Account')).toEqual(['Choose an account', 'Meezan', 'Wallet'])
    expect(names('Category')).toEqual(['Choose a category', 'Food', 'Food › Groceries'])
    await u.click(dialog.getByRole('radio', { name: 'Income' }))
    expect(names('Category')).toEqual(['Choose a category', 'Salary'])
  })

  it('clears the category when the type changes', async () => {
    fakeApi()
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food')
    await u.click(dialog.getByRole('radio', { name: 'Income' }))
    expect(dialog.getByLabelText('Category')).toHaveValue('')
  })

  it('a transfer has two accounts and no category, and the second cannot be the first', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(transfer, 201) : undefined))
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.click(dialog.getByRole('radio', { name: 'Transfer' }))

    expect(dialog.queryByLabelText('Category')).not.toBeInTheDocument()
    expect(dialog.queryByLabelText('Merchant (optional)')).not.toBeInTheDocument()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '1500')
    await u.selectOptions(dialog.getByLabelText('From account'), 'Meezan')
    expect(within(dialog.getByLabelText('To account')).getAllByRole('option').map((o) => o.textContent)).toEqual(['Choose an account', 'Wallet'])
    await u.selectOptions(dialog.getByLabelText('To account'), 'Wallet')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    expect(api.sent('POST', '/transactions')[0]!.body).toMatchObject({
      type: 'Transfer', amount: 1500, sourceAccountId: A1, destinationAccountId: A2, categoryId: null, merchant: null,
    })
  })

  it('"Save and add another" keeps the form open for the next entry', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined))
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food')
    await u.type(dialog.getByLabelText('Amount (PKR)'), '100')
    await u.type(dialog.getByLabelText('Description (optional)'), 'Tea')
    await u.click(dialog.getByRole('button', { name: /Save and add another/ }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    await waitFor(() => expect(dialog.getByLabelText('Amount (PKR)')).toHaveValue(''))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(dialog.getByLabelText('Description (optional)')).toHaveValue('')
    expect(dialog.getByLabelText('Account')).toHaveValue(A1)
    expect(dialog.getByLabelText('Category')).toHaveValue('food')

    await u.type(dialog.getByLabelText('Amount (PKR)'), '250{Enter}')
    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(2))
    expect(api.sent('POST', '/transactions')[1]!.body).toMatchObject({ amount: 250, categoryId: 'food' })
  })

  it('shows a server field message under its field', async () => {
    fakeApi({}, (call) =>
      call.method === 'POST' && call.path === '/transactions'
        ? json({ title: 'Validation failed', errors: { Amount: ['Amount is too large.'] } }, 400)
        : undefined,
    )
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '5')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    expect(await dialog.findByText('Amount is too large.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a business-rule message from the server', async () => {
    fakeApi({}, (call) =>
      call.method === 'POST' && call.path === '/transactions'
        ? json({ title: 'Rule', detail: 'Cannot use an archived category for a new transaction.' }, 400)
        : undefined,
    )
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.type(dialog.getByLabelText('Amount (PKR)'), '5')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    expect(await dialog.findByRole('alert')).toHaveTextContent('archived category')
  })
})

describe('editing a transaction', () => {
  it('starts from the current values and sends the version it saw', async () => {
    const api = fakeApi({}, (call) =>
      call.method === 'PUT' && call.path === '/transactions/t1' ? json({ ...expense, amount: 250, version: 5 }) : undefined,
    )
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Weekly shop' }))
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByLabelText('Amount (PKR)')).toHaveValue('200.00')
    expect(dialog.getByLabelText('Account')).toHaveValue(A1)
    expect(dialog.getByLabelText('Category')).toHaveValue('groceries')
    expect(dialog.getByLabelText('Merchant (optional)')).toHaveValue('Imtiaz')
    await u.clear(dialog.getByLabelText('Amount (PKR)'))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '250')
    await u.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.sent('PUT', '/transactions/t1')).toHaveLength(1))
    expect(api.sent('PUT', '/transactions/t1')[0]!.body).toEqual({
      type: 'Expense', amount: 250, transactionDate: '2026-05-18', sourceAccountId: A1,
      destinationAccountId: null, categoryId: 'groceries', description: 'Weekly shop', merchant: 'Imtiaz', version: 4,
    })
  })

  it('keeps an archived category selectable when it is already on the transaction', async () => {
    fakeApi({ items: [transaction({ categoryId: 'oldgym' })] })
    renderApp('/transactions')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Edit Weekly shop' }))
    const dialog = within(screen.getByRole('dialog'))

    expect(dialog.getByLabelText('Category')).toHaveValue('oldgym')
    expect(within(dialog.getByLabelText('Category')).getByRole('option', { name: 'Old gym (archived)' })).toBeInTheDocument()
  })

  it('on a stale version, loads the latest and saves against the new version', async () => {
    let latest = expense
    let puts = 0
    const api = fakeApi({}, (call) => {
      if (call.method === 'GET' && call.path === '/transactions/t1') return json(latest)
      if (call.method === 'PUT' && call.path === '/transactions/t1') {
        puts += 1
        if (puts === 1) {
          latest = { ...expense, amount: 999, version: 9 } // someone else saved first
          return json({ title: 'Conflict', detail: 'This record was changed by another request. Reload it and try again.' }, 409)
        }
        return json(latest)
      }
      return undefined
    })
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Weekly shop' }))
    const dialog = within(screen.getByRole('dialog'))
    await u.click(dialog.getByRole('button', { name: 'Save changes' }))

    await u.click(await dialog.findByRole('button', { name: 'Load latest' }))
    await waitFor(() => expect(dialog.getByLabelText('Amount (PKR)')).toHaveValue('999.00'))
    await u.click(dialog.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(api.sent('PUT', '/transactions/t1')).toHaveLength(2))
    expect(api.sent('PUT', '/transactions/t1')[1]!.body).toMatchObject({ amount: 999, version: 9 })
  })
})

describe('deleting a transaction', () => {
  it('asks first and sends nothing when cancelled', async () => {
    const api = fakeApi()
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Weekly shop' }))
    const dialog = within(screen.getByRole('alertdialog'))
    expect(dialog.getByText(/Weekly shop for Rs 200\.00 on 18 May 2026/)).toBeInTheDocument()
    await u.click(dialog.getByRole('button', { name: 'Cancel' }))

    expect(api.sent('DELETE', '/transactions/t1')).toHaveLength(0)
  })

  it('deletes after confirmation', async () => {
    const api = fakeApi({}, (call) => (call.method === 'DELETE' && call.path === '/transactions/t1' ? new Response(null, { status: 204 }) : undefined))
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Weekly shop' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.sent('DELETE', '/transactions/t1')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })

  it('steps back a page when the last row of a later page is deleted', async () => {
    const api = fakeApi(
      { list: (call) => json(page(call.query.page === '2' ? [expense] : [income], { page: Number(call.query.page ?? 1), totalCount: 21, totalPages: 2 })) },
      (call) => (call.method === 'DELETE' && call.path === '/transactions/t1' ? new Response(null, { status: 204 }) : undefined),
    )
    renderApp('/transactions?page=2')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Weekly shop' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(api.sent('GET', '/transactions').some((call) => call.query.page === '1')).toBe(true))
  })

  it('shows the server message when the delete fails', async () => {
    fakeApi({}, (call) => (call.method === 'DELETE' ? json({ title: 'Not found', detail: 'Transaction was not found.' }, 404) : undefined))
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Delete Weekly shop' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})

describe('an account never goes below zero', () => {
  const createdExpense = (call: Call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined)

  async function fillExpense(u: ReturnType<typeof userEvent.setup>, dialog: ReturnType<typeof within>, amount: string) {
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await dialog.findByText(/^Available:/)
    await u.type(dialog.getByLabelText('Amount (PKR)'), amount)
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food › Groceries')
  }

  it('shows what the account holds for an expense or transfer, and not for income', async () => {
    fakeApi({ balances: { [A1]: 1000 } })
    renderApp('/transactions')
    const { u, dialog } = await openNew()

    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    expect(await dialog.findByText('Available: Rs 1,000.00')).toBeInTheDocument()

    await u.click(dialog.getByRole('radio', { name: 'Transfer' }))
    expect(dialog.getByLabelText('From account')).toHaveValue(A1)
    expect(dialog.getByText('Available: Rs 1,000.00')).toBeInTheDocument()

    await u.click(dialog.getByRole('radio', { name: 'Income' }))
    expect(dialog.queryByText(/Available:/)).not.toBeInTheDocument()
  })

  it('refuses an expense above the balance without sending it, and allows exactly the balance', async () => {
    const api = fakeApi({ balances: { [A1]: 1000 } }, createdExpense)
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await fillExpense(u, dialog, '1,000.01')

    expect(await dialog.findByText('Meezan has Rs 1,000.00 available.')).toBeInTheDocument()
    expect(dialog.getByLabelText('Amount (PKR)')).toHaveAttribute('aria-invalid', 'true')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))
    expect(api.sent('POST', '/transactions')).toHaveLength(0)

    await u.clear(dialog.getByLabelText('Amount (PKR)'))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '1000')
    expect(dialog.queryByText(/has Rs .* available/)).not.toBeInTheDocument()
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    expect(api.sent('POST', '/transactions')[0]!.body).toMatchObject({ amount: 1000, sourceAccountId: A1 })
  })

  it('refuses a transfer above what the source account holds', async () => {
    const api = fakeApi({ balances: { [A1]: 1000, [A2]: 0 } })
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.click(dialog.getByRole('radio', { name: 'Transfer' }))
    await u.selectOptions(dialog.getByLabelText('From account'), 'Meezan')
    await dialog.findByText(/^Available:/)
    await u.selectOptions(dialog.getByLabelText('To account'), 'Wallet')
    await u.type(dialog.getByLabelText('Amount (PKR)'), '1001')

    expect(await dialog.findByText('Meezan has Rs 1,000.00 available.')).toBeInTheDocument()
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))
    expect(api.sent('POST', '/transactions')).toHaveLength(0)
  })

  it('never blocks income, however little the account holds', async () => {
    const api = fakeApi({ balances: { [A1]: 0 } }, (call) =>
      call.method === 'POST' && call.path === '/transactions' ? json(income, 201) : undefined,
    )
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.click(dialog.getByRole('radio', { name: 'Income' }))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '5000')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Salary')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
  })

  it('when editing, counts the amount being edited as still available', async () => {
    // The 200 expense is already out of the 40 the account holds, so up to 240 can be used.
    const api = fakeApi({ balances: { [A1]: 40 } }, (call) =>
      call.method === 'PUT' && call.path === '/transactions/t1' ? json({ ...expense, amount: 240, version: 5 }) : undefined,
    )
    renderApp('/transactions')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Weekly shop' }))
    const dialog = within(screen.getByRole('dialog'))

    expect(await dialog.findByText('Available: Rs 240.00')).toBeInTheDocument()
    await u.clear(dialog.getByLabelText('Amount (PKR)'))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '240.01')
    expect(await dialog.findByText('Meezan has Rs 240.00 available.')).toBeInTheDocument()

    await u.clear(dialog.getByLabelText('Amount (PKR)'))
    await u.type(dialog.getByLabelText('Amount (PKR)'), '240')
    await u.click(dialog.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(api.sent('PUT', '/transactions/t1')).toHaveLength(1))
  })

  it('leaves the decision to the server when the balance cannot be loaded', async () => {
    const api = fakeApi({}, (call) => {
      if (call.method === 'GET' && /\/balance$/.test(call.path)) return json({ title: 'Boom' }, 500)
      return createdExpense(call)
    })
    renderApp('/transactions')
    const { u, dialog } = await openNew()
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.type(dialog.getByLabelText('Amount (PKR)'), '999999')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food › Groceries')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    expect(dialog.queryByText(/Available:/)).not.toBeInTheDocument()
    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
  })
})

