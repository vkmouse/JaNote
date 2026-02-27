import type { PushCommand, PushResult, ServiceContext } from '../types';
import { isNonEmptyString, isValidEntryType, parsePayload } from '../utils/validators';
import { getCategoryVersion, updateCategory, createCategory, deleteCategory as deleteCategoryRepo } from '../repositories/categoryRepository';
import { insertSyncEvent } from '../repositories/syncEventRepository';

/**
 * Handle POST action for category (create only)
 */
export async function postCategory(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  if (currentVersion > 0) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'ALREADY_EXISTS',
      error_message: 'Category already exists, use PUT to update',
    };
  }

  if (event.base_version !== 0) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_BASE_VERSION',
      error_message: 'POST requires base_version to be 0',
    };
  }

  const { payloadString, payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const payloadUserId = payloadObject?.user_id;

  // Validate user_id matches context
  if (payloadUserId && payloadUserId !== userId) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'USER_ID_MISMATCH',
      error_message: 'Payload user_id does not match authenticated user',
    };
  }

  if (!isNonEmptyString(name)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Category name is required',
    };
  }

  if (!isValidEntryType(type)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Category type is required',
    };
  }

  const newVersion = 1;
  await createCategory(event.entity_id, userId, name, type, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type }) });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle PUT action for category (update only)
 */
export async function putCategory(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'NOT_FOUND',
      error_message: 'Category does not exist, use POST to create',
    };
  }

  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  const { payloadString, payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const payloadUserId = payloadObject?.user_id;

  // Validate user_id matches context
  if (payloadUserId && payloadUserId !== userId) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'USER_ID_MISMATCH',
      error_message: 'Payload user_id does not match authenticated user',
    };
  }

  if (!isNonEmptyString(name)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Category name is required',
    };
  }

  if (!isValidEntryType(type)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Category type is required',
    };
  }

  const newVersion = currentVersion + 1;
  await updateCategory(event.entity_id, userId, name, type, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type }) });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle DELETE action for category
 */
export async function deleteCategory(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getCategoryVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  const newVersion = currentVersion + 1;
  await deleteCategoryRepo(event.entity_id, userId, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}
