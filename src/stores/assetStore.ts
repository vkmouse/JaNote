import { ref } from "vue";
import { defineStore } from "pinia";
import type { AssetCategory, AssetRecord } from "../types";

export const ASSET_CATEGORIES: AssetCategory[] = [
  "國內證券",
  "海外證券",
  "基金",
  "約當現金",
  "信託",
];

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

// 僅存記憶體，不寫入 Dexie 與同步佇列，重新整理即清空
export const useAssetStore = defineStore("asset", () => {
  // ── State ──────────────────────────────────────────────────
  const records = ref<AssetRecord[]>([]);
  let seqCounter = 0;

  // ── Actions ────────────────────────────────────────────────
  /** 新增資產紀錄 */
  function addRecord(input: {
    category: AssetCategory;
    name: string;
    amount: number;
    date: number;
  }): void {
    seqCounter++;
    records.value.push({
      id: crypto.randomUUID(),
      category: input.category,
      name: input.name.trim(),
      amount: input.amount,
      date: startOfDay(input.date),
      seq: seqCounter,
    });
  }

  /** 依 id 取得單筆資產紀錄 */
  function getRecordById(id: string): AssetRecord | undefined {
    return records.value.find((r) => r.id === id);
  }

  /** 編輯既有資產紀錄 */
  function updateRecord(input: {
    id: string;
    category: AssetCategory;
    name: string;
    amount: number;
    date: number;
  }): void {
    const record = records.value.find((r) => r.id === input.id);
    if (!record) return;
    record.category = input.category;
    record.name = input.name.trim();
    record.amount = input.amount;
    record.date = startOfDay(input.date);
  }

  /** 刪除資產紀錄 */
  function deleteRecord(id: string): void {
    const idx = records.value.findIndex((r) => r.id === id);
    if (idx !== -1) records.value.splice(idx, 1);
  }

  /**
   * 計算截至 asOf（含當日）各分類的資產總額：
   * 同分類且同名稱視為同一資產，以最新一筆為準；不同名稱累加
   */
  function getSnapshot(asOf: number): Record<AssetCategory, number> {
    const latest = new Map<string, AssetRecord>();
    for (const r of records.value) {
      if (r.date > asOf) continue;
      const key = `${r.category}\u0000${r.name}`;
      const cur = latest.get(key);
      if (!cur || r.date > cur.date || (r.date === cur.date && r.seq > cur.seq)) {
        latest.set(key, r);
      }
    }
    const result = Object.fromEntries(
      ASSET_CATEGORIES.map((name) => [name, 0]),
    ) as Record<AssetCategory, number>;
    for (const r of latest.values()) result[r.category] += r.amount;
    return result;
  }

  return {
    // state
    records,
    // actions
    addRecord,
    getRecordById,
    updateRecord,
    deleteRecord,
    getSnapshot,
  };
});
