import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { budgetRepository } from "../db/repositories/budgetRepository";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import { userRepository } from "../db/repositories/userRepository";
import { useUserStore } from "./userStore";
import type { Budget, EntryType } from "../types";

export const useBudgetStore = defineStore("budget", () => {
  const userStore = useUserStore();

  // ── State ──────────────────────────────────────────────────
  const budgets = ref<Budget[]>([]);

  // ── Computed ───────────────────────────────────────────────
  const visibleBudgets = computed(() =>
    budgets.value.filter(
      (b) => !b.is_deleted && b.user_id === userStore.activeUserId,
    ),
  );

  // ── Actions ────────────────────────────────────────────────
  async function loadBudgets(): Promise<void> {
    budgets.value = await budgetRepository.getAll();
  }

  /** 新增預算並加入同步佇列 */
  async function addBudget({
    name,
    type,
    goal,
    month_key,
    category_ids,
  }: {
    name: string;
    type: EntryType;
    goal: number;
    month_key: string;
    category_ids: string;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const id = crypto.randomUUID();

    const budget: Budget = {
      id,
      user_id,
      name,
      type,
      goal,
      month_key,
      category_ids,
      version: 1,
      is_deleted: 0,
    };

    await budgetRepository.upsert(budget);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "BGT",
        entity_id: id,
        action: "POST",
        payload: JSON.stringify({ id, user_id, name, type, goal, month_key, category_ids }),
        base_version: 0,
        snapshot_before: null,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadBudgets();
  }

  /** 更新預算並加入同步佇列 */
  async function updateBudget({
    id,
    name,
    type,
    goal,
    month_key,
    category_ids,
  }: {
    id: string;
    name: string;
    type: EntryType;
    goal: number;
    month_key: string;
    category_ids: string;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";

    const existing = await budgetRepository.getById(id);
    if (!existing) throw new Error("Budget not found");

    const snapshot = JSON.stringify(existing);

    const updated: Budget = {
      ...existing,
      user_id,
      name,
      type,
      goal,
      month_key,
      category_ids,
      version: existing.version + 1,
    };

    await budgetRepository.upsert(updated);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "BGT",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify({ id, user_id, name, type, goal, month_key, category_ids }),
        base_version: existing.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadBudgets();
  }

  /** 軟刪除預算並加入同步佇列 */
  async function deleteBudget(id: string): Promise<void> {
    const budget = await budgetRepository.getById(id);
    if (!budget) throw new Error("Budget not found");

    const snapshot = JSON.stringify(budget);

    await budgetRepository.update(id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "BGT",
      entity_id: id,
      action: "DELETE",
      payload: null,
      base_version: budget.version,
      snapshot_before: snapshot,
      created_at: Date.now(),
    });

    await loadBudgets();
  }

  /** 清空所有預算（用於本機重置） */
  async function deleteAllBudgets(): Promise<void> {
    await budgetRepository.deleteAll();
    budgets.value = [];
  }

  return {
    // state
    budgets,
    visibleBudgets,
    // actions
    loadBudgets,
    addBudget,
    updateBudget,
    deleteBudget,
    deleteAllBudgets,
  };
});
