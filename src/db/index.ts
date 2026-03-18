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

db.version(2).stores(schema);
