/**
 * 手動觸發資料庫更新。
 *
 * 所有更新步驟集中在 applyDatabaseUpdates，依序以 Step N 標示。
 * 每個 Step 都必須具備冪等性，讓整個更新可以重複執行。
 * 此路徑受 /api middleware 的登入驗證保護。
 */
import type { Env } from "../types";
import { getAllUsers } from "../repositories/userRepository";
import {
  DEFAULT_EXPENSE_CATEGORY_NAMES,
  DEFAULT_ASSET_CATEGORY_NAMES,
  ASSET_CATEGORY_SORT_ORDER_START,
  categoryExistsByName,
  createCategory,
  getAllActiveExpenseCategories,
  getNextCategorySortOrder,
  updateCategorySortOrder,
} from "../repositories/categoryRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";
import { createAssetsTable } from "../repositories/assetRepository";

const NEW_CATEGORIES: { name: string; type: "EXPENSE" | "INCOME" }[] = [
  { name: "保險", type: "EXPENSE" },
  { name: "運動", type: "EXPENSE" },
  { name: "飲食", type: "EXPENSE" },
];

interface DatabaseUpdateResult {
  total_users: number;
  added_count: number;
  skipped_count: number;
  reordered_count: number;
  order_skipped_count: number;
  asset_category_added_count: number;
  asset_category_skipped_count: number;
}

async function applyDatabaseUpdates(
  DB: D1Database,
): Promise<DatabaseUpdateResult> {
  const users = await getAllUsers(DB);
  let addedCount = 0;
  let skippedCount = 0;
  let reorderedCount = 0;
  let orderSkippedCount = 0;
  let assetCategoryAddedCount = 0;
  let assetCategorySkippedCount = 0;

  // Step 0：確保 assets 資料表存在。
  // CREATE TABLE IF NOT EXISTS 本身就是冪等操作，重複執行不會有副作用。
  await createAssetsTable(DB);

  // Step 1：替既有使用者補齊「保險」「運動」「飲食」支出分類。
  // 建立分類時同步寫入 sync_events，前端才能透過既有同步機制拿到新分類。
  for (const user of users) {
    for (const category of NEW_CATEGORIES) {
      const exists = await categoryExistsByName(
        user.id,
        category.name,
        category.type,
        DB,
      );

      if (exists) {
        skippedCount++;
        continue;
      }

      const sort_order = await getNextCategorySortOrder(
        user.id,
        category.type,
        DB,
      );
      const id = crypto.randomUUID();

      await createCategory(
        id,
        user.id,
        category.name,
        category.type,
        sort_order,
        1,
        DB,
      );

      const payload = JSON.stringify({
        action: "POST",
        version: 1,
        payload: JSON.stringify({
          id,
          user_id: user.id,
          name: category.name,
          type: category.type,
          sort_order,
        }),
      });
      await insertSyncEvent(
        user.id,
        crypto.randomUUID(),
        "CAT",
        id,
        payload,
        DB,
      );

      addedCount++;
    }
  }

  // Step 2：把所有使用者的支出分類順序統一成 DEFAULT_EXPENSE_CATEGORY_NAMES。
  // 必須在 Step 1 之後才撈資料，才會包含剛補齊的分類。
  // 只調整順序不符的分類；不在預設清單內的自訂分類不動。
  const expectedOrder = new Map(
    DEFAULT_EXPENSE_CATEGORY_NAMES.map(
      (name, index) => [name, index + 1] as const,
    ),
  );
  const expenseCategories = await getAllActiveExpenseCategories(DB);

  for (const category of expenseCategories) {
    const expected = expectedOrder.get(category.name);
    if (expected === undefined || category.sort_order === expected) {
      orderSkippedCount++;
      continue;
    }

    const newVersion = category.version + 1;
    await updateCategorySortOrder(
      category.id,
      category.user_id,
      expected,
      newVersion,
      DB,
    );

    const payload = JSON.stringify({
      action: "PUT",
      version: newVersion,
      payload: JSON.stringify({
        id: category.id,
        user_id: category.user_id,
        name: category.name,
        type: "EXPENSE",
        sort_order: expected,
      }),
    });
    await insertSyncEvent(
      category.user_id,
      crypto.randomUUID(),
      "CAT",
      category.id,
      payload,
      DB,
    );

    reorderedCount++;
  }

  // Step 3：替既有使用者補齊 5 筆資產分類（國內證券／海外證券／基金／約當現金／信託）。
  // 做法跟 Step 1 一樣：用 categoryExistsByName 判斷是否已存在，
  // 已存在就跳過，確保這個 Step 可以重複執行（冪等）。
  // sort_order 不用 MAX+1（無資料時會從 1 開始，與新使用者的 201+ 不一致），
  // 而是固定用「起始值 + 在預設清單中的索引」，讓新舊使用者的順序完全相同。
  for (const user of users) {
    for (const [index, name] of DEFAULT_ASSET_CATEGORY_NAMES.entries()) {
      const exists = await categoryExistsByName(user.id, name, "ASSET", DB);

      if (exists) {
        assetCategorySkippedCount++;
        continue;
      }

      const sort_order = ASSET_CATEGORY_SORT_ORDER_START + index;
      const id = crypto.randomUUID();

      await createCategory(id, user.id, name, "ASSET", sort_order, 1, DB);

      const payload = JSON.stringify({
        action: "POST",
        version: 1,
        payload: JSON.stringify({
          id,
          user_id: user.id,
          name,
          type: "ASSET",
          sort_order,
        }),
      });
      await insertSyncEvent(
        user.id,
        crypto.randomUUID(),
        "CAT",
        id,
        payload,
        DB,
      );

      assetCategoryAddedCount++;
    }
  }

  return {
    total_users: users.length,
    added_count: addedCount,
    skipped_count: skippedCount,
    reordered_count: reorderedCount,
    order_skipped_count: orderSkippedCount,
    asset_category_added_count: assetCategoryAddedCount,
    asset_category_skipped_count: assetCategorySkippedCount,
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const result = await applyDatabaseUpdates(DB);

    const totalAdded = result.added_count + result.asset_category_added_count;
    return new Response(
      JSON.stringify({
        message:
          totalAdded + result.reordered_count > 0
            ? `資料庫更新完成：新增 ${totalAdded} 筆分類（含 ${result.asset_category_added_count} 筆資產分類），調整 ${result.reordered_count} 筆分類順序`
            : "資料庫已是最新：沒有需要新增或調整的分類",
        ...result,
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error applying database updates:", error);
    return new Response(
      JSON.stringify({ error: "資料庫更新失敗" }),
      {
        headers: { "content-type": "application/json" },
        status: 500,
      },
    );
  }
};
