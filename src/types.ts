export type EntryType = 'EXPENSE' | 'INCOME'

export interface User {
  id: string
  email: string
}

export interface Category {
  id: string
  user_id: string
  name: string
  type: EntryType
  version: number
  is_deleted: number
}

export interface Transaction {
  id: string
  user_id: string
  category_id: string
  type: EntryType
  amount: number
  note: string
  date: number
  version: number
  is_deleted: number
}

export interface UserShare {
  id: string
  owner_id: string
  owner_email: string
  viewer_id: string
  viewer_email: string
  status: 'PENDING' | 'ACTIVE'
  version: number
  is_deleted: number
}

export interface SyncQueueItem {
  mutation_id: string
  entity_type: 'CAT' | 'TXN' | 'SHR'
  entity_id: string
  action: 'PUT' | 'DELETE' | 'POST'
  payload: string | null
  base_version: number
  snapshot_before: string | null
  created_at: number
}

export interface SyncMeta {
  key: string
  value: string
}

export interface PushCommand {
  mutation_id: string
  entity_type: 'CAT' | 'TXN' | 'SHR'
  entity_id: string
  action: 'PUT' | 'DELETE' | 'POST'
  base_version: number
  payload: CategoryPayload | TransactionPayload | UserSharePayload | null
}

export interface PushResult {
  mutation_id: string
  status: 'OK' | 'ERROR' | 'SKIPPED'
  version?: number | null
  error_code?: string | null
  error_message?: string | null
}

export interface PullEvent {
  entity_id: string
  entity_type: 'CAT' | 'TXN' | 'SHR'
  action: 'PUT' | 'DELETE'
  version: number
  payload: string | null
}

export interface SyncRequest {
  last_cursor: number
  push_commands: PushCommand[]
  user?: User | null
}

export interface SyncResponse {
  new_cursor: number
  push_results: PushResult[]
  pull_events: PullEvent[]
  user: User
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

export interface UserSharePayload {
  id: string
  owner_id: string
  owner_email: string
  viewer_id: string
  viewer_email: string
  status: 'PENDING' | 'ACTIVE'
}

export interface LogEntry {
  id: string
  time: string
  level: 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS'
  message: string
  detail?: string
  tone: 'info' | 'warn' | 'error' | 'success'
}

export type StoreName = 'categories' | 'transactions' | 'sync_queue' | 'sync_meta' | 'user' | 'user_shares'
export type StoreMode = 'readonly' | 'readwrite'
export type StoreCallback<T = any> = (store: IDBObjectStore, tx: IDBTransaction) => T | IDBRequest<any>
