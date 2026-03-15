import { db } from "../index";
import type { Budget } from "../../types";

async function getAll(): Promise<Budget[]> {
  return db.budgets.toArray();
}

async function getById(id: string): Promise<Budget | undefined> {
  return db.budgets.get(id);
}

async function upsert(budget: Budget): Promise<void> {
  await db.budgets.put(budget);
}

async function update(
  id: string,
  updater: (current: Budget | undefined) => Budget | null,
): Promise<void> {
  await db.transaction("rw", db.budgets, async () => {
    const current = await db.budgets.get(id);
    const updated = updater(current);
    if (updated) await db.budgets.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.budgets.clear();
}

export const budgetRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
