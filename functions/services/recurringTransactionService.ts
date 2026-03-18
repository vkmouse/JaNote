import type { PushCommand, PushResult, ServiceContext } from "../types";
import { isNonEmptyString, isNumber, parsePayload } from "../utils/validators";
import {
  getRecurringTransactionVersion,
  createRecurringTransaction,
  updateRecurringTransaction,
  deleteRecurringTransaction as deleteRecurringTransactionRepo,
} from "../repositories/recurringTransactionRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

export async function postRecurringTransaction(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const categoryId = payloadObject?.category_id;
  const type = payloadObject?.type;
  const amount = payloadObject?.amount;
  const note = payloadObject?.note ?? null;
  const recurrenceType = payloadObject?.recurrence_type;
  const recurrenceDays = payloadObject?.recurrence_days;
  const isActive = payloadObject?.is_active ?? 1;
  const payloadUserId = payloadObject?.user_id;

  if (event.base_version !== 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_BASE_VERSION", error_message: "POST requires base_version to be 0" };
  }
  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(categoryId) || !isNonEmptyString(type) || !isNumber(amount) || !isNonEmptyString(recurrenceType) || !isNonEmptyString(recurrenceDays)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "RecurringTransaction requires category_id, type, amount, recurrence_type, and recurrence_days" };
  }
  if (recurrenceType !== "MONTHLY" && recurrenceType !== "WEEKLY") {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_RECURRENCE_TYPE", error_message: "recurrence_type must be MONTHLY or WEEKLY" };
  }

  const currentVersion = await getRecurringTransactionVersion(event.entity_id, userId, DB);
  if (currentVersion > 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "ALREADY_EXISTS", error_message: "RecurringTransaction already exists, use PUT to update" };
  }

  const newVersion = 1;
  await createRecurringTransaction(event.entity_id, userId, categoryId, type, amount, note, recurrenceType, recurrenceDays, isActive, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, category_id: categoryId, type, amount, note, recurrence_type: recurrenceType, recurrence_days: recurrenceDays, is_active: isActive }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function putRecurringTransaction(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const categoryId = payloadObject?.category_id;
  const type = payloadObject?.type;
  const amount = payloadObject?.amount;
  const note = payloadObject?.note ?? null;
  const recurrenceType = payloadObject?.recurrence_type;
  const recurrenceDays = payloadObject?.recurrence_days;
  const isActive = payloadObject?.is_active ?? 1;
  const payloadUserId = payloadObject?.user_id;

  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(categoryId) || !isNonEmptyString(type) || !isNumber(amount) || !isNonEmptyString(recurrenceType) || !isNonEmptyString(recurrenceDays)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "RecurringTransaction requires category_id, type, amount, recurrence_type, and recurrence_days" };
  }
  if (recurrenceType !== "MONTHLY" && recurrenceType !== "WEEKLY") {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_RECURRENCE_TYPE", error_message: "recurrence_type must be MONTHLY or WEEKLY" };
  }

  const currentVersion = await getRecurringTransactionVersion(event.entity_id, userId, DB);
  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "NOT_FOUND", error_message: "RecurringTransaction does not exist, use POST to create" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await updateRecurringTransaction(event.entity_id, userId, categoryId, type, amount, note, recurrenceType, recurrenceDays, isActive, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, category_id: categoryId, type, amount, note, recurrence_type: recurrenceType, recurrence_days: recurrenceDays, is_active: isActive }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function deleteRecurringTransaction(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getRecurringTransactionVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await deleteRecurringTransactionRepo(event.entity_id, userId, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}
