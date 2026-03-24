import type { RecurringTransaction } from "../types";

export async function getRecurringTransactionVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM recurring_transactions WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getRecurringTransactionById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<RecurringTransaction | null> {
  return await DB.prepare(
    "SELECT * FROM recurring_transactions WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<RecurringTransaction>();
}

export async function createRecurringTransaction(
  id: string,
  userId: string,
  categoryId: string,
  type: string,
  amount: number,
  note: string | null,
  recurrenceType: string,
  recurrenceDay: number,
  isActive: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    `INSERT INTO recurring_transactions
      (id, user_id, category_id, type, amount, note, recurrence_type, recurrence_day, is_active, version, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(id, userId, categoryId, type, amount, note, recurrenceType, recurrenceDay, isActive, version)
    .run();
}

export async function updateRecurringTransaction(
  id: string,
  userId: string,
  categoryId: string,
  type: string,
  amount: number,
  note: string | null,
  recurrenceType: string,
  recurrenceDay: number,
  isActive: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    `UPDATE recurring_transactions
     SET category_id = ?, type = ?, amount = ?, note = ?, recurrence_type = ?, recurrence_day = ?, is_active = ?, version = ?, is_deleted = 0
     WHERE id = ? AND user_id = ?`,
  )
    .bind(categoryId, type, amount, note, recurrenceType, recurrenceDay, isActive, version, id, userId)
    .run();
}

export async function deleteRecurringTransaction(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE recurring_transactions SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function dropRecurringTransactionsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS recurring_transactions`).run();
}

export async function getActiveRecurringTransactionsByUserId(
  userId: string,
  DB: D1Database,
): Promise<RecurringTransaction[]> {
  const results = await DB.prepare(
    "SELECT * FROM recurring_transactions WHERE user_id = ? AND is_active = 1 AND is_deleted = 0",
  )
    .bind(userId)
    .all<RecurringTransaction>();
  return results.results || [];
}

export async function updateLastExecutedAt(
  id: string,
  userId: string,
  date: string,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE recurring_transactions SET last_executed_at = ? WHERE id = ? AND user_id = ?",
  )
    .bind(date, id, userId)
    .run();
}

export async function createRecurringTransactionsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS recurring_transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      note TEXT,
      recurrence_type TEXT NOT NULL,
      recurrence_day INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      last_executed_at TEXT,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
