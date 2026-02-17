import { withStore, getByKey, openDb } from '../utils/database'
import type { SyncMeta } from '../types'

const storeName = 'sync_meta' as const

async function getLastCursor(): Promise<number> {
  const record = await getByKey<SyncMeta>(storeName, 'last_cursor')
  if (!record || record.value === undefined || record.value === null) {
    return 0
  }
  const parsed = Number(record.value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function setLastCursor(value: number): Promise<void> {
  await withStore(storeName, 'readwrite', store =>
    store.put({ key: 'last_cursor', value: String(value) })
  )
}

async function get(key: string): Promise<string | null> {
  const record = await getByKey<SyncMeta>(storeName, key)
  return record?.value ?? null
}

async function set(key: string, value: string): Promise<void> {
  await withStore(storeName, 'readwrite', store =>
    store.put({ key, value })
  )
}

async function deleteEntry(key: string): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.delete(key))
}

async function clear(): Promise<void> {
  await withStore(storeName, 'readwrite', store => store.clear())
}

async function getAll(): Promise<SyncMeta[]> {
  const db = await openDb()
  const tx = db.transaction(storeName, 'readonly')
  const request = tx.objectStore(storeName).getAll()
  return new Promise<SyncMeta[]>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export const syncMetaRepository = {
  getLastCursor,
  setLastCursor,
  get,
  set,
  delete: deleteEntry,
  clear,
  getAll,
}
