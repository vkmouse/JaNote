import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { recurringTransactionRepository } from "../db/repositories/recurringTransactionRepository";
import { recurringBudgetRepository } from "../db/repositories/recurringBudgetRepository";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import { userRepository } from "../db/repositories/userRepository";
import { useUserStore } from "./userStore";
import type {
  RecurringTransaction,
  RecurringBudget,
  EntryType,
} from "../types";

export const useRecurringStore = defineStore("recurring", () => {
  const userStore = useUserStore();

  // ── State ──────────────────────────────────────────────────
  const recurringTransactions = ref<RecurringTransaction[]>([]);
  const recurringBudgets = ref<RecurringBudget[]>([]);

  // ── Computed ───────────────────────────────────────────────
  const visibleRecurringTransactions = computed(() =>
    recurringTransactions.value.filter(
      (t) => !t.is_deleted && t.user_id === userStore.activeUserId,
    ),
  );

  const visibleRecurringBudgets = computed(() =>
    recurringBudgets.value.filter(
      (b) => !b.is_deleted && b.user_id === userStore.activeUserId,
    ),
  );

  // ── Actions ────────────────────────────────────────────────
  async function loadRecurringTransactions(): Promise<void> {
    recurringTransactions.value = await recurringTransactionRepository.getAll();
  }

  async function loadRecurringBudgets(): Promise<void> {
    recurringBudgets.value = await recurringBudgetRepository.getAll();
  }

  /** 新增固定記帳並加入同步佇列 */
  async function addRecurringTransaction({
    category_id,
    type,
    amount,
    note,
    recurrence_type,
    recurrence_day,
  }: {
    category_id: string;
    type: EntryType;
    amount: number;
    note: string;
    recurrence_type: "MONTHLY" | "WEEKLY";
    recurrence_day: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const id = crypto.randomUUID();

    const item: RecurringTransaction = {
      id,
      user_id,
      category_id,
      type,
      amount,
      note,
      recurrence_type,
      recurrence_day,
      is_active: 1,
      version: 1,
      is_deleted: 0,
    };

    await recurringTransactionRepository.upsert(item);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RTXN",
        entity_id: id,
        action: "POST",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          type,
          amount,
          note,
          recurrence_type,
          recurrence_day,
        }),
        base_version: 0,
        snapshot_before: null,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringTransactions();
  }

  /** 更新固定記帳並加入同步佇列 */
  async function updateRecurringTransaction({
    id,
    category_id,
    type,
    amount,
    note,
    recurrence_type,
    recurrence_day,
  }: {
    id: string;
    category_id: string;
    type: EntryType;
    amount: number;
    note: string;
    recurrence_type: "MONTHLY" | "WEEKLY";
    recurrence_day: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const existing = await recurringTransactionRepository.getById(id);
    if (!existing) throw new Error("RecurringTransaction not found");

    const snapshot = JSON.stringify(existing);

    const updated: RecurringTransaction = {
      ...existing,
      user_id,
      category_id,
      type,
      amount,
      note,
      recurrence_type,
      recurrence_day,
      version: existing.version + 1,
    };

    await recurringTransactionRepository.upsert(updated);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RTXN",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          type,
          amount,
          note,
          recurrence_type,
          recurrence_day,
        }),
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringTransactions();
  }

  /** 切換固定記帳 is_active 狀態 */
  async function toggleRecurringTransactionActive(id: string): Promise<void> {
    const existing = await recurringTransactionRepository.getById(id);
    if (!existing) return;

    const snapshot = JSON.stringify(existing);
    const updated: RecurringTransaction = {
      ...existing,
      is_active: existing.is_active ? 0 : 1,
      version: existing.version + 1,
    };

    await recurringTransactionRepository.upsert(updated);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RTXN",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify(updated),
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringTransactions();
  }

  /** 新增固定預算並加入同步佇列 */
  async function addRecurringBudget({
    name,
    type,
    goal,
    category_ids,
  }: {
    name: string;
    type: EntryType;
    goal: number;
    category_ids: string;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const id = crypto.randomUUID();

    const item: RecurringBudget = {
      id,
      user_id,
      name,
      type,
      goal,
      category_ids,
      is_active: 1,
      recurrence_type: "MONTHLY",
      recurrence_day: 1,
      version: 1,
      is_deleted: 0,
    };

    await recurringBudgetRepository.upsert(item);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RBGT",
        entity_id: id,
        action: "POST",
        payload: JSON.stringify({
          id,
          user_id,
          name,
          type,
          goal,
          category_ids,
          recurrence_type: "MONTHLY",
          recurrence_day: 1,
        }),
        base_version: 0,
        snapshot_before: null,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringBudgets();
  }

  /** 更新固定預算並加入同步佇列 */
  async function updateRecurringBudget({
    id,
    name,
    type,
    goal,
    category_ids,
  }: {
    id: string;
    name: string;
    type: EntryType;
    goal: number;
    category_ids: string;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const existing = await recurringBudgetRepository.getById(id);
    if (!existing) throw new Error("RecurringBudget not found");

    const snapshot = JSON.stringify(existing);
    const updated: RecurringBudget = {
      ...existing,
      user_id,
      name,
      type,
      goal,
      category_ids,
      recurrence_type: existing.recurrence_type ?? "MONTHLY",
      recurrence_day: existing.recurrence_day ?? 1,
      version: existing.version + 1,
    };

    await recurringBudgetRepository.upsert(updated);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RBGT",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify({
          id,
          user_id,
          name,
          type,
          goal,
          category_ids,
          recurrence_type: updated.recurrence_type,
          recurrence_day: updated.recurrence_day,
        }),
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringBudgets();
  }

  /** 切換固定預算 is_active 狀態 */
  async function toggleRecurringBudgetActive(id: string): Promise<void> {
    const existing = await recurringBudgetRepository.getById(id);
    if (!existing) return;

    const snapshot = JSON.stringify(existing);
    const updated: RecurringBudget = {
      ...existing,
      is_active: existing.is_active ? 0 : 1,
      version: existing.version + 1,
    };

    await recurringBudgetRepository.upsert(updated);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RBGT",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify(updated),
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringBudgets();
  }

  /** 軟刪除固定記賬並加入同步佇列 */
  async function deleteRecurringTransaction(id: string): Promise<void> {
    const existing = await recurringTransactionRepository.getById(id);
    if (!existing) return;

    const snapshot = JSON.stringify(existing);

    await recurringTransactionRepository.update(id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RTXN",
        entity_id: id,
        action: "DELETE",
        payload: null,
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringTransactions();
  }

  /** 軟刪除固定預算並加入同步佇列 */
  async function deleteRecurringBudget(id: string): Promise<void> {
    const existing = await recurringBudgetRepository.getById(id);
    if (!existing) return;

    const snapshot = JSON.stringify(existing);

    await recurringBudgetRepository.update(id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "RBGT",
        entity_id: id,
        action: "DELETE",
        payload: null,
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecurringBudgets();
  }

  return {
    recurringTransactions,
    recurringBudgets,
    visibleRecurringTransactions,
    visibleRecurringBudgets,
    loadRecurringTransactions,
    loadRecurringBudgets,
    addRecurringTransaction,
    updateRecurringTransaction,
    toggleRecurringTransactionActive,
    addRecurringBudget,
    updateRecurringBudget,
    toggleRecurringBudgetActive,
    deleteRecurringTransaction,
    deleteRecurringBudget,
  };
});
