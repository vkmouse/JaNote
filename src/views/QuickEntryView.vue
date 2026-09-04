<template>
  <section class="quick-entry-page">
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <span class="nav-title">快速記帳</span>
      </template>
    </TopNavigation>

    <div class="page-content page">
      <!-- 記事本輸入區 -->
      <div class="notebook-section">
        <textarea
          v-model="rawText"
          class="quick-entry-textarea"
          placeholder="貼上你的消費紀錄"
          maxlength="2000"
          rows="4"
          @input="onTextInput"
        />
        <p v-if="submitError" class="quick-entry-error" role="alert">
          {{ submitError }}
        </p>

        <button
          class="submit-btn"
          :disabled="!canSubmit || isSubmitting"
          @click="handleSubmit"
        >
          <span v-if="isSubmitting" class="spinner" aria-hidden="true"></span>
          <span v-else>送出解析</span>
        </button>
      </div>

      <!-- 未完成記帳草稿清單 -->
      <div class="draft-list">
        <div v-if="groupedDrafts.length > 0" class="daily-groups">
          <ListGroup v-for="group in groupedDrafts" :key="group.date">
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <template #header-right>
              <span class="daily-total">
                小計 ${{ group.total.toLocaleString() }}
              </span>
            </template>
            <ListItem
              v-for="draft in group.drafts"
              :key="draft.draft_id"
              :swipeable="true"
              :delete-only="true"
              @delete="onSwipeDeleteDraft(draft.draft_id)"
              @item-click="openDraft(draft)"
            >
              <div class="draft-item">
                <div class="item-left">
                  <CategoryIcon
                    :category-name="getCategoryName(draft.category_id)"
                    color-mode="type"
                    entry-type="EXPENSE"
                  />
                  <span class="category-name">{{ draft.note || "無備註" }}</span>
                </div>
                <div class="item-amount expense">
                  -${{ draft.amount.toLocaleString() }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
        <div v-else class="quick-entry-empty-text">
          <p>尚無未完成的記帳草稿</p>
        </div>
      </div>
    </div>

    <!-- Delete Draft Confirm Modal -->
    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除草稿"
      message="確定要刪除這筆未完成的記帳草稿嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDeleteDraft"
      @cancel="cancelDeleteDraft"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CategoryIcon from "../components/CategoryIcon.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import { setOnTransactionCreated } from "../utils/transactionEditBridge";
import { authorizedFetch } from "../services/api";
import {
  loadRawText,
  saveRawText,
  clearRawText,
  loadDrafts,
  replaceDrafts,
  removeDraft,
} from "../utils/quickEntryStorage";
import type { DraftRequest, DraftResponse, ExpenseDraft } from "../types";

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();

useSharedSwipeContext();

// ── 記事本輸入區狀態 ────────────────────────────────────────
const rawText = ref("");
const isSubmitting = ref(false);
const submitError = ref<string | null>(null);

const canSubmit = computed(() => rawText.value.trim().length > 0);

// 每次輸入 debounce 300ms 寫入 localStorage
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function onTextInput() {
  // 使用者重新輸入文字時，先前的送出錯誤自動清掉
  if (submitError.value) submitError.value = null;

  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveRawText(userStore.currentUserId, rawText.value);
  }, 300);
}

function mapErrorToMessage(errorCode: string | undefined): string {
  switch (errorCode) {
    case "TEXT_TOO_LONG":
      return "文字太長了，麻煩縮短到 2000 字以內再送出";
    case "AI_PROVIDER_ERROR":
      return "AI 暫時忙不過來，請稍後再試一次";
    case "INTERNAL_ERROR":
    default:
      return "發生未預期的錯誤，請稍後再試";
  }
}

// 每個請求的隨機起跑延遲上限（毫秒），三次各自獨立抽亂數，不共用同一個延遲
const RETRY_JITTER_MAX_MS = 1000;
// 單次請求逾時（毫秒）
const REQUEST_TIMEOUT_MS = 30000;

/** 等待 ms 毫秒；若 signal 在等待中被 abort，直接以 AbortError reject */
function delay(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      },
      { once: true },
    );
  });
}

class DraftRequestError extends Error {
  errorCode?: string;
  constructor(message: string, errorCode?: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

/** 單次「延遲後打 /api/drafts」的嘗試：延遲被取消或請求失敗都會 throw */
async function attemptDraftRequest(
  rawText: string,
  signal: AbortSignal,
): Promise<DraftResponse> {
  await delay(Math.random() * RETRY_JITTER_MAX_MS, signal);

  const response = await authorizedFetch("/api/drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ raw_text: rawText } satisfies DraftRequest),
    signal,
  });

  if (!response.ok) {
    let errorCode: string | undefined;
    try {
      const errorBody = await response.json();
      errorCode = errorBody?.error_code;
    } catch {
      // 忽略錯誤內容解析失敗
    }
    throw new DraftRequestError(`request failed with ${response.status}`, errorCode);
  }

  return (await response.json()) as DraftResponse;
}

async function handleSubmit() {
  if (!canSubmit.value || isSubmitting.value) return;

  isSubmitting.value = true;
  submitError.value = null;

  const trimmedText = rawText.value.trim();
  const controllers = [new AbortController(), new AbortController(), new AbortController()];
  const timeoutIds = controllers.map((controller) =>
    setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS),
  );

  try {
    const data = await Promise.any(
      controllers.map((controller) => attemptDraftRequest(trimmedText, controller.signal)),
    );

    // 有一個成功了，其餘還在飛（或還在隨機延遲中）的請求直接取消
    controllers.forEach((controller) => {
      if (!controller.signal.aborted) controller.abort();
    });

    replaceDrafts(userStore.currentUserId, data.drafts);
    drafts.value = data.drafts;
    clearRawText(userStore.currentUserId);
    rawText.value = "";
  } catch (err) {
    // 三次全部失敗（AggregateError）或其他未預期錯誤
    const errors: unknown[] = err instanceof AggregateError ? err.errors : [err];
    const draftError = errors.find(
      (e: unknown): e is DraftRequestError => e instanceof DraftRequestError,
    );
    submitError.value = draftError
      ? mapErrorToMessage(draftError.errorCode)
      : "連線逾時，請確認網路後重試";
  } finally {
    timeoutIds.forEach(clearTimeout);
    isSubmitting.value = false;
  }
}

// ── 草稿清單狀態 ─────────────────────────────────────────────
const drafts = ref<ExpenseDraft[]>([]);

interface DraftGroup {
  date: string;
  dateDisplay: string;
  total: number;
  drafts: ExpenseDraft[];
}

const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];

function formatDateDisplay(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}/${month}/${day} ${weekDays[d.getDay()]}`;
}

const groupedDrafts = computed<DraftGroup[]>(() => {
  const groups = new Map<string, DraftGroup>();
  const sorted = [...drafts.value].sort((a, b) => b.date - a.date);

  sorted.forEach((draft) => {
    const d = new Date(draft.date);
    const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (!groups.has(dateKey)) {
      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: formatDateDisplay(d),
        total: 0,
        drafts: [],
      });
    }
    const group = groups.get(dateKey)!;
    group.drafts.push(draft);
    group.total += draft.amount;
  });

  return Array.from(groups.values());
});

function getCategoryName(categoryId: string | null): string {
  if (!categoryId) return "其他";
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return category?.name || "其他";
}

function openDraft(draft: ExpenseDraft) {
  // 新增成功後刪除這筆草稿
  setOnTransactionCreated(() => {
    removeDraft(userStore.currentUserId, draft.draft_id);
  });

  router.push({
    name: "transaction-new",
    state: {
      prefill: {
        note: draft.note,
        amount: draft.amount,
        category_id: draft.category_id,
        date: draft.date,
      },
    },
  });
}

// ── 刪除草稿 ─────────────────────────────────────────────────
const showDeleteConfirm = ref(false);
const deletingDraftId = ref<string | null>(null);

function onSwipeDeleteDraft(draftId: string) {
  deletingDraftId.value = draftId;
  showDeleteConfirm.value = true;
}

function confirmDeleteDraft() {
  showDeleteConfirm.value = false;
  const id = deletingDraftId.value;
  deletingDraftId.value = null;
  if (!id) return;
  removeDraft(userStore.currentUserId, id);
  drafts.value = drafts.value.filter((d) => d.draft_id !== id);
}

function cancelDeleteDraft() {
  showDeleteConfirm.value = false;
  deletingDraftId.value = null;
}

// ── Lifecycle ──────────────────────────────────────────────
onMounted(async () => {
  // 共享帳號檢視者不能使用快速記帳
  if (userStore.isViewingShared) {
    router.replace("/transactions");
    return;
  }

  await userStore.loadUser();
  await transactionStore.loadCategories();

  const userId = userStore.currentUserId;
  rawText.value = loadRawText(userId).content;
  drafts.value = loadDrafts(userId);
});
</script>

<style scoped>
.quick-entry-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── 記事本輸入區 ─────────────────────────────────────────── */
.notebook-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quick-entry-textarea {
  width: 100%;
  resize: vertical;
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  padding: 12px 14px;
  font-size: 15px;
  line-height: 1.6;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-page);
  outline: none;
  transition: border-color 0.15s;
}

.quick-entry-textarea:focus {
  border-color: var(--text-primary);
}

.quick-entry-textarea::placeholder {
  color: var(--text-disabled);
}

.quick-entry-error {
  margin: 0;
  padding: 8px 12px;
  font-size: 13px;
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
  border-radius: 8px;
}

.submit-btn {
  height: 46px;
  border: none;
  border-radius: 12px;
  background: var(--janote-action);
  color: var(--text-light);
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s;
}

.submit-btn:active:not(:disabled) {
  opacity: 0.85;
}

.submit-btn:disabled {
  background: #e9ecef;
  color: #adb5bd;
  cursor: not-allowed;
}

.spinner {
  width: 18px;
  height: 18px;
  border: 2.5px solid rgba(255, 255, 255, 0.4);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* ── 草稿清單 ─────────────────────────────────────────────── */
.draft-list {
  display: flex;
  flex-direction: column;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.date-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.daily-total {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.draft-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  background: var(--bg-page);
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  gap: 8px;
}

.draft-item:active {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.category-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--janote-expense);
}

.quick-entry-empty-text {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 8px;
  color: var(--text-disabled);
  font-size: 14px;
}
</style>
