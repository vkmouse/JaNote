/// <reference path="../types.d.ts" />

import type {
  AuthContext,
  Env,
  EntityType,
  ActionType,
  SyncRequest,
  PushCommand,
  PushResult,
  PullEvent,
  ServiceContext,
  EntityHandler,
} from "../types";
import {
  isNonEmptyString,
  isNumber,
  isValidEntityType,
  isValidAction,
} from "../utils/validators";
import { getUserIdByEmail as getUserIdByEmailRepo } from "../repositories/userRepository";
import { initializeDefaultCategories } from "../repositories/categoryRepository";
import {
  getSyncEventByMutationId,
  getMaxSyncEventId,
  getPullEvents,
  getPullEventsForSharedUsers,
  getMaxSyncEventIdForUsers,
} from "../repositories/syncEventRepository";
import { 
  getActiveSendersByReceiverId,
  getActiveReceiversBySenderId 
} from "../repositories/userShareRepository";
import {
  postCategory,
  putCategory,
  deleteCategory,
} from "../services/categoryService";
import {
  postTransaction,
  putTransaction,
  deleteTransaction,
} from "../services/transactionService";
import {
  postUserShare,
  putUserShare,
  deleteUserShare,
} from "../services/userShareService";

/**
 * 根據使用者的 Email 取得 User ID。
 * 如果這是一個全新建立的使用者，會順便幫他初始化預設的記帳分類。
 */
async function getUserIdByEmail(
  email: string,
  DB: D1Database,
): Promise<string> {
  const userId = await getUserIdByEmailRepo(email, DB);

  // 檢查這是否為新使用者（剛建立的）
  const existing = await DB.prepare("SELECT created_at FROM users WHERE id = ?")
    .bind(userId)
    .first<{ created_at: string }>();

  if (existing) {
    const createdAt = new Date(existing.created_at);
    const now = new Date();
    const diffSeconds = (now.getTime() - createdAt.getTime()) / 1000;

    // 如果使用者剛被建立，則初始化預設分類
    if (diffSeconds < 1) {
      await initializeDefaultCategories(userId, DB);
    }
  }

  return userId;
}

// 實體處理函式映射表 (Routing Map)
const entityHandlers: Record<string, EntityHandler> = {
  "POST:CAT": postCategory,
  "PUT:CAT": putCategory,
  "DELETE:CAT": deleteCategory,
  "POST:TXN": postTransaction,
  "PUT:TXN": putTransaction,
  "DELETE:TXN": deleteTransaction,
  "POST:SHR": postUserShare,
  "PUT:SHR": putUserShare,
  "DELETE:SHR": deleteUserShare,
};

/**
 * Cloudflare Pages 的 API 進入點
 * 負責處理所有的同步請求 (Sync Request)
 */
export const onRequest: PagesFunction<Env, any, AuthContext> = async (
  context,
) => {
  const { DB } = context.env;
  const userEmail = context.data.email; // 從認證 middleware 中取得已經驗證過的 Email
  const userId = await getUserIdByEmail(userEmail, DB);

  // 同步 API 必須使用 POST 方法
  if (context.request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body: SyncRequest;
  try {
    body = (await context.request.json()) as SyncRequest;
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, { status: 400 });
  }

  // last_cursor 代表客戶端上一次同步的進度
  if (!isNumber(body?.last_cursor)) {
    return jsonResponse(
      { error: "last_cursor must be a number" },
      { status: 400 },
    );
  }

  // 如果請求中有提供 user 欄位，則進行安全性驗證
  // 確保客戶端本地端的使用者與目前 Token 認證的使用者是同一個人，防止資料串聯錯誤
  if (body.user !== undefined && body.user !== null) {
    if (body.user.email !== userEmail) {
      return jsonResponse({ error: "User email mismatch" }, { status: 403 });
    }
    if (body.user.id !== userId) {
      return jsonResponse({ error: "User id mismatch" }, { status: 403 });
    }
  }

  const pushCommands = Array.isArray(body.push_commands)
    ? body.push_commands
    : [];
  const pushResults: PushResult[] = [];

  // ==========================================
  // 階段一：處理 Push (將客戶端的變更寫入伺服器)
  // ==========================================
  try {
    // sortPushCommands 確保「分類 (CAT)」會比「交易 (TXN)」先被處理
    for (const event of sortPushCommands(pushCommands)) {
      if (
        !isNonEmptyString(event?.mutation_id) ||
        !isNonEmptyString(event?.entity_id) ||
        !isNonEmptyString(event?.entity_type) ||
        !isNonEmptyString(event?.action) ||
        !isNumber(event?.base_version)
      ) {
        return jsonResponse(
          { error: "Invalid push_commands entry" },
          { status: 400 },
        );
      }

      if (!isValidEntityType(event.entity_type)) {
        return jsonResponse(
          { error: `Unsupported entity_type: ${event.entity_type}` },
          { status: 400 },
        );
      }

      if (!isValidAction(event.action)) {
        return jsonResponse(
          { error: `Unsupported action: ${event.action}` },
          { status: 400 },
        );
      }

      // 冪等性檢查 (Idempotency)
      // 利用 mutation_id 來檢查這個操作是不是已經被處理過
      // 避免因為網路不穩重試時，造成重複的資料
      const existingMutation = await getSyncEventByMutationId(
        event.mutation_id,
        DB,
      );

      if (existingMutation) {
        pushResults.push({ mutation_id: event.mutation_id, status: "SKIPPED" });
        continue;
      }

      // 從映射表中組合出對應的處理函式 (例如 "POST:TXN")
      const handlerKey = `${event.action}:${event.entity_type}` as const;
      const handler = entityHandlers[handlerKey];

      if (!handler) {
        return jsonResponse(
          { error: `Unsupported action-entity combination: ${handlerKey}` },
          { status: 400 },
        );
      }

      // 執行該筆變更，並將結果記錄起來
      const serviceContext: ServiceContext = { userId, userEmail, DB };
      const result = await handler(event, serviceContext);

      pushResults.push(result);
    }
  } catch (error: any) {
    return jsonResponse(
      { error: error?.message ?? "Sync failed" },
      { status: 500 },
    );
  }

  // 紀錄本次請求成功處理的 mutation_ids，在拉取新資料時要排除這些自己剛送出的變更，避免浪費頻寬
  const processedMutationIds = pushResults.map((r) => r.mutation_id);

  // ==========================================
  // 階段二：處理 Pull (將伺服器上的新變更回傳給客戶端)
  // ==========================================

  // 取得雙向共享的使用者 ID
  // 1. 當前使用者作為接收者（receiver），取得所有發送者（sender）
  const activeSenderShares = await getActiveSendersByReceiverId(userId, DB);
  const senderIds = activeSenderShares.map((s) => s.sender_id);
  
  // 2. 當前使用者作為發送者（sender），取得所有接收者（receiver）
  const activeReceiverShares = await getActiveReceiversBySenderId(userId, DB);
  const receiverIds = activeReceiverShares.map((s) => s.receiver_id);
  
  // 3. 合併所有需要同步的使用者 ID（去重）
  const sharedUserIds = [...new Set([...senderIds, ...receiverIds])];
  const allUserIds = [userId, ...sharedUserIds];

  // 計算下一次同步時，客戶端應該要帶上的新游標 (new_cursor)
  const maxCursor = await getMaxSyncEventIdForUsers(allUserIds, DB);
  const newCursor = maxCursor > 0 ? maxCursor : body.last_cursor;

  // 根據客戶端提供的 last_cursor，拉取自從上次同步之後，使用者「自己」的資料變更事件
  const pullQueryResults = await getPullEvents(
    userId,
    body.last_cursor,
    processedMutationIds,
    DB,
  );

  // 同時拉取共享使用者的事件（僅 CAT 與 TXN）
  // 包括：發送者分享給我的 + 我分享給接收者的
  const sharedPullResults = await getPullEventsForSharedUsers(
    sharedUserIds,
    body.last_cursor,
    processedMutationIds,
    DB,
  );

  // 將所有需要同步給客戶端的事件合併
  const allPullQueryResults = [...pullQueryResults, ...sharedPullResults];

  // 將資料庫查出來的結果格式化成客戶端能看懂的 PullEvent 格式
  const pullEvents: PullEvent[] = allPullQueryResults.map((row: any) => {
    let action: ActionType = "PUT";
    let version = 0;
    let payload: string | null = row.payload ?? null;

    if (row.payload) {
      try {
        const parsed = JSON.parse(row.payload);
        if (parsed?.action === "PUT" || parsed?.action === "DELETE") {
          action = parsed.action;
        }
        if (isNumber(parsed?.version)) {
          version = parsed.version;
        }
        if (parsed?.payload !== undefined) {
          payload = parsed.payload ?? null;
        }
      } catch {
        // 如果 payload 不是 JSON 格式，則保留原始的 payload 內容
      }
    }

    // 回傳同步結果：包含新的游標、推送的執行狀態(成功或被跳過)、需要拉取的新事件、以及確認使用者身分
    return {
      id: row.id as number,
      mutation_id: row.mutation_id as string,
      entity_type: row.entity_type,
      entity_id: row.entity_id as string,
      action,
      version,
      payload,
    };
  });

  return jsonResponse({
    new_cursor: newCursor,
    push_results: pushResults,
    pull_events: pullEvents,
    user: { id: userId, email: userEmail },
  });
};

/**
 * 快速封裝回傳 JSON 格式的 Response
 */
function jsonResponse(body: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

/**
 * 對推送指令進行排序：優先順序為 分類(CAT) > 交易(TXN) > 共用設定(SHR)
 * 這是為了確保外鍵關聯正確（交易通常會綁定分類）。
 */
function sortPushCommands(commands: PushCommand[]): PushCommand[] {
  const priority: Record<EntityType, number> = { CAT: 0, TXN: 1, SHR: 2 };
  return [...commands].sort(
    (a, b) => priority[a.entity_type] - priority[b.entity_type],
  );
}
