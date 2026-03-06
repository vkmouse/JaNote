import { db } from "../index";
import type { Category } from "../../types";

async function getAll(): Promise<Category[]> {
  return db.categories.toArray();
}

async function getById(id: string): Promise<Category | undefined> {
  return db.categories.get(id);
}

async function upsert(category: Category): Promise<void> {
  await db.categories.put(category);
}

async function update(
  id: string,
  updater: (current: Category | undefined) => Category | null,
): Promise<void> {
  await db.transaction("rw", db.categories, async () => {
    const current = await db.categories.get(id);
    const updated = updater(current);
    if (updated) await db.categories.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.categories.clear();
}

export const categoryRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
