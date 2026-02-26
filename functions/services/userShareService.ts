import { getUserShareVersion, getUserShareById, getActiveUserShare, createUserShare, updateUserShareStatus, deleteUserShare as deleteUserShareRepo } from '../repositories/userShareRepository';
import { getUserByEmail } from '../repositories/userRepository';
import { insertSyncEvent } from '../repositories/syncEventRepository';

interface PushCommand {
  mutation_id: string;
  entity_type: string;
  entity_id: string;
  action: string;
  base_version: number;
  payload?: unknown;
}

interface PushResult {
  mutation_id: string;
  status: 'OK' | 'ERROR' | 'SKIPPED';
  version?: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

interface ServiceContext {
  userId: string;
  userEmail: string;
  DB: D1Database;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parsePayload(payload: unknown): { payloadString: string | null; payloadObject: any } {
  if (payload === undefined || payload === null) {
    return { payloadString: null, payloadObject: null };
  }
  if (typeof payload === "string") {
    try {
      const parsed = JSON.parse(payload);
      return { payloadString: payload, payloadObject: parsed };
    } catch {
      return { payloadString: payload, payloadObject: payload };
    }
  }
  return { payloadString: JSON.stringify(payload), payloadObject: payload };
}

/**
 * Handle POST action for user share
 */
export async function postUserShare(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, userEmail, DB } = context;
  const { payloadString, payloadObject } = parsePayload(event.payload);

  // 首先寫入前端送來的 POST 事件
  const postSyncPayload = JSON.stringify({
    action: "POST",
    version: 0,
    payload: payloadString,
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, postSyncPayload, DB);

  // Validate owner_id and owner_email match middleware info
  if (payloadObject?.owner_id !== userId || payloadObject?.owner_email !== userEmail) {
    // 驗證失敗，寫入 DELETE 事件
    const deleteMutationId = crypto.randomUUID();
    const deletePayload = JSON.stringify({
      action: "DELETE",
      version: 1,
      payload: null,
    });
    await insertSyncEvent(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload, DB);
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'OWNER_MISMATCH',
      error_message: 'Owner id/email does not match authenticated user',
    };
  }

  const viewerEmail = payloadObject?.viewer_email;
  if (!isNonEmptyString(viewerEmail)) {
    // viewer_email 驗證失敗，寫入 DELETE 事件
    const deleteMutationId = crypto.randomUUID();
    const deletePayload = JSON.stringify({
      action: "DELETE",
      version: 1,
      payload: null,
    });
    await insertSyncEvent(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload, DB);
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
    // Viewer not found, write DELETE event
    const deleteMutationId = crypto.randomUUID();
    const deletePayload = JSON.stringify({
      action: "DELETE",
      version: 1,
      payload: null,
    });
    await insertSyncEvent(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload, DB);
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'VIEWER_NOT_FOUND',
      error_message: 'Viewer user does not exist',
    };
  }

  const viewerId = viewerUser.id;

  // Check if share already exists (is_deleted = 0)
  const existingShare = await getActiveUserShare(userId, viewerId, DB);

  if (existingShare) {
    // Share already exists, write DELETE event
    const deleteMutationId = crypto.randomUUID();
    const deletePayload = JSON.stringify({
      action: "DELETE",
      version: 1,
      payload: null,
    });
    await insertSyncEvent(userId, deleteMutationId, event.entity_type, event.entity_id, deletePayload, DB);
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'ALREADY_EXISTS',
      error_message: 'Share already exists between these users',
    };
  }

  // 驗證全部通過，插入新的分享記錄
  const shareId = event.entity_id;
  const newVersion = 1;
  await createUserShare(shareId, userId, userEmail, viewerId, viewerEmail, "PENDING", newVersion, DB);

  // 處理成功，寫入 PUT 事件給 owner 和 viewer
  const putMutationId = crypto.randomUUID();
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
  await insertSyncEvent(userId, putMutationId, event.entity_type, event.entity_id, putSyncPayload, DB);

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

  // Write event to both owner and viewer
  const ownerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.owner_id, ownerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  await insertSyncEvent(share.viewer_id, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

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

  // Write event to both owner and viewer
  await insertSyncEvent(share.owner_id, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  const viewerMutationId = crypto.randomUUID();
  await insertSyncEvent(share.viewer_id, viewerMutationId, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}
