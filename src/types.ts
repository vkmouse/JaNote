export type EntryType = 'EXPENSE' | 'INCOME'

export interface Category {
  id: string
  name: string
  type: EntryType
  version: number
  is_deleted: number
}

export interface Transaction {
  id: string
  category_id: string
  type: EntryType
  amount: number
  note: string
  date: number
  version: number
  is_deleted: number
}

export interface SyncQueueItem {
  mutation_id: string
  entity_type: 'CAT' | 'TXN'
  entity_id: string
  payload: string | null
  base_version: number
  created_at: number
}

export interface SyncMeta {
  key: string
  value: string
}

export interface PushEvent {
  mutation_id: string
  entity_type: 'CAT' | 'TXN'
  entity_id: string
  action: 'PUT' | 'DELETE'
  base_version: number
  payload: CategoryPayload | TransactionPayload | null
}

export interface PullEvent {
  entity_id: string
  entity_type: 'CAT' | 'TXN'
  action: 'PUT' | 'DELETE'
  version: number
  payload: string | null
}

export interface SyncRequest {
  user_id: string
  last_cursor: number
  push_events: PushEvent[]
}

export interface SyncResponse {
  new_cursor: number
  processed_mutation_ids: string[]
  pull_events: PullEvent[]
}

export interface CategoryPayload {
  id: string
  user_id: string
  name: string
  type: EntryType
}

export interface TransactionPayload {
  id: string
  user_id: string
  category_id: string
  type: EntryType
  amount: number
  note: string
  date: number
}

export interface LogEntry {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message: string
  detail?: string
  tone: 'info' | 'warn' | 'error' | 'success'
}

export type StoreName = 'categories' | 'transactions' | 'sync_queue' | 'sync_meta'
export type StoreMode = 'readonly' | 'readwrite'
export type StoreCallback<T = any> = (store: IDBObjectStore, tx: IDBTransaction) => T | IDBRequest<any>
