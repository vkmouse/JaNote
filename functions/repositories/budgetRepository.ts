import type { Budget } from "../types";

export async function getBudgetVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM budgets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getBudgetById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<Budget | null> {
  return await DB.prepare(
    "SELECT * FROM budgets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<Budget>();
}

export async function createBudget(
  id: string,
  userId: string,
  name: string,
  type: string,
  goal: number,
  monthKey: string,
  categoryIds: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO budgets (id, user_id, name, type, goal, month_key, category_ids, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, name, type, goal, monthKey, categoryIds, version)
    .run();
}

export async function updateBudget(
  id: string,
  userId: string,
  name: string,
  type: string,
  goal: number,
  monthKey: string,
  categoryIds: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE budgets SET name = ?, type = ?, goal = ?, month_key = ?, category_ids = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?",
  )
    .bind(name, type, goal, monthKey, categoryIds, version, id, userId)
    .run();
}

export async function deleteBudget(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE budgets SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function dropBudgetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS budgets`).run();
}

export async function createBudgetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      goal REAL NOT NULL,
      month_key TEXT NOT NULL,
      category_ids TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
