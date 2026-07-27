import type {
  QuickEntryDraft,
  QuickEntryDraftsStore,
  QuickEntryRawText,
  QuickEntryRawTextStore,
  ExpenseDraft,
} from "../types";

const LS_RAW_TEXT_KEY = "janote_quick_entry_raw_text";
const LS_DRAFTS_KEY = "janote_quick_entry_drafts";

// ── 原始文字 ──────────────────────────────────────────
function loadRawTextStore(): QuickEntryRawTextStore {
  try {
    const raw = localStorage.getItem(LS_RAW_TEXT_KEY);
    if (raw) return JSON.parse(raw) as QuickEntryRawTextStore;
  } catch {
    // 忽略 JSON 解析錯誤
  }
  return {};
}

export function loadRawText(userId: string): QuickEntryRawText {
  return loadRawTextStore()[userId] ?? { content: "", updated_at: 0 };
}

export function saveRawText(userId: string, content: string): void {
  const store = loadRawTextStore();
  store[userId] = { content, updated_at: Date.now() };
  localStorage.setItem(LS_RAW_TEXT_KEY, JSON.stringify(store));
}

/** 送出成功後呼叫：清空該使用者的記事本文字。送出失敗時不要呼叫這個函式。 */
export function clearRawText(userId: string): void {
  const store = loadRawTextStore();
  delete store[userId];
  localStorage.setItem(LS_RAW_TEXT_KEY, JSON.stringify(store));
}

// ── 草稿 ─────────────────────────────────────────────
function loadDraftsStore(): QuickEntryDraftsStore {
  try {
    const raw = localStorage.getItem(LS_DRAFTS_KEY);
    if (raw) return JSON.parse(raw) as QuickEntryDraftsStore;
  } catch {
    // 忽略 JSON 解析錯誤
  }
  return {};
}

export function loadDrafts(userId: string): QuickEntryDraft[] {
  return loadDraftsStore()[userId] ?? [];
}

/**
 * 整批覆蓋該使用者的草稿清單（送出解析成功後呼叫）。
 * 舊草稿（不論是否處理完）一律被新結果取代，不跳確認、無法復原。
 */
export function replaceDrafts(userId: string, drafts: ExpenseDraft[]): void {
  const store = loadDraftsStore();
  store[userId] = drafts;
  localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(store));
}

/** 使用者確認存檔成功、或手動刪除單筆草稿時呼叫 */
export function removeDraft(userId: string, draftId: string): void {
  const store = loadDraftsStore();
  const list = store[userId] ?? [];
  store[userId] = list.filter((d) => d.draft_id !== draftId);
  localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(store));
}

/** 手動整批清空（例如使用者按「清空草稿」） */
export function clearDrafts(userId: string): void {
  const store = loadDraftsStore();
  delete store[userId];
  localStorage.setItem(LS_DRAFTS_KEY, JSON.stringify(store));
}
