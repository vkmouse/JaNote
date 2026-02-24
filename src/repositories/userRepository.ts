import { withStore, openDb } from '../utils/database'
import type { User } from '../types'

const storeName = 'user' as const

async function get(): Promise<User | null> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const request = tx.objectStore(storeName).getAll()
  
  return new Promise<User | null>((resolve, reject) => {
    request.onsuccess = () => {
      const results = request.result as User[]
      const user = results && results.length > 0 ? results[0] : null
      resolve(user ?? null)
    }
    request.onerror = () => reject(request.error)
  })
}

async function set(user: User): Promise<void> {
  await clear()
  await withStore(storeName, 'readwrite', store =>
    store.put(user)
  )
}

async function clear(): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.clear())
}

export const userRepository = {
  get,
  set,
  clear,
}
