import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { json, mockApi } from '@/test/api-mock'
import type { Call } from '@/test/api-mock'
import { renderApp } from '@/test/render-app'
import type { Category } from './categories-api'

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
    version: 3,
    ...overrides,
  }
}

const food = category('c1', 'Food')
const groceries = category('c2', 'Groceries', { parentCategoryId: 'c1' })
const dining = category('c3', 'Dining out', { parentCategoryId: 'c1' })
const transport = category('c4', 'Transport', { colour: '#3E63DD' })
const salary = category('c5', 'Salary', { type: 'Income' })

/** A fake API holding categories; each test adds its own routes through `extra`. */
function fakeApi(categories: Category[], extra: (call: Call) => Response | undefined = () => undefined) {
  return mockApi((call) => {
    const { method, path } = call
    if (method === 'GET' && path === '/auth/me') return json(user)
    const custom = extra(call)
    if (custom) return custom
    if (method === 'GET' && path === '/categories') return json(categories)
    const match = /^\/categories\/([^/]+)$/.exec(path)
    if (method === 'GET' && match) {
      const found = categories.find((c) => c.id === match[1])
      return found ? json(found) : json({ title: 'Not found' }, 404)
    }
    return undefined
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('the categories list', () => {
  it('shows expense categories as a tree, with subcategories under their parent', async () => {
    fakeApi([food, groceries, dining, transport, salary])
    renderApp('/categories')

    const lists = await screen.findAllByRole('list')
    expect(screen.getByText('Food')).toBeInTheDocument()
    expect(screen.getByText('Transport')).toBeInTheDocument()
    // The two subcategories sit in a nested list inside Food's item.
    const nested = lists.find((list) => within(list).queryByText('Groceries') && !within(list).queryByText('Transport'))
    expect(nested).toBeDefined()
    expect(within(nested!).getByText('Dining out')).toBeInTheDocument()
    expect(screen.queryByText('Salary')).not.toBeInTheDocument()
  })

  it('switches to income', async () => {
    fakeApi([food, salary])
    renderApp('/categories')
    await screen.findByText('Food')
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Income' }))

    expect(screen.getByText('Salary')).toBeInTheDocument()
    expect(screen.queryByText('Food')).not.toBeInTheDocument()
  })

  it('shows an empty state for a type with no categories', async () => {
    fakeApi([food])
    renderApp('/categories')
    await screen.findByText('Food')
    await userEvent.setup().click(screen.getByRole('radio', { name: 'Income' }))
    expect(screen.getByText('No income categories yet')).toBeInTheDocument()
  })

  it('asks for archived categories only when the box is ticked, and labels them', async () => {
    const { sent } = fakeApi([food], (call) =>
      call.path === '/categories' && call.method === 'GET'
        ? json([food, category('c9', 'Old', { isArchived: true })])
        : undefined,
    )
    renderApp('/categories')
    await screen.findByText('Food')
    expect(sent('GET', '/categories')).toHaveLength(1)

    await userEvent.setup().click(screen.getByLabelText('Show archived categories'))
    await waitFor(() => expect(sent('GET', '/categories')).toHaveLength(2))
    expect(await screen.findByText('Archived')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit Old' })).not.toBeInTheDocument()
  })

  it('offers subcategories only under top-level categories', async () => {
    fakeApi([food, groceries])
    renderApp('/categories')
    await screen.findByText('Groceries')
    expect(screen.getByRole('button', { name: 'Add subcategory to Food' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Add subcategory to Groceries' })).not.toBeInTheDocument()
  })

  it('shows an error with retry when the list cannot load', async () => {
    mockApi((call) => (call.path === '/auth/me' ? json(user) : json({ title: 'Boom' }, 500)))
    renderApp('/categories')
    expect(await screen.findByRole('button', { name: /Try again/ })).toBeInTheDocument()
  })
})

describe('creating a category', () => {
  async function openNewCategory() {
    const u = userEvent.setup()
    await u.click((await screen.findAllByRole('button', { name: /New category/ }))[0]!)
    return u
  }

  it('validates the name before sending anything', async () => {
    const { sent } = fakeApi([food])
    renderApp('/categories')
    const u = await openNewCategory()
    await u.click(screen.getByRole('button', { name: 'Create category' }))

    expect(await screen.findByText('Enter a name.')).toBeInTheDocument()
    expect(sent('POST', '/categories')).toHaveLength(0)
  })

  it('creates a top-level category of the type being viewed, with a colour', async () => {
    const { sent } = fakeApi([salary, food], (call) =>
      call.method === 'POST' && call.path === '/categories' ? json(category('n1', 'Bonus', { type: 'Income' }), 201) : undefined,
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('radio', { name: 'Income' }))
    await u.click(screen.getAllByRole('button', { name: /New category/ })[0]!)
    await u.type(screen.getByLabelText('Name'), '  Bonus ')
    expect(screen.getByLabelText('Type')).toHaveValue('Income')
    await u.click(screen.getByRole('radio', { name: 'Green' }))
    await u.click(screen.getByRole('button', { name: 'Create category' }))

    await waitFor(() => expect(sent('POST', '/categories')).toHaveLength(1))
    expect(sent('POST', '/categories')[0]!.body).toEqual({
      name: 'Bonus',
      type: 'Income',
      parentCategoryId: null,
      colour: '#30A46C',
      icon: null,
    })
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
  })

  it('offers only top-level, unarchived parents of the chosen type', async () => {
    fakeApi([food, groceries, transport, salary, category('c8', 'Old', { isArchived: true })])
    renderApp('/categories')
    const u = await openNewCategory()
    const parent = screen.getByLabelText('Parent category (optional)')
    const names = () => within(parent).getAllByRole('option').map((option) => option.textContent)

    expect(names()).toEqual(['None, top level', 'Food', 'Transport'])
    await u.selectOptions(screen.getByLabelText('Type'), 'Income')
    expect(names()).toEqual(['None, top level', 'Salary'])
  })

  it('adds a subcategory under a fixed parent, whose type it takes', async () => {
    const { sent } = fakeApi([food, groceries], (call) =>
      call.method === 'POST' && call.path === '/categories' ? json(category('n2', 'Snacks', { parentCategoryId: 'c1' }), 201) : undefined,
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Add subcategory to Food' }))

    expect(screen.getByText(/Expense category · subcategory of Food/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument()
    await u.type(screen.getByLabelText('Name'), 'Snacks')
    await u.click(screen.getByRole('button', { name: 'Create category' }))

    await waitFor(() => expect(sent('POST', '/categories')).toHaveLength(1))
    expect(sent('POST', '/categories')[0]!.body).toEqual({
      name: 'Snacks',
      type: 'Expense',
      parentCategoryId: 'c1',
      colour: null,
      icon: null,
    })
  })

  it('shows a duplicate name as an error and keeps the dialog open', async () => {
    fakeApi([food], (call) =>
      call.method === 'POST' && call.path === '/categories'
        ? json({ title: 'Conflict', detail: "You already have a expense category named 'Food' here." }, 409)
        : undefined,
    )
    renderApp('/categories')
    const u = await openNewCategory()
    await u.type(screen.getByLabelText('Name'), 'Food')
    await u.click(screen.getByRole('button', { name: 'Create category' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("already have a expense category named 'Food'")
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('shows a business-rule message from the server', async () => {
    fakeApi([food], (call) =>
      call.method === 'POST' && call.path === '/categories'
        ? json({ title: 'Rule', detail: 'Cannot add a subcategory to an archived category.' }, 400)
        : undefined,
    )
    renderApp('/categories')
    const u = await openNewCategory()
    await u.type(screen.getByLabelText('Name'), 'Snacks')
    await u.click(screen.getByRole('button', { name: 'Create category' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('archived category')
  })
})

describe('editing a category', () => {
  const withIcon = category('c4', 'Transport', { colour: '#3E63DD', icon: 'bus' })

  it('changes name and colour only, sends the version it saw, and keeps the stored icon', async () => {
    const { sent } = fakeApi([withIcon], (call) =>
      call.method === 'PUT' && call.path === '/categories/c4' ? json({ ...withIcon, name: 'Travel', version: 4 }) : undefined,
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Transport' }))

    expect(screen.getByLabelText('Name')).toHaveValue('Transport')
    expect(screen.getByRole('radio', { name: 'Blue' })).toBeChecked()
    expect(screen.queryByLabelText('Type')).not.toBeInTheDocument()
    expect(screen.getByText(/Expense category · top level/)).toBeInTheDocument()

    await u.clear(screen.getByLabelText('Name'))
    await u.type(screen.getByLabelText('Name'), 'Travel')
    await u.click(screen.getByRole('radio', { name: 'No colour' }))
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(sent('PUT', '/categories/c4')).toHaveLength(1))
    expect(sent('PUT', '/categories/c4')[0]!.body).toEqual({ name: 'Travel', colour: null, icon: 'bus', version: 3 })
  })

  it('on a stale version, offers to load the latest and saves against the new version', async () => {
    const list = [food]
    let puts = 0
    const { sent } = fakeApi(list, (call) => {
      if (call.method === 'PUT' && call.path === '/categories/c1') {
        puts += 1
        if (puts === 1) {
          list[0] = category('c1', 'Food and drink', { version: 5 }) // someone else saved first
          return json({ title: 'Conflict', detail: 'This record was changed by another request. Reload it and try again.' }, 409)
        }
        return json(list[0])
      }
      return undefined
    })
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Food' }))
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('button', { name: 'Load latest' })).toBeInTheDocument()
    await u.click(screen.getByRole('button', { name: 'Load latest' }))
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Food and drink'))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    await u.click(screen.getByRole('button', { name: 'Save changes' }))
    await waitFor(() => expect(sent('PUT', '/categories/c1')).toHaveLength(2))
    expect(sent('PUT', '/categories/c1')[1]!.body).toMatchObject({ name: 'Food and drink', version: 5 })
  })

  it('on a duplicate name, keeps what was typed and does not offer to reload', async () => {
    const { sent } = fakeApi([food, transport], (call) =>
      call.method === 'PUT' && call.path === '/categories/c1'
        ? json({ title: 'Conflict', detail: "You already have a expense category named 'Transport' here." }, 409)
        : undefined,
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Edit Food' }))
    await u.clear(screen.getByLabelText('Name'))
    await u.type(screen.getByLabelText('Name'), 'Transport')
    await u.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent("category named 'Transport'")
    // The version did not move, so this is a duplicate, not a stale edit.
    await waitFor(() => expect(sent('GET', '/categories/c1')).toHaveLength(1))
    expect(screen.queryByRole('button', { name: 'Load latest' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('Transport')
  })
})

describe('archiving a category', () => {
  it('warns that subcategories are archived too, and sends nothing when cancelled', async () => {
    const { sent } = fakeApi([food, groceries, dining])
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Archive Food' }))
    const dialog = screen.getByRole('alertdialog')
    expect(within(dialog).getByText(/also archives its 2 subcategories/)).toBeInTheDocument()
    await u.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(sent('POST', '/categories/c1/archive')).toHaveLength(0)
  })

  it('does not mention subcategories for a category without any', async () => {
    fakeApi([transport])
    renderApp('/categories')
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Archive Transport' }))
    expect(within(screen.getByRole('alertdialog')).queryByText(/subcategor/)).not.toBeInTheDocument()
  })

  it('archives after confirmation', async () => {
    const { sent } = fakeApi([transport], (call) =>
      call.method === 'POST' && call.path === '/categories/c4/archive' ? json({ ...transport, isArchived: true }) : undefined,
    )
    renderApp('/categories')
    const u = userEvent.setup()
    await u.click(await screen.findByRole('button', { name: 'Archive Transport' }))
    await u.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Archive' }))

    await waitFor(() => expect(sent('POST', '/categories/c4/archive')).toHaveLength(1))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument())
  })
})
