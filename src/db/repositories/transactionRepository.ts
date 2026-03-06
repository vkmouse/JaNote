import { db } from "../index";
import type { Transaction } from "../../types";

async function getAll(): Promise<Transaction[]> {
  return db.transactions.toArray();
}

async function getById(id: string): Promise<Transaction | undefined> {
  return db.transactions.get(id);
}

async function upsert(transaction: Transaction): Promise<void> {
  await db.transactions.put(transaction);
}

async function update(
  id: string,
  updater: (current: Transaction | undefined) => Transaction | null,
): Promise<void> {
  await db.transaction("rw", db.transactions, async () => {
    const current = await db.transactions.get(id);
    const updated = updater(current);
    if (updated) await db.transactions.put(updated);
  });
}

async function deleteAll(): Promise<void> {
  await db.transactions.clear();
}

export const transactionRepository = {
  getAll,
  getById,
  upsert,
  update,
  deleteAll,
};
