import type { PushCommand, PushResult, ServiceContext } from "../types";
import { isNonEmptyString, parsePayload } from "../utils/validators";
import {
  getUserShareVersion,
  getUserShareById,
  getActiveUserShare,
  createUserShare,
  updateUserShareStatus,
  deleteUserShare as deleteUserShareRepo,
} from "../repositories/userShareRepository";
import { getUserByEmail } from "../repositories/userRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

/**
 * 處理使用者共享的 POST 操作（建立共享邀請）
 * 先完成所有驗證，只有成功才寫入 sync_event
 */
export async function postUserShare(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const senderId = payloadObject?.sender_id;
  const senderEmail = payloadObject?.sender_email;
  const receiverEmail = payloadObject?.receiver_email;

  // 驗證 sender_id 與 sender_email 與 middleware 的資訊相符
  if (senderId !== userId || senderEmail !== userEmail) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "SENDER_MISMATCH",
      error_message: "Sender id/email does not match authenticated user",
    };
  }

  // 驗證 event.payload.receiver_email
  if (!isNonEmptyString(receiverEmail)) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message: "Receiver email is required",
    };
  }

  // 驗證 event.payload.receiver_email 必須對應到使用者
  const receiverUser = await getUserByEmail(receiverEmail, DB);
  if (!receiverUser) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "RECEIVER_NOT_FOUND",
      error_message: "Receiver user does not exist",
    };
  }

  // 驗證 receiver_id 不能與 sender_id 相同
  const receiverId = receiverUser.id;
  if (receiverId === senderId) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "CANNOT_INVITE_SELF",
      error_message: "Sender and receiver must be different users",
    };
  }

  // 驗證已存在共享紀錄
  const existingShare = await getActiveUserShare(senderId, receiverId, DB);
  if (existingShare) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "ALREADY_EXISTS",
      error_message: "Share already exists between these users",
    };
  }

  // 實際執行資料庫更新
  const newVersion = 1;
  await createUserShare(
    event.entity_id,
    senderId,
    senderEmail,
    receiverId,
    receiverEmail,
    "PENDING",
    newVersion,
    DB,
  );

  // 寫入 sync_events PUT 事件（事實）給發送者與接收者
  // 雙方都使用 server 產生的 mutation_id，以確保 pull 時都不會被 excludeMutationIds 排除
  const putPayloadString = JSON.stringify({
    id: event.entity_id,
    sender_id: senderId,
    sender_email: senderEmail,
    receiver_id: receiverId,
    receiver_email: receiverEmail,
    status: "PENDING",
  });
  const putSyncPayload = JSON.stringify({
    action: "PUT",
    version: newVersion,
    payload: putPayloadString,
  });

  const senderPutMutationId = crypto.randomUUID();
  await insertSyncEvent(
    userId,
    senderPutMutationId,
    event.entity_type,
    event.entity_id,
    putSyncPayload,
    DB,
  );

  const receiverPutMutationId = crypto.randomUUID();
  await insertSyncEvent(
    receiverId,
    receiverPutMutationId,
    event.entity_type,
    event.entity_id,
    putSyncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

/**
 * 處理使用者共享的 PUT 操作（接收者接受邀請）
 */
export async function putUserShare(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const senderId = payloadObject?.sender_id;
  const senderEmail = payloadObject?.sender_email;
  const receiverId = payloadObject?.receiver_email;
  const receiverEmail = payloadObject?.receiver_email;
  const status = payloadObject?.status;

  // 驗證 receive_id 與 receive_email 與 middleware 的資訊相符
  if (receiverId !== userId || receiverEmail !== userEmail) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "RECEIVER_MISMATCH",
      error_message: "Receiver id/email does not match authenticated user",
    };
  }

  // 驗證 event.payload 的欄位
  if (
    !isNonEmptyString(senderId) ||
    !isNonEmptyString(senderEmail) ||
    status !== "ACTIVE"
  ) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message: "Status must be ACTIVE for PUT action",
    };
  }

  const currentVersion = await getUserShareVersion(event.entity_id, DB);

  // 驗證是否存在，version = 0 代表不存在
  if (currentVersion === 0) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "NOT_FOUND",
      error_message: "Share does not exist",
    };
  }

  // 驗證版本衝突，當 event.base_version 比 DB 還舊，代表該變更已被覆寫則跳過
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 取得共享紀錄以驗證資料庫的資料
  const share = await getUserShareById(event.entity_id, DB);

  // 驗證共享紀錄存在
  if (!share) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "NOT_FOUND",
      error_message: "Share not found or deleted",
    };
  }

  // 驗證共享紀錄的 sender 與 payload 中的 sender 資訊相符
  if (
    share.sender_id !== senderId ||
    share.sender_email !== senderEmail ||
    share.receiver_id !== receiverId ||
    share.receiver_email !== receiverEmail
  ) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "INVALID_PAYLOAD",
      error_message:
        "Payload sender/receiver info does not match existing share record",
    };
  }

  // 實際執行資料庫更新
  const newVersion = currentVersion + 1;
  await updateUserShareStatus(event.entity_id, "ACTIVE", newVersion, DB);

  // 寫入 sync_events PUT 事件（事實）給發送者與接收者，皆使用 server 產生的 mutation_id
  const updatedPayloadString = JSON.stringify({
    id: event.entity_id,
    sender_id: share.sender_id,
    sender_email: share.sender_email,
    receiver_id: share.receiver_id,
    receiver_email: share.receiver_email,
    status: "ACTIVE",
  });

  const syncPayload = JSON.stringify({
    action: "PUT",
    version: newVersion,
    payload: updatedPayloadString,
  });

  const senderMutationId = crypto.randomUUID();
  await insertSyncEvent(
    share.sender_id,
    senderMutationId,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  const receiverMutationId = crypto.randomUUID();
  await insertSyncEvent(
    share.receiver_id,
    receiverMutationId,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

/**
 * 處理使用者共享的 DELETE 操作（刪除共享或取消邀請）
 */
export async function deleteUserShare(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const currentVersion = await getUserShareVersion(event.entity_id, DB);
  const shareExists = currentVersion > 0;

  if (!shareExists) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 取得共享紀錄以驗證目前使用者是否為發送者或接收者
  const share = await getUserShareById(event.entity_id, DB);

  if (!share) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 驗證 sender 或 receiver 與 middleware 的資訊相符
  if (
    (share.sender_id !== userId || share.sender_email !== userEmail) &&
    (share.receiver_id !== userId || share.receiver_email !== userEmail)
  ) {
    return {
      mutation_id: event.mutation_id,
      status: "ERROR",
      error_code: "FORBIDDEN",
      error_message: "User must be sender or receiver to delete share",
    };
  }

  // 驗證版本衝突，當 event.base_version 比 DB 還舊，代表該變更已被覆寫則跳過
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  // 實際執行資料庫更新
  const newVersion = currentVersion + 1;
  await deleteUserShareRepo(event.entity_id, newVersion, DB);

  // 寫入 sync_events DELETE 事件給發送者與接收者，皆使用 server 產生的 mutation_id
  const syncPayload = JSON.stringify({
    action: "DELETE",
    version: newVersion,
    payload: null,
  });

  const senderMutationId = crypto.randomUUID();
  await insertSyncEvent(
    share.sender_id,
    senderMutationId,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  const receiverMutationId = crypto.randomUUID();
  await insertSyncEvent(
    share.receiver_id,
    receiverMutationId,
    event.entity_type,
    event.entity_id,
    syncPayload,
    DB,
  );

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}
