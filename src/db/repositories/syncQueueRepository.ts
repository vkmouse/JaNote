import { db } from "../index";
import type { SyncQueueItem } from "../../types";

async function add(item: SyncQueueItem): Promise<void> {
  await db.sync_queue.put(item);
}

async function getAllOrdered(): Promise<SyncQueueItem[]> {
  return db.sync_queue.orderBy("created_at").toArray();
}

async function removeByMutationIds(ids: string[]): Promise<void> {
  if (!ids.length) return;
  await db.sync_queue.bulkDelete(ids);
}

async function removeByEntityId(entityId: string): Promise<void> {
  await db.sync_queue.where("entity_id").equals(entityId).delete();
}

async function clear(): Promise<void> {
  await db.sync_queue.clear();
}

export const syncQueueRepository = {
  add,
  getAllOrdered,
  removeByMutationIds,
  removeByEntityId,
  clear,
};
