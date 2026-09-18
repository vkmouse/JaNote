/**
 * 手動觸發的一次性補齊腳本。
 *
 * 背景：`categoryRepository.ts` 的 `initializeDefaultCategories` 新增了
 * 「保險」「運動」「飲食」三個支出分類，但這只會影響「之後才註冊」的
 * 新使用者；既有使用者的 categories 資料表裡沒有這三筆，需要靠這支 API
 * 補齊。
 *
 * 設計重點：
 * - 不驗證身分（見 functions/api/_middleware.ts 的 SKIP_AUTH_PATHS），
 *   純粹讓維運者手動打一次即可，之後可以直接刪掉這支檔案。
 * - 具備冪等性：對每個使用者、每個要補的分類，先查是否已存在同名同
 *   類型的分類（不論是否已刪除），存在就跳過，不存在才新增。因此
 *   重複呼叫不會造成重複建立。
 * - 新分類的 sort_order 接在該使用者目前同類型分類的最大值之後，
 *   不會打亂既有排序。
 * - 建立分類的同時寫入 sync_events，讓前端既有的 sync 機制能把新分類
 *   同步下去，行為與 initializeDefaultCategories 一致。
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

export const onRequest: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const users = await getAllUsers(DB);
    const added: Record<string, string[]> = {};
    const skipped: Record<string, string[]> = {};

    for (const user of users) {
      for (const category of NEW_CATEGORIES) {
        const exists = await categoryExistsByName(
          user.id,
          category.name,
          category.type,
          DB,
        );

        if (exists) {
          (skipped[user.email] ??= []).push(category.name);
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

        (added[user.email] ??= []).push(category.name);
      }
    }

    return new Response(
      JSON.stringify({
        message: "Backfill completed",
        total_users: users.length,
        added,
        skipped,
      }),
      {
        headers: { "content-type": "application/json" },
        status: 200,
      },
    );
  } catch (error) {
    console.error("Error backfilling new categories:", error);
    return new Response(
      JSON.stringify({ error: "Failed to backfill new categories" }),
      {
        headers: { "content-type": "application/json" },
        status: 500,
      },
    );
  }
};
