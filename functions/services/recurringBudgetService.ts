import type { PushCommand, PushResult, ServiceContext } from "../types";
import { isNonEmptyString, isNumber, parsePayload } from "../utils/validators";
import {
  getRecurringBudgetVersion,
  createRecurringBudget,
  updateRecurringBudget,
  deleteRecurringBudget as deleteRecurringBudgetRepo,
} from "../repositories/recurringBudgetRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

export async function postRecurringBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const goal = payloadObject?.goal;
  const categoryIds = payloadObject?.category_ids;
  const isActive = payloadObject?.is_active ?? 1;
  const payloadUserId = payloadObject?.user_id;

  if (event.base_version !== 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_BASE_VERSION", error_message: "POST requires base_version to be 0" };
  }
  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(name) || !isNonEmptyString(type) || !isNumber(goal) || !isNonEmptyString(categoryIds)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "RecurringBudget requires name, type, goal, and category_ids" };
  }

  const currentVersion = await getRecurringBudgetVersion(event.entity_id, userId, DB);
  if (currentVersion > 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "ALREADY_EXISTS", error_message: "RecurringBudget already exists, use PUT to update" };
  }

  const newVersion = 1;
  await createRecurringBudget(event.entity_id, userId, name, type, goal, categoryIds, isActive, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type, goal, category_ids: categoryIds, is_active: isActive }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function putRecurringBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const goal = payloadObject?.goal;
  const categoryIds = payloadObject?.category_ids;
  const isActive = payloadObject?.is_active ?? 1;
  const payloadUserId = payloadObject?.user_id;

  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(name) || !isNonEmptyString(type) || !isNumber(goal) || !isNonEmptyString(categoryIds)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "RecurringBudget requires name, type, goal, and category_ids" };
  }

  const currentVersion = await getRecurringBudgetVersion(event.entity_id, userId, DB);
  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "NOT_FOUND", error_message: "RecurringBudget does not exist, use POST to create" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await updateRecurringBudget(event.entity_id, userId, name, type, goal, categoryIds, isActive, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type, goal, category_ids: categoryIds, is_active: isActive }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function deleteRecurringBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getRecurringBudgetVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await deleteRecurringBudgetRepo(event.entity_id, userId, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}
