import { ref, computed } from "vue";

export interface LockedAssetEntry {
  category_id: string;
  name: string;
}

const LS_LOCKED_KEY = "janote_locked_assets";

/** 「分類 + 名稱」視為同一項資產，key 組法與 assetStore.getSnapshotRecords 一致 */
export function assetKey(categoryId: string, name: string): string {
  return `${categoryId}\u0000${name.trim()}`;
}

function loadLocked(): LockedAssetEntry[] {
  try {
    const raw = localStorage.getItem(LS_LOCKED_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is LockedAssetEntry =>
        !!e &&
        typeof e.category_id === "string" &&
        typeof e.name === "string",
    );
  } catch {
    // 忽略讀取失敗（例如無痕模式或資料損毀），視為沒有任何不可動用的資產
    return [];
  }
}

/** 不可動用資產清單，存裝置本機 localStorage，不跟帳號同步 */
const lockedEntries = ref<LockedAssetEntry[]>(loadLocked());

const lockedKeySet = computed(
  () => new Set(lockedEntries.value.map((e) => assetKey(e.category_id, e.name))),
);

/**
 * 是否把不可動用的資產一併計入。只存記憶體，重新開啟 App 一律回到 false（只看可動用），
 * 總覽、趨勢、搜尋三頁共用這個狀態。
 */
export const showLocked = ref(false);

function saveLocked(): void {
  try {
    localStorage.setItem(LS_LOCKED_KEY, JSON.stringify(lockedEntries.value));
  } catch {
    // 忽略寫入失敗
  }
}

export function toggleShowLocked(): void {
  showLocked.value = !showLocked.value;
}

export function isAssetLocked(categoryId: string, name: string): boolean {
  return lockedKeySet.value.has(assetKey(categoryId, name));
}

/** 標記或取消標記某項資產為不可動用 */
export function setAssetLocked(
  categoryId: string,
  name: string,
  locked: boolean,
): void {
  const trimmed = name.trim();
  const key = assetKey(categoryId, trimmed);
  const others = lockedEntries.value.filter(
    (e) => assetKey(e.category_id, e.name) !== key,
  );
  lockedEntries.value = locked
    ? [...others, { category_id: categoryId, name: trimmed }]
    : others;
  saveLocked();
}

/** 清空不可動用清單（本機重置時使用） */
export function clearLockedAssets(): void {
  lockedEntries.value = [];
  saveLocked();
}
