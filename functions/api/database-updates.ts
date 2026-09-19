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
  categoryExistsByName,
  createCategory,
  getNextCategorySortOrder,
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
}

async function applyDatabaseUpdates(
  DB: D1Database,
): Promise<DatabaseUpdateResult> {
  const users = await getAllUsers(DB);
  let addedCount = 0;
  let skippedCount = 0;

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

  return {
    total_users: users.length,
    added_count: addedCount,
    skipped_count: skippedCount,
  };
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const result = await applyDatabaseUpdates(DB);

    return new Response(
      JSON.stringify({
        message:
          result.added_count > 0
            ? `資料庫更新完成：新增 ${result.added_count} 筆分類，略過 ${result.skipped_count} 筆已存在資料`
            : `資料庫已是最新：略過 ${result.skipped_count} 筆已存在資料`,
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
