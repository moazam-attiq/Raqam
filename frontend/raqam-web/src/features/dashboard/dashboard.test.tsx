import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import type { Account } from '@/features/accounts/accounts-api'
import type { Category } from '@/features/categories/categories-api'
import type { Transaction } from '@/features/transactions/types'

const user = { id: '1', email: 'me@example.com' }

const account = (id: string, name: string, overrides: Partial<Account> = {}): Account => ({
  id, name, accountType: 'BankAccount', openingBalance: 0, currencyCode: 'PKR', institutionName: null,
  isArchived: false, createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})
const category = (id: string, name: string, overrides: Partial<Category> = {}): Category => ({
  id, name, type: 'Expense', parentCategoryId: null, colour: null, icon: null,
  isArchived: false, createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})
const transaction = (overrides: Partial<Transaction>): Transaction => ({
  id: 't1', type: 'Expense', amount: 200, transactionDate: '2026-05-18', sourceAccountId: 'meezan',
  destinationAccountId: null, categoryId: 'food', description: 'Weekly shop', merchant: null,
  createdAtUtc: '', updatedAtUtc: '', version: 1, ...overrides,
})

const meezan = account('meezan', 'Meezan')
const wallet = account('wallet', 'Wallet', { accountType: 'DigitalWallet' })
const old = account('old', 'Old card', { isArchived: true })
const balances: Record<string, number> = { meezan: 1000.1, wallet: 2000.2, old: 0.3 }

const expense = transaction({})
const income = transaction({ id: 't2', type: 'Income', amount: 50000, categoryId: 'salary', description: 'May salary' })
const transfer = transaction({ id: 't3', type: 'Transfer', amount: 1500, destinationAccountId: 'wallet', categoryId: null, description: 'Top up' })

interface Setup {
  accounts?: Account[]
  items?: Transaction[]
}

function fakeApi({ accounts = [meezan, wallet, old], items = [expense, income, transfer] }: Setup = {}, extra: (call: Call) => Response | undefined = () => undefined) {
  return mockApi((call) => {
    const { method, path } = call
    if (method === 'GET' && path === '/auth/me') return json(user)
    const custom = extra(call)
    if (custom) return custom
    if (method === 'GET' && path === '/accounts') return json(accounts)
    const balance = /^\/accounts\/([^/]+)\/balance$/.exec(path)
    if (method === 'GET' && balance) {
      const id = balance[1]!
      return json({ accountId: id, currencyCode: 'PKR', openingBalance: 0, income: 0, expense: 0, transfersIn: 0, transfersOut: 0, balance: balances[id] ?? 0 })
    }
    if (method === 'GET' && path === '/categories') return json([category('food', 'Food'), category('salary', 'Salary', { type: 'Income' })])
    if (method === 'GET' && path === '/transactions') {
      return json({ items, page: 1, pageSize: Number(call.query.pageSize), totalCount: items.length, totalPages: 1 })
    }
    return undefined
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('the dashboard', () => {
  it('totals every account, archived ones included, and says so', async () => {
    fakeApi()
    renderApp('/')
    // 1000.10 + 2000.20 + 0.30 = 3000.60 exactly, with no floating-point drift.
    expect(await screen.findByText('Rs 3,000.60')).toBeInTheDocument()
    expect(screen.getByText('Across 3 accounts, including 1 archived')).toBeInTheDocument()
  })

  it('lists active accounts with their balances, each linking to its page', async () => {
    fakeApi()
    renderApp('/')

    const row = await screen.findByRole('link', { name: /Meezan/ })
    expect(row).toHaveAttribute('href', '/accounts/meezan')
    expect(await within(row).findByText('Rs 1,000.10')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Wallet/ })).toHaveAttribute('href', '/accounts/wallet')
    expect(screen.queryByRole('link', { name: /Old card/ })).not.toBeInTheDocument()
  })

  it('shows the latest 8 transactions, signed, newest first', async () => {
    const api = fakeApi()
    renderApp('/')

    expect(await screen.findByText('Weekly shop')).toBeInTheDocument()
    expect(screen.getByText('− Rs 200.00')).toBeInTheDocument()
    expect(screen.getByText('+ Rs 50,000.00')).toBeInTheDocument()
    expect(screen.getByText('Rs 1,500.00')).toBeInTheDocument()
    expect(screen.getByText(/Meezan → Wallet/)).toBeInTheDocument()
    expect(api.sent('GET', '/transactions')[0]!.query).toMatchObject({ pageSize: '8', page: '1', sort: 'DateDesc' })
    // The newest entries overall, not just this month's.
    expect(api.sent('GET', '/transactions')[0]!.query.from).toBeUndefined()
    expect(api.sent('GET', '/transactions')[0]!.query.to).toBeUndefined()
    expect(screen.getByRole('link', { name: /All transactions/ })).toHaveAttribute('href', '/transactions')
    expect(screen.getByRole('link', { name: /All accounts/ })).toHaveAttribute('href', '/accounts')
  })

  it('shows no total, rather than a partial one, when a balance cannot load', async () => {
    fakeApi({}, (call) => (call.path === '/accounts/wallet/balance' ? json({ title: 'Boom' }, 500) : undefined))
    renderApp('/')

    expect(await screen.findByText(/Some balances could not be loaded/)).toBeInTheDocument()
    expect(screen.queryByText(/Rs 3,000/)).not.toBeInTheDocument()
    // The balances that did load are still shown.
    expect(await within(await screen.findByRole('link', { name: /Meezan/ })).findByText('Rs 1,000.10')).toBeInTheDocument()
    expect(within(screen.getByRole('link', { name: /Wallet/ })).getByText('—')).toBeInTheDocument()
  })

  it('asks for a first account when there is none, and cannot add a transaction yet', async () => {
    fakeApi({ accounts: [], items: [] })
    renderApp('/')
    expect(await screen.findByText('No accounts yet')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /New transaction/ })).toBeDisabled()
    expect(await screen.findByText('Add an account, then record your first transaction.')).toBeInTheDocument()
  })

  it('shows an empty state when there are accounts but no transactions', async () => {
    fakeApi({ items: [] })
    renderApp('/')
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
  })

  it('shows each section\'s own error with retry', async () => {
    fakeApi({}, (call) => (call.path === '/transactions' ? json({ title: 'Boom' }, 500) : undefined))
    renderApp('/')

    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
    // The balances still show while the transactions section is in error.
    expect(await screen.findByText('Rs 3,000.60')).toBeInTheDocument()
  })

  it('shows an error with retry when the accounts cannot load', async () => {
    fakeApi({}, (call) => (call.path === '/accounts' ? json({ title: 'Boom' }, 500) : undefined))
    renderApp('/')
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })

  it('opens the new transaction form, and refreshes after saving', async () => {
    const api = fakeApi({}, (call) => (call.method === 'POST' && call.path === '/transactions' ? json(expense, 201) : undefined))
    renderApp('/')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: /New transaction/ }))
    const dialog = within(await screen.findByRole('dialog'))
    expect(dialog.getByRole('radio', { name: 'Expense' })).toBeInTheDocument()

    await u.type(dialog.getByLabelText('Amount (PKR)'), '75')
    await u.selectOptions(dialog.getByLabelText('Account'), 'Meezan')
    await u.selectOptions(dialog.getByLabelText('Category'), 'Food')
    await u.click(dialog.getByRole('button', { name: 'Add transaction' }))

    await waitFor(() => expect(api.sent('POST', '/transactions')).toHaveLength(1))
    // Saving refetches the recent list and the balances.
    await waitFor(() => expect(api.sent('GET', '/transactions').length).toBeGreaterThan(1))
    await waitFor(() => expect(api.sent('GET', '/accounts/meezan/balance').length).toBeGreaterThan(1))
  })
})
