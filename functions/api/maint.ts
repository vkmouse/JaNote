import type { Env } from "../types";
import { getAllUsers } from "../repositories/userRepository";
import {
  createCategory,
  updateCategory,
} from "../repositories/categoryRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

// 分潤分類的固定 sort_order
const SORT_ORDER_SHARE_PROFIT = 107;
const SORT_ORDER_OTHER_INCOME = 108;

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    const users = await getAllUsers(DB);
    let addedCount = 0;
    let skippedCount = 0;

    for (const user of users) {
      const userId = user.id;

      // 檢查該使用者是否已有「分潤」分類（冪等保護）
      const existing = await DB.prepare(
        "SELECT id FROM categories WHERE user_id = ? AND name = ? AND type = 'INCOME' AND is_deleted = 0",
      )
        .bind(userId, "分潤")
        .first<{ id: string }>();

      if (existing) {
        skippedCount++;
        continue;
      }

      // 查詢現有的 INCOME「其他」分類，將其 sort_order 從 107 改為 108
      const otherCat = await DB.prepare(
        "SELECT id, version FROM categories WHERE user_id = ? AND name = '其他' AND type = 'INCOME' AND is_deleted = 0",
      )
        .bind(userId)
        .first<{ id: string; version: number }>();

      if (otherCat) {
        const newVersion = otherCat.version + 1;
        await updateCategory(
          otherCat.id,
          userId,
          "其他",
          "INCOME",
          SORT_ORDER_OTHER_INCOME,
          newVersion,
          DB,
        );

        // 插入 sync_event，讓前端下次 pull 時同步「其他」的排序變更
        const otherPayload = JSON.stringify({
          action: "PUT",
          version: newVersion,
          base_version: otherCat.version,
          payload: JSON.stringify({
            id: otherCat.id,
            user_id: userId,
            name: "其他",
            type: "INCOME",
            sort_order: SORT_ORDER_OTHER_INCOME,
          }),
        });
        await insertSyncEvent(
          userId,
          crypto.randomUUID(),
          "CAT",
          otherCat.id,
          otherPayload,
          DB,
        );
      }

      // 插入新的「分潤」分類
      const shareProfitId = crypto.randomUUID();
      await createCategory(
        shareProfitId,
        userId,
        "分潤",
        "INCOME",
        SORT_ORDER_SHARE_PROFIT,
        1,
        DB,
      );

      // 插入 sync_event，讓前端下次 pull 時同步新的「分潤」分類
      const shareProfitPayload = JSON.stringify({
        action: "POST",
        version: 1,
        payload: JSON.stringify({
          id: shareProfitId,
          user_id: userId,
          name: "分潤",
          type: "INCOME",
          sort_order: SORT_ORDER_SHARE_PROFIT,
        }),
      });
      await insertSyncEvent(
        userId,
        crypto.randomUUID(),
        "CAT",
        shareProfitId,
        shareProfitPayload,
        DB,
      );

      addedCount++;
    }

    return new Response(
      JSON.stringify({
        message: "維運作業完成",
        total_users: users.length,
        added: addedCount,
        skipped: skippedCount,
      }),
      { headers: { "content-type": "application/json" }, status: 200 },
    );
  } catch (error) {
    console.error("maint error:", error);
    return new Response(
      JSON.stringify({ error: "維運作業失敗", detail: String(error) }),
      { headers: { "content-type": "application/json" }, status: 500 },
    );
  }
};
