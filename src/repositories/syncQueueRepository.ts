import { withStore, openDb } from '../utils/database'
import type { SyncQueueItem } from '../types'

const storeName = 'sync_queue' as const

async function add(item: SyncQueueItem): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.put(item))
}

async function getAllOrdered(): Promise<SyncQueueItem[]> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const index = store.index('created_at')
  const results: SyncQueueItem[] = []

  return new Promise((resolve, reject) => {
    const request = index.openCursor()
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        results.push(cursor.value as SyncQueueItem)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}

async function getByEntityId(entityId: string): Promise<SyncQueueItem[]> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const store = tx.objectStore(storeName)
  const index = store.index('entity_id')
  const results: SyncQueueItem[] = []

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(entityId))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        results.push(cursor.value as SyncQueueItem)
        cursor.continue()
      } else {
        resolve(results)
      }
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}

async function getByMutationId(mutationId: string): Promise<SyncQueueItem | undefined> {
  return withStore(storeName, 'readonly', async (store) => {
    const request = store.get(mutationId)
    return new Promise<SyncQueueItem | undefined>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }) as Promise<SyncQueueItem | undefined>
}

async function removeByMutationIds(ids: string[]): Promise<void> {
  if (!ids.length) {
    return
  }
  return withStore(storeName, 'readwrite', (store) => {
    ids.forEach(id => store.delete(id))
  })
}

async function removeByEntityId(entityId: string): Promise<void> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readwrite')
  const store = tx.objectStore(storeName)
  const index = store.index('entity_id')

  return new Promise((resolve, reject) => {
    const request = index.openCursor(IDBKeyRange.only(entityId))
    request.onsuccess = () => {
      const cursor = request.result
      if (cursor) {
        cursor.delete()
        cursor.continue()
      } else {
        resolve()
      }
    }
    request.onerror = () => {
      reject(request.error)
    }
  })
}

async function clear(): Promise<void> {
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

export const syncQueueRepository = {
  add,
  getAllOrdered,
  getByEntityId,
  getByMutationId,
  removeByMutationIds,
  removeByEntityId,
  clear,
  count,
}
