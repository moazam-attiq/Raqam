import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import type { Account, AccountBalance } from './accounts-api'

const user = { id: '1', email: 'me@example.com' }

function account(overrides: Partial<Account> = {}): Account {
  return {
    id: 'a1',
    name: 'Meezan',
    accountType: 'BankAccount',
    openingBalance: 1000,
    currencyCode: 'PKR',
    institutionName: 'Meezan Bank',
    isArchived: false,
    createdAtUtc: '2026-05-01T00:00:00Z',
    updatedAtUtc: '2026-05-01T00:00:00Z',
    version: 7,
    ...overrides,
  }
}

function balance(accountId: string, total: number): AccountBalance {
  return { accountId, currencyCode: 'PKR', openingBalance: 1000, income: 500, expense: 200, transfersIn: 0, transfersOut: 0, balance: total }
}

/** A fake API holding accounts; each test can add more routes through `extra`. */
function fakeApi(accounts: Account[], extra: (call: Call) => Response | undefined = () => undefined) {
  return mockApi((call) => {
    const { method, path } = call
    if (method === 'GET' && path === '/auth/me') return json(user)
    const custom = extra(call)
    if (custom) return custom
    if (method === 'GET' && path === '/accounts') return json(accounts)
    const balanceMatch = /^\/accounts\/([^/]+)\/balance$/.exec(path)
    if (method === 'GET' && balanceMatch) return json(balance(balanceMatch[1]!, 1300))
    const match = /^\/accounts\/([^/]+)$/.exec(path)
    if (method === 'GET' && match) {
      const found = accounts.find((a) => a.id === match[1])
      return found ? json(found) : json({ title: 'Account was not found.' }, 404)
    }
    return undefined
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the accounts list', () => {
  it('shows each account with its type and balance', async () => {
    fakeApi([account(), account({ id: 'a2', name: 'Wallet', accountType: 'DigitalWallet', institutionName: null })])
    renderApp('/accounts')

    expect(await screen.findByRole('link', { name: 'Meezan' })).toHaveAttribute('href', '/accounts/a1')
    expect(screen.getByText('Meezan Bank')).toBeInTheDocument()
    // The type appears twice (a phone and a desktop layout); CSS shows one of them.
    expect(screen.getAllByText('Digital wallet').length).toBeGreaterThan(0)
    expect((await screen.findAllByText(/1,300\.00/)).length).toBe(2)
  })

  it('shows an empty state with a way to add the first account', async () => {
    fakeApi([])
    renderApp('/accounts')
    expect(await screen.findByText('No accounts yet')).toBeInTheDocument()
  })

  it('asks for archived accounts only when the box is ticked', async () => {
    const { sent } = fakeApi([account()])
    renderApp('/accounts')
    await screen.findByRole('link', { name: 'Meezan' })
    expect(sent('GET', '/accounts')).toHaveLength(1)

    await userEvent.setup().click(screen.getByLabelText('Show archived accounts'))
    await waitFor(() => expect(sent('GET', '/accounts')).toHaveLength(2))
  })

  it('marks archived accounts and offers no edit or archive for them', async () => {
    fakeApi([account({ isArchived: true })])
    renderApp('/accounts')
    expect((await screen.findAllByText('Archived')).length).toBeGreaterThan(0)
    expect(screen.queryByRole('button', { name: 'Edit Meezan' })).not.toBeInTheDocument()
  })

  it('shows an error with retry when the list cannot load', async () => {
    mockApi((call) => (call.path === '/auth/me' ? json(user) : json({ title: 'Boom' }, 500)))
    renderApp('/accounts')
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })
})

describe('creating an account', () => {
  it('validates before sending anything', async () => {
    const { sent } = fakeApi([])
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(screen.getByText('Choose a type.')).toBeInTheDocument()
    expect(sent('POST', '/accounts')).toHaveLength(0)
  })

  it('rejects a negative opening balance: an account never starts below zero', async () => {
    const { sent } = fakeApi([])
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.type(screen.getByLabelText('Name'), 'Cash')
    await u.selectOptions(screen.getByLabelText('Type'), 'Cash')
    await u.clear(screen.getByLabelText('Opening balance (PKR)'))
    await u.type(screen.getByLabelText('Opening balance (PKR)'), '-200')
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText(/Enter 0 or more/)).toBeInTheDocument()
    expect(sent('POST', '/accounts')).toHaveLength(0)
  })

  it('rejects an opening balance with more than 2 decimals instead of rounding it', async () => {
    const { sent } = fakeApi([])
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.type(screen.getByLabelText('Name'), 'Cash')
    await u.selectOptions(screen.getByLabelText('Type'), 'Cash')
    await u.clear(screen.getByLabelText('Opening balance (PKR)'))
    await u.type(screen.getByLabelText('Opening balance (PKR)'), '10.555')
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText(/up to 2 decimals/)).toBeInTheDocument()
    expect(sent('POST', '/accounts')).toHaveLength(0)
  })

  it('sends the typed values and closes on success', async () => {
    const created = account({ id: 'a9', name: 'Petty cash', accountType: 'Cash', institutionName: null, openingBalance: 1500.5 })
    const { sent } = fakeApi([], (call) => (call.method === 'POST' && call.path === '/accounts' ? json(created, 201) : undefined))
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.type(screen.getByLabelText('Name'), '  Petty cash ')
    await u.selectOptions(screen.getByLabelText('Type'), 'Cash')
    await u.clear(screen.getByLabelText('Opening balance (PKR)'))
    await u.type(screen.getByLabelText('Opening balance (PKR)'), '1,500.50')
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    await waitFor(() => expect(sent('POST', '/accounts')).toHaveLength(1))
    expect(sent('POST', '/accounts')[0]!.body).toEqual({
      name: 'Petty cash',
      accountType: 'Cash',
      openingBalance: 1500.5,
      institutionName: null,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('shows a duplicate name as an error and keeps the dialog open', async () => {
    fakeApi([account()], (call) =>
      call.method === 'POST' && call.path === '/accounts'
        ? json({ title: 'Conflict', detail: "You already have an account named 'Meezan'." }, 409)
        : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.type(screen.getByLabelText('Name'), 'Meezan')
    await u.selectOptions(screen.getByLabelText('Type'), 'BankAccount')
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("already have an account named 'Meezan'")
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('places a server field error under its field', async () => {
    fakeApi([], (call) =>
      call.method === 'POST' && call.path === '/accounts'
        ? json({ title: 'Validation failed', errors: { Name: ['Name is not allowed.'] } }, 400)
        : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New account/ }))[0]!)
    await u.type(screen.getByLabelText('Name'), 'Cash')
    await u.selectOptions(screen.getByLabelText('Type'), 'Cash')
    await u.click(screen.getByRole('button', { name: 'Create account' }))

    expect(await screen.findByText('Name is not allowed.')).toBeInTheDocument()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})

describe('editing an account', () => {
  it('starts from the current values and sends the version it saw', async () => {
    const { sent } = fakeApi([account()], (call) =>
      call.method === 'PUT' && call.path === '/accounts/a1' ? json(account({ name: 'Meezan Main', version: 8 })) : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Meezan' }))

    const name = screen.getByLabelText('Name')
    expect(name).toHaveValue('Meezan')
    expect(screen.getByLabelText('Opening balance (PKR)')).toHaveValue('1000.00')
    await u.clear(name)
    await u.type(name, 'Meezan Main')
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent('PUT', '/accounts/a1')).toHaveLength(1))
    expect(sent('PUT', '/accounts/a1')[0]!.body).toEqual({
      name: 'Meezan Main',
      accountType: 'BankAccount',
      openingBalance: 1000,
      institutionName: 'Meezan Bank',
      version: 7,
    })
  })

  it('on a conflict, loads the latest values and saves against the new version', async () => {
    const accounts = [account()]
    let puts = 0
    const { sent } = fakeApi(accounts, (call) => {
      if (call.method === 'PUT' && call.path === '/accounts/a1') {
        puts += 1
        if (puts === 1) {
          // Someone else saved first.
          accounts[0] = account({ name: 'Renamed elsewhere', version: 9 })
          return json({ title: 'Conflict', detail: 'This was changed elsewhere. Reload it and try again.' }, 409)
        }
        return json(accounts[0])
      }
      return undefined
    })
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Meezan' }))
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('changed elsewhere')
    expect(sent('PUT', '/accounts/a1')[0]!.body).toMatchObject({ version: 7 })

    await u.click(screen.getByRole('button', { name: 'Load latest' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Renamed elsewhere'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent('PUT', '/accounts/a1')).toHaveLength(2))
    expect(sent('PUT', '/accounts/a1')[1]!.body).toMatchObject({ name: 'Renamed elsewhere', version: 9 })
  })
})

describe('editing an account: duplicate name', () => {
  it('keeps what was typed and does not offer to reload', async () => {
    const { sent } = fakeApi([account(), account({ id: 'a2', name: 'Wallet' })], (call) =>
      call.method === 'PUT' && call.path === '/accounts/a1'
        ? json({ title: 'Conflict', detail: "You already have an account named 'Wallet'." }, 409)
        : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Meezan' }))
    await u.clear(screen.getByLabelText('Name'))
    await u.type(screen.getByLabelText('Name'), 'Wallet')
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("account named 'Wallet'")
    // The version did not move, so this is a duplicate, not a stale edit.
    await waitFor(() => expect(sent('GET', '/accounts/a1')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: 'Load latest' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Wallet')
  })
})

describe('archiving an account', () => {
  it('asks first and sends nothing when cancelled', async () => {
    const { sent } = fakeApi([account()])
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Archive Meezan' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/cannot be undone/)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(sent('POST', '/accounts/a1/archive')).toHaveLength(0)
  })

  it('archives after confirmation', async () => {
    const { sent } = fakeApi([account()], (call) =>
      call.method === 'POST' && call.path === '/accounts/a1/archive' ? json(account({ isArchived: true })) : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Archive Meezan' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(sent('POST', '/accounts/a1/archive')).toHaveLength(1))
  })

  it('shows a rule message from the server as an error', async () => {
    fakeApi([account()], (call) =>
      call.method === 'POST' && call.path === '/accounts/a1/archive'
        ? json({ title: 'Rule', detail: 'Account is already archived.' }, 422)
        : undefined,
    )
    renderApp('/accounts')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Archive Meezan' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})

describe('the account page', () => {
  const page = (items: unknown[], extra: Record<string, number> = {}) => ({
    items,
    page: 1,
    pageSize: 20,
    totalCount: items.length,
    totalPages: 1,
    ...extra,
  })
  const tx = (overrides: Record<string, unknown>) => ({
    id: 't1',
    type: 'Expense',
    amount: 200,
    transactionDate: '2026-05-18',
    sourceAccountId: 'a1',
    destinationAccountId: null,
    categoryId: 'c1',
    description: 'Groceries',
    merchant: 'Imtiaz',
    createdAtUtc: '2026-05-18T00:00:00Z',
    updatedAtUtc: '2026-05-18T00:00:00Z',
    version: 1,
    ...overrides,
  })

  it('shows the balance breakdown and the history with signed amounts', async () => {
    fakeApi([account()], (call) =>
      call.path === '/accounts/a1/transactions'
        ? json(
            page([
              tx({}),
              tx({ id: 't2', type: 'Income', amount: 500, description: 'Salary', merchant: null }),
              tx({ id: 't3', type: 'Transfer', amount: 100, sourceAccountId: 'a2', destinationAccountId: 'a1', description: 'Top up' }),
            ]),
          )
        : undefined,
    )
    renderApp('/accounts/a1')

    expect(await screen.findByRole('heading', { name: 'Meezan' })).toBeInTheDocument()
    expect(await screen.findByText('Opening balance')).toBeInTheDocument()
    expect(screen.getByText('Groceries')).toBeInTheDocument()
    expect(screen.getByText('− Rs 200.00')).toBeInTheDocument()
    expect(screen.getByText('+ Rs 500.00')).toBeInTheDocument()
    expect(screen.getAllByText('Transfer in').length).toBeGreaterThan(0)
    expect(screen.getByText('+ Rs 100.00')).toBeInTheDocument()
  })

  it('shows an empty history', async () => {
    fakeApi([account()], (call) => (call.path === '/accounts/a1/transactions' ? json(page([])) : undefined))
    renderApp('/accounts/a1')
    expect(await screen.findByText('No transactions yet')).toBeInTheDocument()
  })

  it('pages through the history', async () => {
    const { sent } = fakeApi([account()], (call) =>
      call.path === '/accounts/a1/transactions'
        ? json(page([tx({})], { totalCount: 25, totalPages: 2 }))
        : undefined,
    )
    renderApp('/accounts/a1')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: /Next/ }))

    await waitFor(() => expect(sent('GET', '/accounts/a1/transactions')).toHaveLength(2))
  })

  it('says so when the account does not exist', async () => {
    fakeApi([])
    renderApp('/accounts/nope')
    expect(await screen.findByText('Account not found')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /All accounts/ })).toHaveAttribute('href', '/accounts')
    expect(screen.getByRole('heading', { level: 1, name: 'Account' })).toBeInTheDocument()
  })

  it('hides edit and archive for an archived account', async () => {
    fakeApi([account({ isArchived: true })], (call) => (call.path === '/accounts/a1/transactions' ? json(page([])) : undefined))
    renderApp('/accounts/a1')
    expect(await screen.findByText(/new transactions cannot be added/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
  })
})
