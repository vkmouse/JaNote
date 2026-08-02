/**
 * 純健康檢查端點。
 *
 * 這支原本兼職「給前端偵測 CF Access session 是否過期」的角色（配合
 * `redirect: 'manual'` 偵測 302），新架構下 session 過期改用 access_token
 * 是否還能通過 middleware 驗證來判斷（401 → 前端打 /api/auth/refresh），
 * 不再需要靠這支端點探測，所以拿掉 email 相關的回傳內容，單純確認
 * 服務與資料庫是否正常運作。
 *
 * 跟其他 /api/* 路徑一樣，會先經過 functions/api/_middleware.ts 驗證
 * access_token，沒有帶合法 Cookie 一樣會被擋在 401。
 */
import type { AuthContext, Env } from "../types";

export const onRequest: PagesFunction<Env, any, AuthContext> = async (
  context,
) => {
  const db = context.env.DB;

  const result = await db
    .prepare("SELECT datetime('now') as current_time")
    .first<{ current_time: string }>();

  return new Response(
    JSON.stringify({
      status: "ok",
      current_time: result?.current_time || null,
    }),
    {
      headers: { "content-type": "application/json" },
    },
  );
};
