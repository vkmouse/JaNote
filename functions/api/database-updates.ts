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
  categoryExistsByName,
  createCategory,
  getAllActiveExpenseCategories,
  getNextCategorySortOrder,
  updateCategorySortOrder,
} from "../repositories/categoryRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

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
}

async function applyDatabaseUpdates(
  DB: D1Database,
): Promise<DatabaseUpdateResult> {
  const users = await getAllUsers(DB);
  let addedCount = 0;
  let skippedCount = 0;
  let reorderedCount = 0;
  let orderSkippedCount = 0;

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

  return {
    total_users: users.length,
    added_count: addedCount,
    skipped_count: skippedCount,
    reordered_count: reorderedCount,
    order_skipped_count: orderSkippedCount,
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const result = await applyDatabaseUpdates(DB);

    return new Response(
      JSON.stringify({
        message:
          result.added_count + result.reordered_count > 0
            ? `資料庫更新完成：新增 ${result.added_count} 筆分類，調整 ${result.reordered_count} 筆分類順序`
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
