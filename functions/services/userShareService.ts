import type { PushCommand, PushResult, ServiceContext } from '../types';
import { isNonEmptyString, parsePayload } from '../utils/validators';
import { getUserShareVersion, getUserShareById, getActiveUserShare, createUserShare, updateUserShareStatus, deleteUserShare as deleteUserShareRepo } from '../repositories/userShareRepository';
import { getUserByEmail } from '../repositories/userRepository';
import { insertSyncEvent } from '../repositories/syncEventRepository';

/**
 * Handle POST action for user share
 */
export async function postUserShare(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const { payloadString, payloadObject } = parsePayload(event.payload);

  // ===== 先完成所有驗證，只有成功才寫入 sync_event =====

  // Validate sender_id and sender_email match middleware info
  if (payloadObject?.sender_id !== userId || payloadObject?.sender_email !== userEmail) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'SENDER_MISMATCH',
      error_message: 'Sender id/email does not match authenticated user',
    };
  }

  const receiverEmail = payloadObject?.receiver_email;
  if (!isNonEmptyString(receiverEmail)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Receiver email is required',
    };
  }

  // Get receiver_id from users table by receiver_email
  const receiverUser = await getUserByEmail(receiverEmail, DB);

  if (!receiverUser) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'RECEIVER_NOT_FOUND',
      error_message: 'Receiver user does not exist',
    };
  }

  const receiverId = receiverUser.id;

  // Prevent inviting self: sender and receiver must be different users
  if (receiverId === userId) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'CANNOT_INVITE_SELF',
      error_message: 'Sender and receiver must be different users',
    };
  }

  // Check if share already exists (is_deleted = 0)
  const existingShare = await getActiveUserShare(userId, receiverId, DB);

  if (existingShare) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'ALREADY_EXISTS',
      error_message: 'Share already exists between these users',
    };
  }

  // ===== 驗證全部通過，插入新的分享記錄並寫入事實 =====

  const shareId = event.entity_id;
  const newVersion = 1;
  await createUserShare(shareId, userId, userEmail, receiverId, receiverEmail, "PENDING", newVersion, DB);

  // 處理成功，寫入 PUT 事件（事實）給 sender 和 receiver
  const putPayloadString = JSON.stringify({
    id: shareId,
    sender_id: userId,
    sender_email: userEmail,
    receiver_id: receiverId,
    receiver_email: receiverEmail,
    status: "PENDING",
  });
  const putSyncPayload = JSON.stringify({
    action: "PUT",
    version: newVersion,
    payload: putPayloadString,
  });

  // 給 sender 和 receiver 都使用 server-generated mutation_id
  // 這樣雙方都能收到 pull_event（不會被 excludeMutationIds 排除）
  const senderPutMutationId = crypto.randomUUID();
  await insertSyncEvent(userId, senderPutMutationId, event.entity_type, event.entity_id, putSyncPayload, DB);

  const receiverPutMutationId = crypto.randomUUID();
  await insertSyncEvent(receiverId, receiverPutMutationId, event.entity_type, event.entity_id, putSyncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle PUT action for user share
 */
export async function putUserShare(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const currentVersion = await getUserShareVersion(event.entity_id, DB);
  const shareExists = currentVersion > 0;

  if (!shareExists) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'NOT_FOUND',
      error_message: 'Share does not exist',
    };
  }

  // Get the share to verify user is receiver
  const share = await getUserShareById(event.entity_id, DB);

  if (!share) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'NOT_FOUND',
      error_message: 'Share not found or deleted',
    };
  }

  // Verify user is receiver
  const isReceiver = share.receiver_id === userId && share.receiver_email === userEmail;
  if (!isReceiver) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'FORBIDDEN',
      error_message: 'Only receiver can accept invitation',
    };
  }

  // Check base version
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  const { payloadString, payloadObject } = parsePayload(event.payload);

  // Validate payload status is ACTIVE
  if (payloadObject?.status !== "ACTIVE") {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Status must be ACTIVE for PUT action',
    };
  }

  // Update status to ACTIVE
  const newVersion = currentVersion + 1;
  await updateUserShareStatus(event.entity_id, "ACTIVE", newVersion, DB);

  const updatedPayloadString = JSON.stringify({
    id: event.entity_id,
    sender_id: share.sender_id,
    sender_email: share.sender_email,
    receiver_id: share.receiver_id,
    receiver_email: share.receiver_email,
    status: "ACTIVE",
  });

  const syncPayload = JSON.stringify({ action: "PUT", version: newVersion, payload: updatedPayloadString });

  // Write event to both sender and receiver，都使用 server-generated mutation_id
  const senderMutationId = crypto.randomUUID();
  await insertSyncEvent(share.sender_id, senderMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  const receiverMutationId = crypto.randomUUID();
  await insertSyncEvent(share.receiver_id, receiverMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle DELETE action for user share
 */
export async function deleteUserShare(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const currentVersion = await getUserShareVersion(event.entity_id, DB);
  const shareExists = currentVersion > 0;

  if (!shareExists) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  // Get the share to verify user is sender or receiver
  const share = await getUserShareById(event.entity_id, DB);

  if (!share) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  // Verify user is sender or receiver
  const isSender = share.sender_id === userId && share.sender_email === userEmail;
  const isReceiver = share.receiver_id === userId && share.receiver_email === userEmail;

  if (!isSender && !isReceiver) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'FORBIDDEN',
      error_message: 'User must be sender or receiver to delete share',
    };
  }

  // Check base version
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  // Delete the share
  const newVersion = currentVersion + 1;
  await deleteUserShareRepo(event.entity_id, newVersion, DB);

  const syncPayload = JSON.stringify({ action: "DELETE", version: newVersion, payload: null });

  // Write event to both sender and receiver，都使用 server-generated mutation_id
  const senderMutationId = crypto.randomUUID();
  await insertSyncEvent(share.sender_id, senderMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  const receiverMutationId = crypto.randomUUID();
  await insertSyncEvent(share.receiver_id, receiverMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}
