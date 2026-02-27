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

  // Validate owner_id and owner_email match middleware info
  if (payloadObject?.owner_id !== userId || payloadObject?.owner_email !== userEmail) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'OWNER_MISMATCH',
      error_message: 'Owner id/email does not match authenticated user',
    };
  }

  const viewerEmail = payloadObject?.viewer_email;
  if (!isNonEmptyString(viewerEmail)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Viewer email is required',
    };
  }

  // Get viewer_id from users table by viewer_email
  const viewerUser = await getUserByEmail(viewerEmail, DB);

  if (!viewerUser) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'VIEWER_NOT_FOUND',
      error_message: 'Viewer user does not exist',
    };
  }

  const viewerId = viewerUser.id;

  // Prevent inviting self: owner and viewer must be different users
  if (viewerId === userId) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'CANNOT_INVITE_SELF',
      error_message: 'Owner and viewer must be different users',
    };
  }

  // Check if share already exists (is_deleted = 0)
  const existingShare = await getActiveUserShare(userId, viewerId, DB);

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
  await createUserShare(shareId, userId, userEmail, viewerId, viewerEmail, "PENDING", newVersion, DB);

  // 處理成功，寫入 PUT 事件（事實）給 owner 和 viewer
  const putPayloadString = JSON.stringify({
    id: shareId,
    owner_id: userId,
    owner_email: userEmail,
    viewer_id: viewerId,
    viewer_email: viewerEmail,
    status: "PENDING",
  });
  const putSyncPayload = JSON.stringify({
    action: "PUT",
    version: newVersion,
    payload: putPayloadString,
  });

  // 給 owner 和 viewer 都使用 server-generated mutation_id
  // 這樣雙方都能收到 pull_event（不會被 excludeMutationIds 排除）
  const ownerPutMutationId = crypto.randomUUID();
  await insertSyncEvent(userId, ownerPutMutationId, event.entity_type, event.entity_id, putSyncPayload, DB);

  const viewerPutMutationId = crypto.randomUUID();
  await insertSyncEvent(viewerId, viewerPutMutationId, event.entity_type, event.entity_id, putSyncPayload, DB);

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

  // Get the share to verify user is viewer
  const share = await getUserShareById(event.entity_id, DB);

  if (!share) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'NOT_FOUND',
      error_message: 'Share not found or deleted',
    };
  }

  // Verify user is viewer
  const isViewer = share.viewer_id === userId && share.viewer_email === userEmail;
  if (!isViewer) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'FORBIDDEN',
      error_message: 'Only viewer can accept invitation',
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
    owner_id: share.owner_id,
    owner_email: share.owner_email,
    viewer_id: share.viewer_id,
    viewer_email: share.viewer_email,
    status: "ACTIVE",
  });

  const syncPayload = JSON.stringify({ action: "PUT", version: newVersion, payload: updatedPayloadString });

  // Write event to both owner and viewer，都使用 server-generated mutation_id
  const ownerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.owner_id, ownerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  const viewerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.viewer_id, viewerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

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

  // Get the share to verify user is owner or viewer
  const share = await getUserShareById(event.entity_id, DB);

  if (!share) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  // Verify user is owner or viewer
  const isOwner = share.owner_id === userId && share.owner_email === userEmail;
  const isViewer = share.viewer_id === userId && share.viewer_email === userEmail;

  if (!isOwner && !isViewer) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'FORBIDDEN',
      error_message: 'User must be owner or viewer to delete share',
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

  // Write event to both owner and viewer，都使用 server-generated mutation_id
  const ownerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.owner_id, ownerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  const viewerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.viewer_id, viewerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}
