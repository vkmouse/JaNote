import type { RecurringBudget } from "../types";

export async function getRecurringBudgetVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM recurring_budgets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getRecurringBudgetById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<RecurringBudget | null> {
  return await DB.prepare(
    "SELECT * FROM recurring_budgets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<RecurringBudget>();
}

export async function createRecurringBudget(
  id: string,
  userId: string,
  name: string,
  type: string,
  goal: number,
  categoryIds: string,
  isActive: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    `INSERT INTO recurring_budgets
      (id, user_id, name, type, goal, category_ids, is_active, version, is_deleted)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)`,
  )
    .bind(id, userId, name, type, goal, categoryIds, isActive, version)
    .run();
}

export async function updateRecurringBudget(
  id: string,
  userId: string,
  name: string,
  type: string,
  goal: number,
  categoryIds: string,
  isActive: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    `UPDATE recurring_budgets
     SET name = ?, type = ?, goal = ?, category_ids = ?, is_active = ?, version = ?, is_deleted = 0
     WHERE id = ? AND user_id = ?`,
  )
    .bind(name, type, goal, categoryIds, isActive, version, id, userId)
    .run();
}

export async function deleteRecurringBudget(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE recurring_budgets SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function dropRecurringBudgetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS recurring_budgets`).run();
}

export async function createRecurringBudgetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS recurring_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      goal REAL NOT NULL,
      category_ids TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
