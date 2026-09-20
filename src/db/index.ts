import Dexie from "dexie";
import type { AppDB } from "./tables";
import { schema } from "./tables";

export const db = new Dexie("sync-ui") as Dexie & AppDB;

db.version(1).stores({
  user: "id",
  categories: "id",
  transactions: "id",
  budgets: "id",
  sync_queue: "mutation_id, created_at, entity_id",
  sync_meta: "key",
  user_shares: "id",
});

db.version(2).stores({
  user: "id",
  categories: "id",
  transactions: "id",
  budgets: "id",
  recurring_transactions: "id",
  recurring_budgets: "id",
  sync_queue: "mutation_id, created_at, entity_id",
  sync_meta: "key",
  user_shares: "id",
});

// version 3：新增 assets 資料表。
// 注意：`schema`（tables.ts）已含 assets，所以這裡不能直接沿用同一個物件
// 給更早的 version 用，否則 Dexie 會誤以為 assets 早就存在於舊 version，
// 導致既有使用者的瀏覽器永遠不會真的建立 assets 這個 object store。
db.version(3).stores(schema);
