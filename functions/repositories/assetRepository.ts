import type { Asset } from "../types";

export async function getAssetVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM assets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getAssetById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<Asset | null> {
  return await DB.prepare(
    "SELECT * FROM assets WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<Asset>();
}

export async function createAsset(
  id: string,
  userId: string,
  categoryId: string,
  name: string,
  amount: number,
  date: number,
  createdAt: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO assets (id, user_id, category_id, name, amount, date, created_at, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, categoryId, name, amount, date, createdAt, version)
    .run();
}

export async function updateAsset(
  id: string,
  userId: string,
  categoryId: string,
  name: string,
  amount: number,
  date: number,
  createdAt: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE assets SET category_id = ?, name = ?, amount = ?, date = ?, created_at = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?",
  )
    .bind(categoryId, name, amount, date, createdAt, version, id, userId)
    .run();
}

export async function deleteAsset(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE assets SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function dropAssetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS assets`).run();
}

export async function createAssetsTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS assets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      name TEXT NOT NULL,
      amount REAL NOT NULL,
      date BIGINT NOT NULL,
      created_at BIGINT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
