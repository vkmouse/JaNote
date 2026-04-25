import { ref } from "vue";
import { defineStore } from "pinia";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import { syncMetaRepository } from "../db/repositories/syncMetaRepository";
import { categoryRepository } from "../db/repositories/categoryRepository";
import { transactionRepository } from "../db/repositories/transactionRepository";
import { userShareRepository } from "../db/repositories/userShareRepository";
import { budgetRepository } from "../db/repositories/budgetRepository";
import { recurringTransactionRepository } from "../db/repositories/recurringTransactionRepository";
import { recurringBudgetRepository } from "../db/repositories/recurringBudgetRepository";
import { userRepository } from "../db/repositories/userRepository";
import type {
  SyncQueueItem,
  PushCommand,
  PushResult,
  PullEvent,
  SyncResponse,
  CategoryPayload,
  TransactionPayload,
  UserSharePayload,
  BudgetPayload,
  RecurringTransactionPayload,
  RecurringBudgetPayload,
} from "../types";

// ── Auth error ────────────────────────────────────────────────────────────────

/** 當 Cloudflare Access session 過期，fetch 被 redirect 到外部登入頁時拋出 */
export class AuthExpiredError extends Error {
  constructor() {
    super("Auth session expired");
    this.name = "AuthExpiredError";
  }
}

// ── Private business logic helpers ────────────────────────────────────────────

function parsePayload(
  payload: string | null,
):
  | CategoryPayload
  | TransactionPayload
  | UserSharePayload
  | BudgetPayload
  | RecurringTransactionPayload
  | RecurringBudgetPayload
  | null {
  if (!payload) return null;
  if (typeof payload === "string") {
    try {
      return JSON.parse(payload);
    } catch {
      return null;
    }
  }
  return payload;
}

async function applyPullEvent(event: PullEvent): Promise<void> {
  const payload = parsePayload(event.payload);

  if (event.entity_type === "CAT") {
    if (event.action === "DELETE") {
      await categoryRepository.update(event.entity_id, (record) => {
        if (!record) {
          return {
            id: event.entity_id,
            user_id: "",
            name: "Unknown",
            type: "EXPENSE",
            sortOrder: 0,
            version: event.version,
            is_deleted: 1,
          };
        }
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const catPayload = payload as CategoryPayload;
    await categoryRepository.upsert({
      id: event.entity_id,
      user_id: catPayload.user_id || "",
      name: catPayload.name || "Untitled",
      type: catPayload.type || "EXPENSE",
      sortOrder: catPayload.sort_order,
      version: event.version,
      is_deleted: 0,
    });
    return;
  }

  if (event.entity_type === "TXN") {
    if (event.action === "DELETE") {
      await transactionRepository.update(event.entity_id, (record) => {
        if (!record) {
          return {
            id: event.entity_id,
            user_id: "",
            category_id: "",
            type: "EXPENSE",
            amount: 0,
            note: "",
            date: Date.now(),
            version: event.version,
            is_deleted: 1,
          };
        }
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const txnPayload = payload as TransactionPayload;
    await transactionRepository.upsert({
      id: event.entity_id,
      user_id: txnPayload.user_id || "",
      category_id: txnPayload.category_id || "",
      type: txnPayload.type || "EXPENSE",
      amount: Number(txnPayload.amount) || 0,
      note: txnPayload.note || "",
      date: txnPayload.date || Date.now(),
      version: event.version,
      is_deleted: 0,
    });
    return;
  }

  if (event.entity_type === "SHR") {
    if (event.action === "DELETE") {
      await userShareRepository.update(event.entity_id, (record) => {
        if (!record) return null;
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const shrPayload = payload as UserSharePayload;
    await userShareRepository.upsert({
      id: event.entity_id,
      sender_id: shrPayload.sender_id || "",
      sender_email: shrPayload.sender_email || "",
      receiver_id: shrPayload.receiver_id || "",
      receiver_email: shrPayload.receiver_email || "",
      status: shrPayload.status || "PENDING",
      version: event.version,
      is_deleted: 0,
    });
    return;
  }

  if (event.entity_type === "BGT") {
    if (event.action === "DELETE") {
      await budgetRepository.update(event.entity_id, (record) => {
        if (!record) return null;
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const bgtPayload = payload as BudgetPayload;
    await budgetRepository.upsert({
      id: event.entity_id,
      user_id: bgtPayload.user_id || "",
      name: bgtPayload.name || "",
      type: bgtPayload.type || "EXPENSE",
      goal: Number(bgtPayload.goal) || 0,
      month_key: bgtPayload.month_key || "",
      category_ids: bgtPayload.category_ids || "",
      version: event.version,
      is_deleted: 0,
    });
    return;
  }

  if (event.entity_type === "RTXN") {
    if (event.action === "DELETE") {
      await recurringTransactionRepository.update(event.entity_id, (record) => {
        if (!record) return null;
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const rtxnPayload = payload as RecurringTransactionPayload;
    await recurringTransactionRepository.upsert({
      id: event.entity_id,
      user_id: rtxnPayload.user_id || "",
      category_id: rtxnPayload.category_id || "",
      type: rtxnPayload.type || "EXPENSE",
      amount: Number(rtxnPayload.amount) || 0,
      note: rtxnPayload.note || "",
      recurrence_type: rtxnPayload.recurrence_type || "MONTHLY",
      recurrence_day: Number(rtxnPayload.recurrence_day) || 1,
      is_active: rtxnPayload.is_active ?? 1,
      last_executed_at: rtxnPayload.last_executed_at ?? null,
      version: event.version,
      is_deleted: 0,
    });
    return;
  }

  if (event.entity_type === "RBGT") {
    if (event.action === "DELETE") {
      await recurringBudgetRepository.update(event.entity_id, (record) => {
        if (!record) return null;
        return { ...record, version: event.version, is_deleted: 1 };
      });
      return;
    }
    if (!payload || typeof payload !== "object") return;
    const rbgtPayload = payload as RecurringBudgetPayload;
    await recurringBudgetRepository.upsert({
      id: event.entity_id,
      user_id: rbgtPayload.user_id || "",
      name: rbgtPayload.name || "",
      type: rbgtPayload.type || "EXPENSE",
      goal: Number(rbgtPayload.goal) || 0,
      category_ids: rbgtPayload.category_ids || "",
      is_active: rbgtPayload.is_active ?? 1,
      recurrence_type: rbgtPayload.recurrence_type ?? "MONTHLY",
      recurrence_day: Number(rbgtPayload.recurrence_day) || 1,
      last_executed_at: rbgtPayload.last_executed_at ?? null,
      version: event.version,
      is_deleted: 0,
    });
    return;
  }
}

async function bumpLocalVersion(
  entityType: "CAT" | "TXN" | "SHR" | "BGT" | "RTXN" | "RBGT",
  entityId: string,
  version: number,
  action: "PUT" | "DELETE" | "POST",
): Promise<void> {
  if (entityType === "CAT") {
    await categoryRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
  if (entityType === "TXN") {
    await transactionRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
  if (entityType === "SHR") {
    await userShareRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
  if (entityType === "BGT") {
    await budgetRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
  if (entityType === "RTXN") {
    await recurringTransactionRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
  if (entityType === "RBGT") {
    await recurringBudgetRepository.update(entityId, (record) => {
      if (!record) return null;
      return {
        ...record,
        version,
        is_deleted: action === "DELETE" ? 1 : record.is_deleted,
      };
    });
    return;
  }
}

async function rollbackEntity(entry: SyncQueueItem): Promise<void> {
  if (!entry.snapshot_before) {
    if (entry.action === "POST") {
      if (entry.entity_type === "TXN") {
        await transactionRepository.update(entry.entity_id, (record) => {
          if (!record) return null;
          return { ...record, is_deleted: 1 };
        });
      } else if (entry.entity_type === "SHR") {
        await userShareRepository.update(entry.entity_id, (record) => {
          if (!record) return null;
          return { ...record, is_deleted: 1 };
        });
      } else if (entry.entity_type === "BGT") {
        await budgetRepository.update(entry.entity_id, (record) => {
          if (!record) return null;
          return { ...record, is_deleted: 1 };
        });
      } else if (entry.entity_type === "RTXN") {
        await recurringTransactionRepository.update(entry.entity_id, (record) => {
          if (!record) return null;
          return { ...record, is_deleted: 1 };
        });
      } else if (entry.entity_type === "RBGT") {
        await recurringBudgetRepository.update(entry.entity_id, (record) => {
          if (!record) return null;
          return { ...record, is_deleted: 1 };
        });
      }
    }
    return;
  }
  try {
    const snapshot = JSON.parse(entry.snapshot_before);
    if (entry.entity_type === "CAT") {
      await categoryRepository.upsert(snapshot);
    } else if (entry.entity_type === "TXN") {
      await transactionRepository.upsert(snapshot);
    } else if (entry.entity_type === "SHR") {
      await userShareRepository.upsert(snapshot);
    } else if (entry.entity_type === "BGT") {
      await budgetRepository.upsert(snapshot);
    } else if (entry.entity_type === "RTXN") {
      await recurringTransactionRepository.upsert(snapshot);
    } else if (entry.entity_type === "RBGT") {
      await recurringBudgetRepository.upsert(snapshot);
    }
  } catch (error) {
    console.error(
      "還原實體失敗 (Failed to rollback entity)",
      entry.entity_id,
      error,
    );
  }
}

async function handleError(
  errorResult: PushResult,
  entry: SyncQueueItem,
  mutationMap: Map<string, SyncQueueItem>,
  allResults: PushResult[],
  pullEntityIds: Set<string>,
): Promise<void> {
  const laterResults = allResults.filter((r) => {
    const e = mutationMap.get(r.mutation_id);
    return e?.entity_id === entry.entity_id && e.created_at > entry.created_at;
  });
  const lastResult =
    laterResults.length > 0 ? laterResults[laterResults.length - 1] : undefined;

  if (lastResult?.status === "OK" || lastResult?.status === "SKIPPED") {
    await syncQueueRepository.removeByEntityId(entry.entity_id);
    return;
  }
  if (pullEntityIds.has(entry.entity_id)) {
    await syncQueueRepository.removeByEntityId(entry.entity_id);
    return;
  }
  await rollbackEntity(entry);
  await syncQueueRepository.removeByEntityId(entry.entity_id);
  console.warn("Operation failed and rolled back:", {
    entity_id: entry.entity_id,
    entity_type: entry.entity_type,
    action: entry.action,
    error_code: errorResult.error_code,
    error_message: errorResult.error_message,
  });
}

const SYNC_BATCH_SIZE = 50;

/** 同步核心邏輯 */
async function runSync(apiBase: string): Promise<SyncResponse> {
  let currentCursor = await syncMetaRepository.getLastCursor();
  const queue = await syncQueueRepository.getAllOrdered();
  const localUser = await userRepository.get();

  // 將佇列切分為每批 SYNC_BATCH_SIZE 筆的批次；佇列為空時仍送一次空請求以觸發 pull
  const batches: SyncQueueItem[][] =
    queue.length === 0
      ? [[]]
      : Array.from({ length: Math.ceil(queue.length / SYNC_BATCH_SIZE) }, (_, i) =>
          queue.slice(i * SYNC_BATCH_SIZE, (i + 1) * SYNC_BATCH_SIZE),
        );

  let lastResponseData: SyncResponse | null = null;

  for (const batch of batches) {
    const pushCommands: PushCommand[] = batch.map((item) => ({
      mutation_id: item.mutation_id,
      entity_type: item.entity_type,
      entity_id: item.entity_id,
      action: item.action,
      base_version: item.base_version,
      payload: parsePayload(item.payload),
    }));

    const mutationMap = new Map<string, SyncQueueItem>(
      batch.map((item) => [item.mutation_id, item]),
    );

    const response = await fetch(`${apiBase}/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        last_cursor: currentCursor,
        push_commands: pushCommands,
        user: localUser,
      }),
    });

    // CF Access session 過期時，fetch 會 follow redirect 到外部登入頁
    if (!response.url.startsWith(window.location.origin)) {
      throw new AuthExpiredError();
    }

    if (!response.ok) {
      throw new Error(`Sync failed with status ${response.status}`);
    }

    const responseData: SyncResponse = await response.json();
    const pushResultsList: PushResult[] = responseData.push_results || [];
    const pullEvents = responseData.pull_events || [];
    const pullEntityIds = new Set(pullEvents.map((event) => event.entity_id));

    // 步驟 1：先套用伺服器傳來的新資料
    for (const event of pullEvents) {
      await applyPullEvent(event);
    }

    // 步驟 2：處理推播結果
    for (const result of pushResultsList) {
      const entry = mutationMap.get(result.mutation_id);
      if (!entry) continue;

      if (result.status === "OK") {
        if (result.version == null) continue;
        if (!pullEntityIds.has(entry.entity_id)) {
          const action = entry.action as "PUT" | "DELETE" | "POST";
          await bumpLocalVersion(
            entry.entity_type,
            entry.entity_id,
            result.version,
            action,
          );
        }
        await syncQueueRepository.removeByMutationIds([result.mutation_id]);
      } else if (result.status === "SKIPPED") {
        await syncQueueRepository.removeByMutationIds([result.mutation_id]);
      } else if (result.status === "ERROR") {
        await handleError(
          result,
          entry,
          mutationMap,
          pushResultsList,
          pullEntityIds,
        );
      }
    }

    // 步驟 3：清理被 Pull 覆蓋的佇列項目
    for (const entityId of pullEntityIds) {
      await syncQueueRepository.removeByEntityId(entityId);
    }

    // 每批次結束後立即持久化 cursor，確保失敗時下次能從斷點繼續
    currentCursor = responseData.new_cursor || currentCursor;
    await syncMetaRepository.setLastCursor(currentCursor);

    if (responseData.user) {
      await userRepository.set(responseData.user);
    }

    lastResponseData = responseData;
  }

  return lastResponseData!;
}

// ── Pinia Store ────────────────────────────────────────────────────────────────

export const useSyncStore = defineStore("sync", () => {
  // ── State ──────────────────────────────────────────────────
  const syncStatus = ref<"idle" | "syncing" | "success" | "error">("idle");
  const lastCursor = ref(0);
  const activeQueueCount = ref(0);
  const lastSyncAt = ref("");

  // ── Actions ────────────────────────────────────────────────
  /** 重新讀取同步 cursor 與佇列數量 */
  async function refreshSyncState(): Promise<void> {
    lastCursor.value = await syncMetaRepository.getLastCursor();
    const queueItems = await syncQueueRepository.getAllOrdered();
    activeQueueCount.value = queueItems.length;
  }

  /** 執行完整同步流程 */
  async function performSync(apiBase: string): Promise<SyncResponse> {
    syncStatus.value = "syncing";
    try {
      const result = await runSync(apiBase);
      await refreshSyncState();
      lastSyncAt.value = new Date().toLocaleString();
      syncStatus.value = "success";
      return result;
    } catch (error) {
      syncStatus.value = "error";
      throw error;
    }
  }

  /** 清除本機同步資料（佇列 + meta） */
  async function clearSyncData(): Promise<void> {
    await syncQueueRepository.clear();
    await syncMetaRepository.clear();
    lastCursor.value = 0;
    activeQueueCount.value = 0;
  }

  return {
    // state
    syncStatus,
    lastCursor,
    activeQueueCount,
    lastSyncAt,
    // actions
    refreshSyncState,
    performSync,
    clearSyncData,
  };
});
