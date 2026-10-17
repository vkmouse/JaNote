/**
 * 手動觸發資料庫更新。
 *
 * 所有更新步驟集中在 applyDatabaseUpdates，依序以 Step N 標示。
 * 每個 Step 都必須具備冪等性，讓整個更新可以重複執行。
 * 此路徑受 /api middleware 的登入驗證保護。
 *
 * 目前沒有待執行的更新步驟；之後有新的 migration 時，從 Step 0 開始加入。
 */
import type { Env } from "../types";

async function applyDatabaseUpdates(_DB: D1Database): Promise<void> {
  // 目前沒有待執行的更新步驟。
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { DB } = context.env;

  try {
    await applyDatabaseUpdates(DB);

    return new Response(
      JSON.stringify({ message: "目前沒有待執行的資料庫更新" }),
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
