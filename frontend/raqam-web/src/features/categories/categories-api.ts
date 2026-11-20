import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api/client'

export const categoryTypes = ['Expense', 'Income'] as const
export type CategoryType = (typeof categoryTypes)[number]

export const categoryTypeLabels: Record<CategoryType, string> = {
  Expense: 'Expense',
  Income: 'Income',
}

export const CATEGORY_NAME_MAX = 100

/** The swatches offered for a category. Mid-tones that read on both the light and dark surfaces. */
export const categoryColours = [
  { name: 'Red', value: '#E5484D' },
  { name: 'Orange', value: '#F76B15' },
  { name: 'Amber', value: '#E3A52B' },
  { name: 'Green', value: '#30A46C' },
  { name: 'Teal', value: '#12A594' },
  { name: 'Blue', value: '#3E63DD' },
  { name: 'Violet', value: '#8E4EC6' },
  { name: 'Pink', value: '#D6409F' },
  { name: 'Grey', value: '#6B7280' },
] as const

export interface Category {
  id: string
  name: string
  type: CategoryType
  /** Null for a top-level category; a subcategory has a top-level parent, never deeper. */
  parentCategoryId: string | null
  colour: string | null
  icon: string | null
  isArchived: boolean
  createdAtUtc: string
  updatedAtUtc: string
  /** Echoed back on edit; a stale one is rejected with 409. */
  version: number
}

/** Type and parent are fixed once a category exists (D028), so they are only sent on create. */
export interface CreateCategoryInput {
  name: string
  type: CategoryType
  parentCategoryId: string | null
  colour: string | null
  icon: string | null
}

export interface UpdateCategoryInput {
  name: string
  colour: string | null
  icon: string | null
}

export const categoryKeys = {
  all: ['categories'] as const,
  list: (includeArchived: boolean) => ['categories', 'list', includeArchived] as const,
}

export const categoriesApi = {
  list: (includeArchived: boolean) =>
    api.get<Category[]>('/categories', { includeArchived: includeArchived || undefined }),
  get: (id: string) => api.get<Category>(`/categories/${id}`),
  create: (input: CreateCategoryInput) => api.post<Category>('/categories', input),
  update: (id: string, input: UpdateCategoryInput, version: number) =>
    api.put<Category>(`/categories/${id}`, { ...input, version }),
  archive: (id: string) => api.post<Category>(`/categories/${id}/archive`),
}

export function useCategories(includeArchived: boolean) {
  return useQuery({ queryKey: categoryKeys.list(includeArchived), queryFn: () => categoriesApi.list(includeArchived) })
}

/** Archiving a parent archives its subcategories too, so every list is refetched. */
function useRefreshCategories() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: categoryKeys.all })
}

export function useCreateCategory() {
  const refresh = useRefreshCategories()
  return useMutation({ mutationFn: categoriesApi.create, onSuccess: refresh })
}

export function useUpdateCategory(id: string) {
  const refresh = useRefreshCategories()
  return useMutation({
    mutationFn: ({ input, version }: { input: UpdateCategoryInput; version: number }) =>
      categoriesApi.update(id, input, version),
    onSuccess: refresh,
  })
}

export function useArchiveCategory() {
  const refresh = useRefreshCategories()
  return useMutation({ mutationFn: categoriesApi.archive, onSuccess: refresh })
}
