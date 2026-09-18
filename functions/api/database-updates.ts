/**
 * 手動觸發資料庫更新。
 *
 * 本次更新會替既有使用者補齊「保險」「運動」「飲食」三個支出分類。
 * - 具備冪等性：已存在同名、同類型分類就跳過，可重複執行。
 * - 新分類的 sort_order 接在該使用者目前同類型分類的最大值之後。
 * - 建立分類時寫入 sync_events，讓前端既有同步機制能同步新分類。
 * - 此路徑受 /api middleware 的登入驗證保護。
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const users = await getAllUsers(DB);
    let addedCount = 0;
    let skippedCount = 0;

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

    return new Response(
      JSON.stringify({
        message:
          addedCount > 0
            ? `資料庫更新完成：新增 ${addedCount} 筆分類，略過 ${skippedCount} 筆已存在資料`
            : `資料庫已是最新：略過 ${skippedCount} 筆已存在資料`,
        total_users: users.length,
        added_count: addedCount,
        skipped_count: skippedCount,
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
