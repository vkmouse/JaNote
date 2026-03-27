import type { Env, AuthContext } from "../types";
import { getAllUsers } from "../repositories/userRepository";
import { createCategory } from "../repositories/categoryRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

/**
 * POST /api/maint
 * 維運 API：為所有缺少 INCOME「其他」分類的使用者補建分類與 sync_event。
 */
export const onRequestPost: PagesFunction<Env, any, AuthContext> = async (
  context,
) => {
  const { DB } = context.env;

  const users = await getAllUsers(DB);
  const added: { userId: string; email: string }[] = [];

  for (const user of users) {
    const existing = await DB.prepare(
      "SELECT id FROM categories WHERE user_id = ? AND name = '其他' AND type = 'INCOME' AND is_deleted = 0",
    )
      .bind(user.id)
      .first<{ id: string }>();

    if (!existing) {
      const id = crypto.randomUUID();
      const sort_order = 107;

      await createCategory(id, user.id, "其他", "INCOME", sort_order, 1, DB);

      const payload = JSON.stringify({
        action: "POST",
        version: 1,
        payload: JSON.stringify({
          id,
          user_id: user.id,
          name: "其他",
          type: "INCOME",
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

      added.push({ userId: user.id, email: user.email });
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      processed: users.length,
      added: added.length,
      details: added,
    }),
    { headers: { "content-type": "application/json" } },
  );
};
