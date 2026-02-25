import { withStore, getAll as getAllFromStore, openDb } from '../utils/database'
import type { UserShare } from '../types'

const storeName = 'user_shares' as const

async function getAll(): Promise<UserShare[]> {
  return getAllFromStore<UserShare>(storeName)
}

async function getById(id: string): Promise<UserShare | undefined> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).get(id)
    request.onsuccess = () => resolve(request.result as UserShare | undefined)
    request.onerror = () => reject(request.error)
  })
}

async function getPendingInvites(): Promise<UserShare[]> {
  const allShares = await getAll()
  return allShares.filter(share => share.status === 'PENDING' && share.is_deleted === 0)
}

async function getActiveShares(): Promise<UserShare[]> {
  const allShares = await getAll()
  return allShares.filter(share => share.status === 'ACTIVE' && share.is_deleted === 0)
}

async function upsert(userShare: UserShare): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.put(userShare))
}

async function upsertMany(userShares: UserShare[]): Promise<void> {
  await withStore(storeName, 'readwrite', store => {
    userShares.forEach(userShare => store.put(userShare))
  })
}

async function update(
  id: string,
  updater: (current: UserShare | undefined) => UserShare | null
): Promise<void> {
  return withStore(storeName, 'readwrite', (store) => {
    const request = store.get(id)
    request.onsuccess = () => {
      const current = request.result as UserShare | undefined
      const updated = updater(current)
      if (updated) {
        store.put(updated)
      }
    }
  })
}

async function deleteById(id: string): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.delete(id))
}

async function deleteAll(): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.clear())
}

async function count(): Promise<number> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  return new Promise((resolve, reject) => {
    const request = tx.objectStore(storeName).count()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const userShareRepository = {
  getAll,
  getById,
  getPendingInvites,
  getActiveShares,
  upsert,
  upsertMany,
  update,
  deleteById,
  deleteAll,
  count,
}
