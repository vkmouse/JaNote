import { db } from "../index";
import type { AssetRecord } from "../../types";

async function getAll(): Promise<AssetRecord[]> {
  return db.assets.toArray();
}

async function getById(id: string): Promise<AssetRecord | undefined> {
  return db.assets.get(id);
}

async function upsert(asset: AssetRecord): Promise<void> {
  await db.assets.put(asset);
}

async function update(
  id: string,
  updater: (current: AssetRecord | undefined) => AssetRecord | null,
): Promise<void> {
  await db.transaction("rw", db.assets, async () => {
    const current = await db.assets.get(id);
    const updated = updater(current);
    if (updated) await db.assets.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.assets.clear();
}

export const assetRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
