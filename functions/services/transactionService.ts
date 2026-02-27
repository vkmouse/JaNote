import type { PushCommand, PushResult, ServiceContext } from '../types';
import { isNonEmptyString, isNumber, isValidEntryType, parsePayload } from '../utils/validators';
import { getTransactionVersion, updateTransaction, createTransaction, deleteTransaction as deleteTransactionRepo } from '../repositories/transactionRepository';
import { insertSyncEvent } from '../repositories/syncEventRepository';

/**
 * Handle POST action for transaction (create only)
 */
export async function postTransaction(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getTransactionVersion(event.entity_id, userId, DB);

  if (currentVersion > 0) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'ALREADY_EXISTS',
      error_message: 'Transaction already exists, use PUT to update',
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
  const categoryId = payloadObject?.category_id;
  const type = payloadObject?.type;
  const amount = payloadObject?.amount;
  const date = payloadObject?.date;
  const note = payloadObject?.note ?? null;
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

  if (!isNonEmptyString(categoryId) || !isValidEntryType(type) || !isNumber(amount) || !isNumber(date)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Transaction requires category_id, type, amount, and date',
    };
  }

  const newVersion = 1;
  await createTransaction(event.entity_id, userId, categoryId, type, amount, note, date, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: JSON.stringify({ id: event.entity_id, user_id: userId, category_id: categoryId, type, amount, note, date }) });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle PUT action for transaction (update only)
 */
export async function putTransaction(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getTransactionVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'NOT_FOUND',
      error_message: 'Transaction does not exist, use POST to create',
    };
  }

  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  const { payloadString, payloadObject } = parsePayload(event.payload);
  const categoryId = payloadObject?.category_id;
  const type = payloadObject?.type;
  const amount = payloadObject?.amount;
  const date = payloadObject?.date;
  const note = payloadObject?.note ?? null;
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

  if (!isNonEmptyString(categoryId) || !isValidEntryType(type) || !isNumber(amount) || !isNumber(date)) {
    return {
      mutation_id: event.mutation_id,
      status: 'ERROR',
      error_code: 'INVALID_PAYLOAD',
      error_message: 'Transaction requires category_id, type, amount, and date',
    };
  }

  const newVersion = currentVersion + 1;
  await updateTransaction(event.entity_id, userId, categoryId, type, amount, note, date, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: JSON.stringify({ id: event.entity_id, user_id: userId, category_id: categoryId, type, amount, note, date }) });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}

/**
 * Handle DELETE action for transaction
 */
export async function deleteTransaction(event: PushCommand, context: ServiceContext): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getTransactionVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: 'SKIPPED' };
  }

  const newVersion = currentVersion + 1;
  await deleteTransactionRepo(event.entity_id, userId, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: 'OK', version: newVersion };
}
