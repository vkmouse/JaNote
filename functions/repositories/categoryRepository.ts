import type { Category } from "../types";

export async function getCategoryVersion(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT version FROM categories WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<{ version: number }>();
  return row?.version ?? 0;
}

export async function getCategoryById(
  id: string,
  userId: string,
  DB: D1Database,
): Promise<Category | null> {
  return await DB.prepare(
    "SELECT * FROM categories WHERE id = ? AND user_id = ?",
  )
    .bind(id, userId)
    .first<Category>();
}

export async function createCategory(
  id: string,
  userId: string,
  name: string,
  type: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO categories (id, user_id, name, type, version, is_deleted) VALUES (?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, name, type, version)
    .run();
}

export async function updateCategory(
  id: string,
  userId: string,
  name: string,
  type: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE categories SET name = ?, type = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?",
  )
    .bind(name, type, version, id, userId)
    .run();
}

export async function deleteCategory(
  id: string,
  userId: string,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE categories SET version = ?, is_deleted = 1 WHERE id = ? AND user_id = ?",
  )
    .bind(version, id, userId)
    .run();
}

export async function initializeDefaultCategories(
  userId: string,
  DB: D1Database,
): Promise<void> {
  const expenseCategories = [
    "早餐",
    "午餐",
    "晚餐",
    "飲品",
    "點心",
    "交通",
    "購物",
    "娛樂",
    "日用品",
    "房租",
    "醫療",
    "社交",
    "禮物",
    "數位",
    "其他",
    "貓咪",
    "旅行",
  ];
  const incomeCategories = ["薪水", "獎金", "利息", "股息", "投資", "其他"];

  // Import syncEventRepository to avoid circular dependency
  const { insertSyncEvent } = await import("./syncEventRepository");

  for (const name of expenseCategories) {
    const id = crypto.randomUUID();
    await createCategory(id, userId, name, "EXPENSE", 1, DB);

    const payload = JSON.stringify({
      action: "POST",
      version: 1,
      payload: JSON.stringify({ id, user_id: userId, name, type: "EXPENSE" }),
    });

    await insertSyncEvent(userId, crypto.randomUUID(), "CAT", id, payload, DB);
  }

  for (const name of incomeCategories) {
    const id = crypto.randomUUID();
    await createCategory(id, userId, name, "INCOME", 1, DB);

    const payload = JSON.stringify({
      action: "POST",
      version: 1,
      payload: JSON.stringify({ id, user_id: userId, name, type: "INCOME" }),
    });

    await insertSyncEvent(userId, crypto.randomUUID(), "CAT", id, payload, DB);
  }
}

export async function dropCategoriesTable(DB: D1Database): Promise<void> {
  await DB.prepare(`DROP TABLE IF EXISTS categories`).run();
}

export async function createCategoriesTable(DB: D1Database): Promise<void> {
  await DB.prepare(
    `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
