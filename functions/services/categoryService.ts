import type { PushCommand, PushResult, ServiceContext } from "../types";
import {
  isNonEmptyString,
  isValidEntryType,
  parsePayload,
} from "../utils/validators";
import {
  getCategoryVersion,
  updateCategory,
  createCategory,
  deleteCategory as deleteCategoryRepo,
} from "../repositories/categoryRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

/**
 * 處理分類的 POST 操作（建立新分類）
 */
export async function postCategory(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const sort_order = payloadObject?.sort_order;
  const payloadUserId = payloadObject?.user_id;

  // 驗證 event.base_version 必須為 0
  if (event.base_version !== 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_BASE_VERSION",
      error_message: "POST requires base_version to be 0",
    };
  }

  // 驗證 event.payload.user_id 中的 user_id 是否與 Token 的相同
  if (payloadUserId && payloadUserId !== userId) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "USER_ID_MISMATCH",
      error_message: "Payload user_id does not match authenticated user",
    };
  }

  // 驗證 event.payload 的欄位
  if (!isNonEmptyString(name) || !isValidEntryType(type)) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message: "Category requires name and type",
    };
  }

  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  // 驗證是否已存在，version > 0 代表已存在
  if (currentVersion > 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "ALREADY_EXISTS",
      error_message: "Category already exists, use PUT to update",
    };
  }

  // 實際執行資料庫更新
  const newVersion = 1;
  await createCategory(
    event.entity_id,
    userId,
    name,
    type,
    sort_order,
    newVersion,
    DB,
  );

  // 寫入 sync_events
  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({
      id: event.entity_id,
      user_id: userId,
      name,
      type,
      sort_order,
    }),
  });
  await insertSyncEvent(
    userId,
    event.mutation_id,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

/**
 * 處理分類的 PUT 操作（更新既有分類）
 */
export async function putCategory(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const sort_order = payloadObject?.sort_order;
  const payloadUserId = payloadObject?.user_id;

  // 驗證 event.payload.user_id 中的 user_id 是否與 Token 的相同
  if (payloadUserId && payloadUserId !== userId) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "USER_ID_MISMATCH",
      error_message: "Payload user_id does not match authenticated user",
    };
  }

  // 驗證 event.payload 的欄位
  if (!isNonEmptyString(name) || !isValidEntryType(type)) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message: "Category requires name and type",
    };
  }

  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  // 驗證是否存在，version = 0 代表不存在
  if (currentVersion === 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "NOT_FOUND",
      error_message: "Category does not exist, use POST to create",
    };
  }

  // 驗證版本衝突，當 event.base_version 比 DB 還舊，代表該變更已被覆寫則跳過
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 實際執行資料庫更新
  const newVersion = currentVersion + 1;
  await updateCategory(
    event.entity_id,
    userId,
    name,
    type,
    sort_order,
    newVersion,
    DB,
  );

  // 寫入 sync_events
  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({
      id: event.entity_id,
      user_id: userId,
      name,
      type,
      sort_order,
    }),
  });
  await insertSyncEvent(
    userId,
    event.mutation_id,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

/**
 * 處理分類的 DELETE 操作
 */
export async function deleteCategory(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  // 驗證是否存在，version = 0 代表不存在
  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 驗證版本衝突，當 event.base_version 比 DB 還舊，代表該變更已被覆寫則跳過
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 實際執行資料庫更新
  const newVersion = currentVersion + 1;
  await deleteCategoryRepo(event.entity_id, userId, newVersion, DB);

  // 寫入 sync_events
  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: null,
  });
  await insertSyncEvent(
    userId,
    event.mutation_id,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}
