import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { assetRepository } from "../db/repositories/assetRepository";
import { categoryRepository } from "../db/repositories/categoryRepository";
import { syncQueueRepository } from "../db/repositories/syncQueueRepository";
import { userRepository } from "../db/repositories/userRepository";
import { useUserStore } from "./userStore";
import type { AssetRecord, Category } from "../types";

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

export const useAssetStore = defineStore("asset", () => {
  const userStore = useUserStore();

  // ── State ──────────────────────────────────────────────────
  const records = ref<AssetRecord[]>([]);
  const categories = ref<Category[]>([]);

  // ── Computed ───────────────────────────────────────────────
  const visibleRecords = computed(() =>
    records.value.filter(
      (r) => !r.is_deleted && r.user_id === userStore.activeUserId,
    ),
  );

  /** 資產專用分類（type === "ASSET"），依 sortOrder 排序 */
  const visibleCategories = computed(() =>
    categories.value
      .filter(
        (c) =>
          c.type === "ASSET" &&
          !c.is_deleted &&
          c.user_id === userStore.activeUserId,
      )
      .sort((a, b) => a.sortOrder - b.sortOrder),
  );

  /** category_id → 分類名稱（找不到時回傳「未知分類」，與 TransactionEditView 一致） */
  const categoryNameMap = computed(
    () => new Map(categories.value.map((c) => [c.id, c.name])),
  );

  function getCategoryName(categoryId: string): string {
    return categoryNameMap.value.get(categoryId) ?? "未知分類";
  }

  // ── Actions ────────────────────────────────────────────────
  async function loadRecords(): Promise<void> {
    records.value = await assetRepository.getAll();
  }

  async function loadCategories(): Promise<void> {
    categories.value = await categoryRepository.getAll();
  }

  async function getRecordById(id: string): Promise<AssetRecord | undefined> {
    return assetRepository.getById(id);
  }

  /** 新增資產紀錄並加入同步佇列 */
  async function addRecord({
    category_id,
    name,
    amount,
    date,
  }: {
    category_id: string;
    name: string;
    amount: number;
    date: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";
    const id = crypto.randomUUID();
    const normalizedDate = startOfDay(date);
    const created_at = Date.now();

    const asset: AssetRecord = {
      id,
      user_id,
      category_id,
      name: name.trim(),
      amount,
      date: normalizedDate,
      created_at,
      version: 1,
      is_deleted: 0,
    };

    await assetRepository.upsert(asset);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "AST",
        entity_id: id,
        action: "POST",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          name: asset.name,
          amount,
          date: normalizedDate,
          created_at,
        }),
        base_version: 0,
        snapshot_before: null,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecords();
  }

  /** 編輯既有資產紀錄並加入同步佇列 */
  async function updateRecord({
    id,
    category_id,
    name,
    amount,
    date,
  }: {
    id: string;
    category_id: string;
    name: string;
    amount: number;
    date: number;
  }): Promise<void> {
    const user = await userRepository.get();
    const user_id = user?.id || "";

    const existingRecord = await assetRepository.getById(id);
    if (!existingRecord) {
      throw new Error("Asset not found");
    }

    const snapshot = JSON.stringify(existingRecord);
    const normalizedDate = startOfDay(date);

    const updatedRecord: AssetRecord = {
      ...existingRecord,
      user_id,
      category_id,
      name: name.trim(),
      amount,
      date: normalizedDate,
      version: existingRecord.version + 1,
    };

    await assetRepository.upsert(updatedRecord);

    try {
      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: "AST",
        entity_id: id,
        action: "PUT",
        payload: JSON.stringify({
          id,
          user_id,
          category_id,
          name: updatedRecord.name,
          amount,
          date: normalizedDate,
          created_at: updatedRecord.created_at,
        }),
        base_version: existingRecord.version,
        snapshot_before: snapshot,
        created_at: Date.now(),
      });
    } catch (e) {
      console.error("Failed to enqueue sync operation", e);
    }

    await loadRecords();
  }

  /** 軟刪除資產紀錄並加入同步佇列 */
  async function deleteRecord(id: string): Promise<void> {
    const record = await assetRepository.getById(id);
    if (!record) {
      throw new Error("Asset not found");
    }

    const snapshot = JSON.stringify(record);

    await assetRepository.update(id, (current) => {
      if (!current) return null;
      return { ...current, is_deleted: 1, version: current.version + 1 };
    });

    await syncQueueRepository.add({
      mutation_id: crypto.randomUUID(),
      entity_type: "AST",
      entity_id: id,
      action: "DELETE",
      payload: null,
      base_version: record.version,
      snapshot_before: snapshot,
      created_at: Date.now(),
    });

    await loadRecords();
  }

  /** 清空所有資產紀錄（用於本機重置） */
  async function deleteAllAssets(): Promise<void> {
    await assetRepository.deleteAll();
    records.value = [];
    // 分類資料表由 transactionStore.deleteAllCategories 一併清空，這裡同步清掉本 store 的快取
    categories.value = [];
  }

  /**
   * 計算截至 asOf（含當日）各分類（category_id）的資產總額：
   * 同分類且同名稱視為同一資產，以最新一筆為準；不同名稱累加
   */
  function getSnapshot(asOf: number): Record<string, number> {
    const latest = new Map<string, AssetRecord>();
    for (const r of visibleRecords.value) {
      if (r.date > asOf) continue;
      const key = `${r.category_id}\u0000${r.name}`;
      const cur = latest.get(key);
      if (
        !cur ||
        r.date > cur.date ||
        (r.date === cur.date && r.created_at > cur.created_at)
      ) {
        latest.set(key, r);
      }
    }
    const result: Record<string, number> = {};
    for (const c of visibleCategories.value) result[c.id] = 0;
    for (const r of latest.values()) {
      result[r.category_id] = (result[r.category_id] ?? 0) + r.amount;
    }
    return result;
  }

  return {
    // state
    records,
    categories,
    // computed
    visibleRecords,
    visibleCategories,
    // actions
    getCategoryName,
    loadRecords,
    loadCategories,
    getRecordById,
    addRecord,
    updateRecord,
    deleteRecord,
    deleteAllAssets,
    getSnapshot,
  };
});
