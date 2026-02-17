import { withStore, getAll, openDb } from '../utils/database'
import type { Category } from '../types'

const storeName = 'categories' as const

async function getAllCategories(): Promise<Category[]> {
  return getAll<Category>(storeName)
}

async function getCategoryById(id: string): Promise<Category | undefined> {
  const categories = await getAllCategories()
  return categories.find(cat => cat.id === id)
}

async function upsert(category: Category): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.put(category))
}

async function upsertMany(categories: Category[]): Promise<void> {
  await withStore(storeName, 'readwrite', store => {
    categories.forEach(category => store.put(category))
  })
}

async function update(
  id: string,
  updater: (current: Category | undefined) => Category | null
): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result as Category | undefined
      const updated = updater(current)
      if (updated) {
        store.put(updated)
      }
    }
  })
}

async function deleteCategory(id: string): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.delete(id))
}

async function deleteAllCategories(): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.clear())
}

async function count(): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const request = tx.objectStore(storeName).count()
  return new Promise<number>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const categoryRepository = {
  getAll: getAllCategories,
  getById: getCategoryById,
  upsert,
  upsertMany,
  update,
  delete: deleteCategory,
  deleteAll: deleteAllCategories,
  count,
}
