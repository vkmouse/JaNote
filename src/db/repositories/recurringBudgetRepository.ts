import { db } from "../index";
import type { RecurringBudget } from "../../types";

async function getAll(): Promise<RecurringBudget[]> {
  return db.recurring_budgets.toArray();
}

async function getById(id: string): Promise<RecurringBudget | undefined> {
  return db.recurring_budgets.get(id);
}

async function upsert(item: RecurringBudget): Promise<void> {
  await db.recurring_budgets.put(item);
}

async function update(
  id: string,
  updater: (current: RecurringBudget | undefined) => RecurringBudget | null,
): Promise<void> {
  await db.transaction("rw", db.recurring_budgets, async () => {
    const current = await db.recurring_budgets.get(id);
    const updated = updater(current);
    if (updated) await db.recurring_budgets.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.recurring_budgets.clear();
}

export const recurringBudgetRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
