import { db } from "../index";
import type { RecurringTransaction } from "../../types";

async function getAll(): Promise<RecurringTransaction[]> {
  return db.recurring_transactions.toArray();
}

async function getById(id: string): Promise<RecurringTransaction | undefined> {
  return db.recurring_transactions.get(id);
}

async function upsert(item: RecurringTransaction): Promise<void> {
  await db.recurring_transactions.put(item);
}

async function update(
  id: string,
  updater: (current: RecurringTransaction | undefined) => RecurringTransaction | null,
): Promise<void> {
  await db.transaction("rw", db.recurring_transactions, async () => {
    const current = await db.recurring_transactions.get(id);
    const updated = updater(current);
    if (updated) await db.recurring_transactions.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.recurring_transactions.clear();
}

export const recurringTransactionRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
