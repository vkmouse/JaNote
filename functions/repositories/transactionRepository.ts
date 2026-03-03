import type { Transaction } from "../types";

export async function getTransactionVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM transactions WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getTransactionById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<Transaction | null> {
  return await DB.prepare(
    "SELECT * FROM transactions WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<Transaction>();
}

export async function createTransaction(
  id: string,
  userId: string,
  categoryId: string,
  type: string,
  amount: number,
  note: string | null,
  date: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO transactions (id, user_id, category_id, type, amount, note, date, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, categoryId, type, amount, note, date, version)
    .run();
}

export async function updateTransaction(
  id: string,
  userId: string,
  categoryId: string,
  type: string,
  amount: number,
  note: string | null,
  date: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE transactions SET category_id = ?, type = ?, amount = ?, note = ?, date = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?",
  )
    .bind(categoryId, type, amount, note, date, version, id, userId)
    .run();
}

export async function deleteTransaction(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE transactions SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function dropTransactionsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS transactions`).run();
}

export async function createTransactionsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      date BIGINT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
