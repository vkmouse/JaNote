import type { Category } from "../types";

/**
 * 支出分類的預設順序（sort_order = 索引 + 1）。
 * 新使用者初始化與資料庫更新的順序校正都以這份為準，避免兩邊順序不一致。
 */
export const DEFAULT_EXPENSE_CATEGORY_NAMES = [
  "早餐",
  "午餐",
  "晚餐",
  "飲食",
  "飲品",
  "點心",
  "酒類",
  "交通",
  "購物",
  "娛樂",
  "日用品",
  "房租",
  "運動",
  "醫療",
  "社交",
  "禮物",
  "數位",
  "貓咪",
  "旅行",
  "保險",
  "其他",
];

/**
 * 資產分類的預設清單（type = "ASSET"）。
 * sort_order 從 201 開始，避開 EXPENSE（1~N）與 INCOME（101+）的區段。
 */
export const DEFAULT_ASSET_CATEGORY_NAMES = [
  "國內證券",
  "海外證券",
  "基金",
  "約當現金",
  "信託",
];

/** 資產分類 sort_order 的起始值（第 i 個預設分類 = 起始值 + i） */
export const ASSET_CATEGORY_SORT_ORDER_START = 201;

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

/** 取得使用者未刪除的支出分類（依 sort_order 排序） */
export async function getActiveExpenseCategories(
  userId: string,
  DB: D1Database,
): Promise<Pick<Category, "id" | "name">[]> {
  const result = await DB.prepare(
    "SELECT id, name FROM categories WHERE user_id = ? AND type = 'EXPENSE' AND is_deleted = 0 ORDER BY sort_order",
  )
    .bind(userId)
    .all<Pick<Category, "id" | "name">>();
  return result.results || [];
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
  sort_order: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "INSERT INTO categories (id, user_id, name, type, sort_order, version, is_deleted) VALUES (?, ?, ?, ?, ?, ?, 0)",
  )
    .bind(id, userId, name, type, sort_order, version)
    .run();
}

export async function updateCategory(
  id: string,
  userId: string,
  name: string,
  type: string,
  sort_order: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE categories SET name = ?, type = ?, sort_order = ?, version = ?, is_deleted = 0 WHERE id = ? AND user_id = ?",
  )
    .bind(name, type, sort_order, version, id, userId)
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
  const expenseCategories = DEFAULT_EXPENSE_CATEGORY_NAMES;
  const incomeCategories = ["薪水", "獎金", "交易", "投資", "股息", "利息", "分潤", "其他"];

  // Import syncEventRepository to avoid circular dependency
  const { insertSyncEvent } = await import("./syncEventRepository");

  for (let i = 0; i < expenseCategories.length; i++) {
    const name = expenseCategories[i];
    const sort_order = i + 1;
    const id = crypto.randomUUID();
    await createCategory(id, userId, name, "EXPENSE", sort_order, 1, DB);

    const payload = JSON.stringify({
      action: "POST",
      version: 1,
      payload: JSON.stringify({
        id,
        user_id: userId,
        name,
        type: "EXPENSE",
        sort_order,
      }),
    });

    await insertSyncEvent(userId, crypto.randomUUID(), "CAT", id, payload, DB);
  }

  for (let i = 0; i < incomeCategories.length; i++) {
    const name = incomeCategories[i];
    const sort_order = 101 + i;
    const id = crypto.randomUUID();
    await createCategory(id, userId, name, "INCOME", sort_order, 1, DB);

    const payload = JSON.stringify({
      action: "POST",
      version: 1,
      payload: JSON.stringify({
        id,
        user_id: userId,
        name,
        type: "INCOME",
        sort_order,
      }),
    });

    await insertSyncEvent(userId, crypto.randomUUID(), "CAT", id, payload, DB);
  }

  const assetCategories = DEFAULT_ASSET_CATEGORY_NAMES;
  for (let i = 0; i < assetCategories.length; i++) {
    const name = assetCategories[i];
    const sort_order = ASSET_CATEGORY_SORT_ORDER_START + i;
    const id = crypto.randomUUID();
    await createCategory(id, userId, name, "ASSET", sort_order, 1, DB);

    const payload = JSON.stringify({
      action: "POST",
      version: 1,
      payload: JSON.stringify({
        id,
        user_id: userId,
        name,
        type: "ASSET",
        sort_order,
      }),
    });

    await insertSyncEvent(userId, crypto.randomUUID(), "CAT", id, payload, DB);
  }
}

/**
 * 檢查使用者是否已擁有同名同類型的分類（不論是否已刪除）。
 * 用來讓「補齊分類」這類批次腳本具備冪等性：已存在就跳過，不重複建立。
 */
export async function categoryExistsByName(
  userId: string,
  name: string,
  type: string,
  DB: D1Database,
): Promise<boolean> {
  const row = await DB.prepare(
    "SELECT 1 FROM categories WHERE user_id = ? AND name = ? AND type = ? LIMIT 1",
  )
    .bind(userId, name, type)
    .first();
  return !!row;
}

/**
 * 取得使用者在某個類型下，下一個可用的 sort_order（目前最大值 + 1）。
 * 用於在既有分類清單「後面」補插新分類，不會覆蓋或打亂原本的排序。
 */
export async function getNextCategorySortOrder(
  userId: string,
  type: string,
  DB: D1Database,
): Promise<number> {
  const row = await DB.prepare(
    "SELECT MAX(sort_order) as max_order FROM categories WHERE user_id = ? AND type = ?",
  )
    .bind(userId, type)
    .first<{ max_order: number | null }>();
  return (row?.max_order ?? 0) + 1;
}

/** 取得所有使用者未刪除的支出分類 */
export async function getAllActiveExpenseCategories(
  DB: D1Database,
): Promise<
  Pick<Category, "id" | "user_id" | "name" | "sort_order" | "version">[]
> {
  const result = await DB.prepare(
    "SELECT id, user_id, name, sort_order, version FROM categories WHERE type = 'EXPENSE' AND is_deleted = 0",
  ).all<
    Pick<Category, "id" | "user_id" | "name" | "sort_order" | "version">
  >();
  return result.results || [];
}

/**
 * 只更新排序與版本
 */
export async function updateCategorySortOrder(
  id: string,
  userId: string,
  sort_order: number,
  version: number,
  DB: D1Database,
): Promise<void> {
  await DB.prepare(
    "UPDATE categories SET sort_order = ?, version = ? WHERE id = ? AND user_id = ?",
  )
    .bind(sort_order, version, id, userId)
    .run();
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
      sort_order INTEGER NOT NULL DEFAULT 0,
      version INTEGER NOT NULL,
      is_deleted INTEGER NOT NULL DEFAULT 0
    )
  `,
  ).run();
}
