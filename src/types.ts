export type EntryType = "EXPENSE" | "INCOME";

export interface User {
  id: string;
  email: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  sortOrder: number;
  version: number;
  is_deleted: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  note: string;
  date: number;
  version: number;
  is_deleted: number;
}

export interface Budget {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  goal: number;
  month_key: string;
  category_ids: string;
  version: number;
  is_deleted: number;
}

export interface RecurringTransaction {
  id: string;
  user_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  note: string;
  recurrence_type: "MONTHLY" | "WEEKLY";
  recurrence_day: number;
  is_active: number;
  last_executed_at?: string | null;
  version: number;
  is_deleted: number;
}

export interface RecurringBudget {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  goal: number;
  category_ids: string;
  is_active: number;
  recurrence_type: string;
  recurrence_day: number;
  last_executed_at?: string | null;
  version: number;
  is_deleted: number;
}

export interface UserShare {
  id: string;
  sender_id: string;
  sender_email: string;
  receiver_id: string;
  receiver_email: string;
  status: "PENDING" | "ACTIVE";
  version: number;
  is_deleted: number;
}

export interface SyncQueueItem {
  mutation_id: string;
  entity_type: "CAT" | "TXN" | "SHR" | "BGT" | "RTXN" | "RBGT";
  entity_id: string;
  action: "PUT" | "DELETE" | "POST";
  payload: string | null;
  base_version: number;
  snapshot_before: string | null;
  created_at: number;
}

export interface SyncMeta {
  key: string;
  value: string;
}

export interface PushCommand {
  mutation_id: string;
  entity_type: "CAT" | "TXN" | "SHR" | "BGT" | "RTXN" | "RBGT";
  entity_id: string;
  action: "PUT" | "DELETE" | "POST";
  base_version: number;
  payload:
    | CategoryPayload
    | TransactionPayload
    | UserSharePayload
    | BudgetPayload
    | RecurringTransactionPayload
    | RecurringBudgetPayload
    | null;
}

export interface PushResult {
  mutation_id: string;
  status: "OK" | "ERROR" | "SKIPPED";
  version?: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

export interface PullEvent {
  entity_id: string;
  entity_type: "CAT" | "TXN" | "SHR" | "BGT" | "RTXN" | "RBGT";
  action: "PUT" | "DELETE";
  version: number;
  payload: string | null;
}

export interface SyncRequest {
  last_cursor: number;
  push_commands: PushCommand[];
  user?: User | null;
}

export interface SyncResponse {
  new_cursor: number;
  push_results: PushResult[];
  pull_events: PullEvent[];
  user: User;
}

export interface CategoryPayload {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  sort_order: number;
}

export interface TransactionPayload {
  id: string;
  user_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  note: string;
  date: number;
}

export interface UserSharePayload {
  id: string;
  sender_id: string;
  sender_email: string;
  receiver_id: string;
  receiver_email: string;
  status: "PENDING" | "ACTIVE";
}

export interface BudgetPayload {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  goal: number;
  month_key: string;
  category_ids: string;
}

export interface RecurringTransactionPayload {
  id: string;
  user_id: string;
  category_id: string;
  type: EntryType;
  amount: number;
  note: string;
  recurrence_type: "MONTHLY" | "WEEKLY";
  recurrence_day: number;
  is_active: number;
  last_executed_at?: string | null;
}

export interface RecurringBudgetPayload {
  id: string;
  user_id: string;
  name: string;
  type: EntryType;
  goal: number;
  category_ids: string;
  is_active: number;
  recurrence_type: string;
  recurrence_day: number;
  last_executed_at?: string | null;
}

// ── 帳戶管理（純前端，localStorage） ─────────────────────────

/** 轉帳類型：實體→實體、實體→邏輯、邏輯→實體 */
export type AccountTransferType =
  | "physical-physical"
  | "physical-logical"
  | "logical-physical";

export interface Account {
  id: string;
  name: string;
  /** 帳戶類型：physical = 實體帳戶（有固定金額），logical = 邏輯帳戶（依轉帳計算） */
  accountType: "physical" | "logical";
  /** 實體帳戶儲存金額；邏輯帳戶固定為 0 */
  amount: number;
  color: string;
  createdAt: number;
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: number; // Unix ms
  note: string;
  transferType: AccountTransferType;
  createdAt: number;
}

export interface LogEntry {
  id: string;
  time: string;
  level: "INFO" | "WARN" | "ERROR" | "SUCCESS";
  message: string;
  detail?: string;
  tone: "info" | "warn" | "error" | "success";
}

export type StoreName =
  | "categories"
  | "transactions"
  | "sync_queue"
  | "sync_meta"
  | "user"
  | "user_shares"
  | "budgets"
  | "recurring_transactions"
  | "recurring_budgets";
export type StoreMode = "readonly" | "readwrite";
export type StoreCallback<T = any> = (
  store: IDBObjectStore,
  tx: IDBTransaction,
) => T | IDBRequest<any>;
