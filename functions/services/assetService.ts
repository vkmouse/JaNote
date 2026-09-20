import type { PushCommand, PushResult, ServiceContext } from "../types";
import {
  isNonEmptyString,
  isNumber,
  parsePayload,
} from "../utils/validators";
import {
  getAssetVersion,
  updateAsset,
  createAsset,
  deleteAsset as deleteAssetRepo,
} from "../repositories/assetRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

/**
 * 處理資產的 POST 操作（建立新資產紀錄）
 */
export async function postAsset(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const categoryId = payloadObject?.category_id;
  const name = payloadObject?.name;
  const amount = payloadObject?.amount;
  const date = payloadObject?.date;
  const createdAt = payloadObject?.created_at;
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
  if (
    !isNonEmptyString(categoryId) ||
    !isNonEmptyString(name) ||
    !isNumber(amount) ||
    !isNumber(date) ||
    !isNumber(createdAt)
  ) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message:
        "Asset requires category_id, name, amount, date, and created_at",
    };
  }

  const currentVersion = await getAssetVersion(event.entity_id, userId, DB);

  // 驗證是否已存在，version > 0 代表已存在
  if (currentVersion > 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "ALREADY_EXISTS",
      error_message: "Asset already exists, use PUT to update",
    };
  }

  // 實際執行資料庫更新
  const newVersion = 1;
  await createAsset(
    event.entity_id,
    userId,
    categoryId,
    name,
    amount,
    date,
    createdAt,
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
      category_id: categoryId,
      name,
      amount,
      date,
      created_at: createdAt,
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
 * 處理資產的 PUT 操作（更新既有資產紀錄）
 */
export async function putAsset(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const categoryId = payloadObject?.category_id;
  const name = payloadObject?.name;
  const amount = payloadObject?.amount;
  const date = payloadObject?.date;
  const createdAt = payloadObject?.created_at;
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
  if (
    !isNonEmptyString(categoryId) ||
    !isNonEmptyString(name) ||
    !isNumber(amount) ||
    !isNumber(date) ||
    !isNumber(createdAt)
  ) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message:
        "Asset requires category_id, name, amount, date, and created_at",
    };
  }

  const currentVersion = await getAssetVersion(event.entity_id, userId, DB);

  // 驗證是否已存在，version = 0 代表不存在
  if (currentVersion === 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "NOT_FOUND",
      error_message: "Asset does not exist, use POST to create",
    };
  }

  // 驗證版本衝突，當 event.base_version 比 DB 還舊，代表該變更已被覆寫則跳過
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 實際執行資料庫更新
  const newVersion = currentVersion + 1;
  await updateAsset(
    event.entity_id,
    userId,
    categoryId,
    name,
    amount,
    date,
    createdAt,
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
      category_id: categoryId,
      name,
      amount,
      date,
      created_at: createdAt,
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
 * 處理資產的 DELETE 操作
 */
export async function deleteAsset(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getAssetVersion(event.entity_id, userId, DB);

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
  await deleteAssetRepo(event.entity_id, userId, newVersion, DB);

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
