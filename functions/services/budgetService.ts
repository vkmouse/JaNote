import type { PushCommand, PushResult, ServiceContext } from "../types";
import { isNonEmptyString, isNumber, parsePayload } from "../utils/validators";
import {
  getBudgetVersion,
  createBudget,
  updateBudget,
  deleteBudget as deleteBudgetRepo,
} from "../repositories/budgetRepository";
import { insertSyncEvent } from "../repositories/syncEventRepository";

export async function postBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const goal = payloadObject?.goal;
  const monthKey = payloadObject?.month_key;
  const categoryIds = payloadObject?.category_ids;
  const payloadUserId = payloadObject?.user_id;

  if (event.base_version !== 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_BASE_VERSION", error_message: "POST requires base_version to be 0" };
  }
  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(name) || !isNonEmptyString(type) || !isNumber(goal) || !isNonEmptyString(monthKey) || !isNonEmptyString(categoryIds)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "Budget requires name, type, goal, month_key, and category_ids" };
  }

  const currentVersion = await getBudgetVersion(event.entity_id, userId, DB);
  if (currentVersion > 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "ALREADY_EXISTS", error_message: "Budget already exists, use PUT to update" };
  }

  const newVersion = 1;
  await createBudget(event.entity_id, userId, name, type, goal, monthKey, categoryIds, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type, goal, month_key: monthKey, category_ids: categoryIds }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function putBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const { payloadObject } = parsePayload(event.payload);
  const name = payloadObject?.name;
  const type = payloadObject?.type;
  const goal = payloadObject?.goal;
  const monthKey = payloadObject?.month_key;
  const categoryIds = payloadObject?.category_ids;
  const payloadUserId = payloadObject?.user_id;

  if (payloadUserId && payloadUserId !== userId) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "USER_ID_MISMATCH", error_message: "Payload user_id does not match authenticated user" };
  }
  if (!isNonEmptyString(name) || !isNonEmptyString(type) || !isNumber(goal) || !isNonEmptyString(monthKey) || !isNonEmptyString(categoryIds)) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "INVALID_PAYLOAD", error_message: "Budget requires name, type, goal, month_key, and category_ids" };
  }

  const currentVersion = await getBudgetVersion(event.entity_id, userId, DB);
  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "ERROR", error_code: "NOT_FOUND", error_message: "Budget does not exist, use POST to create" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await updateBudget(event.entity_id, userId, name, type, goal, monthKey, categoryIds, newVersion, DB);

  const syncPayload = JSON.stringify({
    action: event.action,
    version: newVersion,
    payload: JSON.stringify({ id: event.entity_id, user_id: userId, name, type, goal, month_key: monthKey, category_ids: categoryIds }),
  });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}

export async function deleteBudget(
  event: PushCommand,
  context: ServiceContext,
): Promise<PushResult> {
  const { userId, DB } = context;
  const currentVersion = await getBudgetVersion(event.entity_id, userId, DB);

  if (currentVersion === 0) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }
  if (event.base_version < currentVersion) {
    return { mutation_id: event.mutation_id, status: "SKIPPED" };
  }

  const newVersion = currentVersion + 1;
  await deleteBudgetRepo(event.entity_id, userId, newVersion, DB);

  const syncPayload = JSON.stringify({ action: event.action, version: newVersion, payload: null });
  await insertSyncEvent(userId, event.mutation_id, event.entity_type, event.entity_id, syncPayload, DB);

  return { mutation_id: event.mutation_id, status: "OK", version: newVersion };
}
