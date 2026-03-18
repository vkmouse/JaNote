import type { EntityTable } from "dexie";
import type {
  User,
  Category,
  Transaction,
  Budget,
  RecurringTransaction,
  RecurringBudget,
  SyncQueueItem,
  SyncMeta,
  UserShare,
} from "../types";

/** Dexie 資料表型別定義 */
export interface AppDB {
  user: EntityTable<User, "id">;
  categories: EntityTable<Category, "id">;
  transactions: EntityTable<Transaction, "id">;
  budgets: EntityTable<Budget, "id">;
  recurring_transactions: EntityTable<RecurringTransaction, "id">;
  recurring_budgets: EntityTable<RecurringBudget, "id">;
  sync_queue: EntityTable<SyncQueueItem, "mutation_id">;
  sync_meta: EntityTable<SyncMeta, "key">;
  user_shares: EntityTable<UserShare, "id">;
}

/** 各資料表的 Dexie schema 字串（索引定義） */
export const schema = {
  user: "id",
  categories: "id",
  transactions: "id",
  budgets: "id",
  recurring_transactions: "id",
  recurring_budgets: "id",
  sync_queue: "mutation_id, created_at, entity_id",
  sync_meta: "key",
  user_shares: "id",
} satisfies Record<keyof AppDB, string>;
