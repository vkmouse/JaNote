<template>
  <section class="search-page">
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <div class="page-content page">
      <!-- Search bar + filter panel -->
      <div class="search-section">
        <div class="search-bar">
          <span class="search-icon" v-html="iconSearch" />
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜尋交易備註"
            autocomplete="off"
          />
          <button
            class="clear-btn"
            :class="{ invisible: !searchQuery }"
            @click="clearSearch"
            aria-label="清除搜尋"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            class="funnel-btn"
            @click="showFilterModal = true"
            aria-label="篩選"
          >
            <span class="funnel-icon" v-html="iconFunnel" />
            <span v-if="hasActiveFilterOnly" class="filter-dot" />
          </button>
        </div>

        <!-- Active filter summary -->
        <div v-if="hasActiveFilterOnly" class="filter-summary">
          {{ activeSummary }}
        </div>
      </div>

      <!-- Search Results -->
      <div class="search-results">
        <div v-if="!hasAnyFilter" class="empty-state">
          <p>輸入關鍵字或設定篩選條件</p>
        </div>

        <div v-else-if="groupedResults.length === 0" class="empty-state">
          <p>找不到符合條件的交易</p>
        </div>

        <div v-else class="daily-groups">
          <ListGroup
            v-for="group in groupedResults"
            :key="group.date"
          >
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <template #header-right>
              <span
                class="daily-total"
                :class="group.total >= 0 ? 'income' : 'expense'"
              >
                ${{
                  (group.total >= 0
                    ? group.total
                    : Math.abs(group.total)
                  ).toLocaleString()
                }}
              </span>
            </template>
            <ListItem
              v-for="transaction in group.transactions"
              :key="transaction.id"
              :swipeable="!isViewingShared"
              @delete="onSwipeDelete(transaction.id)"
              @edit="editTransaction(transaction.id)"
            >
              <div class="transaction-item">
                <div class="item-left">
                  <CategoryIcon
                    :category-name="getCategoryName(transaction.category_id)"
                    color-mode="type"
                    :entry-type="transaction.type"
                  />
                  <span class="category-name">
                    <span
                      v-for="(part, i) in highlightNote(transaction.note)"
                      :key="i"
                      :class="{ highlight: part.match }"
                      >{{ part.text }}</span
                    >
                    <span v-if="!transaction.note" class="no-note">無備註</span>
                  </span>
                </div>
                <div :class="['item-amount', transaction.type.toLowerCase()]">
                  ${{ transaction.type === "EXPENSE" ? "-" : ""
                  }}{{ transaction.amount.toLocaleString() }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
      </div>
    </div>

    <!-- Filter Modal -->
    <SearchFilterPanel
      :show="showFilterModal"
      v-model:timeMode="timeMode"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
      v-model:startDate="customStartDate"
      v-model:endDate="customEndDate"
      v-model:categoryIds="selectedCategoryIds"
      :categories="transactionStore.visibleCategories"
      @close="showFilterModal = false"
    />

    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除交易"
      message="確定要刪除這筆交易嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import type { Transaction } from "../types";
import CategoryIcon from "../components/CategoryIcon.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useSharedSwipeContext } from "../components/ListGroup.vue";
import SearchFilterPanel from "../components/SearchFilterPanel.vue";
import { iconFunnel, iconSearch } from "../utils/icons";

type TimeMode = "" | "monthly" | "yearly" | "custom";

interface DailyGroup {
  date: string;
  dateDisplay: string;
  total: number;
  transactions: Transaction[];
}

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const transactionStore = useTransactionStore();

useSharedSwipeContext();

// ── Search & filter state ─────────────────────────────────────────────────────

const searchQuery = ref("");
const timeMode = ref<TimeMode>("");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const customStartDate = ref(new Date().setHours(0, 0, 0, 0));
const customEndDate = ref(new Date().setHours(23, 59, 59, 999));
const selectedCategoryIds = ref<string[]>([]);

const inputRef = ref<HTMLInputElement | null>(null);
const isInitialized = ref(false);
const showFilterModal = ref(false);

const isViewingShared = computed(() => userStore.isViewingShared);

// ── Delete state ──────────────────────────────────────────────────────────────

const showDeleteConfirm = ref(false);
const deletingTransactionId = ref<string | null>(null);

// ── Actions ───────────────────────────────────────────────────────────────────

const clearSearch = () => {
  searchQuery.value = "";
  nextTick(() => inputRef.value?.focus());
};

const editTransaction = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/transaction/${id}/edit`);
};

const onSwipeDelete = (id: string) => {
  deletingTransactionId.value = id;
  showDeleteConfirm.value = true;
};

const confirmDelete = async () => {
  showDeleteConfirm.value = false;
  const id = deletingTransactionId.value;
  deletingTransactionId.value = null;
  if (!id || isViewingShared.value) return;
  await transactionStore.deleteTransaction(id);
};

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  deletingTransactionId.value = null;
};

const getCategoryName = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return category?.name || "其他";
};

// ── URL sync ──────────────────────────────────────────────────────────────────

function buildUrlQuery(): Record<string, string> {
  const q: Record<string, string> = {};
  if (searchQuery.value.trim()) q.q = searchQuery.value.trim();
  if (timeMode.value) q.mode = timeMode.value;
  if (timeMode.value === "monthly" || timeMode.value === "yearly") {
    q.year = String(selectedYear.value);
    if (timeMode.value === "monthly") q.month = String(selectedMonth.value);
  }
  if (timeMode.value === "custom") {
    q.start = String(customStartDate.value);
    q.end = String(customEndDate.value);
  }
  if (selectedCategoryIds.value.length > 0) {
    q.cat = selectedCategoryIds.value.join(",");
  }
  return q;
}

watch(
  [searchQuery, timeMode, selectedYear, selectedMonth, customStartDate, customEndDate, selectedCategoryIds],
  () => {
    if (!isInitialized.value) return;
    router.replace({ query: buildUrlQuery() });
  },
  { deep: true },
);

// ── Filter logic ──────────────────────────────────────────────────────────────

const hasAnyFilter = computed(
  () =>
    searchQuery.value.trim() !== "" ||
    timeMode.value !== "" ||
    selectedCategoryIds.value.length > 0,
);

// Active filter summary (time + category, excludes text query)
const hasActiveFilterOnly = computed(
  () => timeMode.value !== "" || selectedCategoryIds.value.length > 0,
);

const activeSummary = computed(() => {
  const parts: string[] = [];
  if (timeMode.value === "monthly") {
    parts.push(`${selectedYear.value}年${selectedMonth.value}月`);
  } else if (timeMode.value === "yearly") {
    parts.push(`${selectedYear.value}年`);
  } else if (timeMode.value === "custom") {
    const fmt = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    };
    parts.push(`${fmt(customStartDate.value)} ~ ${fmt(customEndDate.value)}`);
  }
  if (selectedCategoryIds.value.length > 0) {
    parts.push(`${selectedCategoryIds.value.length}個分類`);
  }
  return parts.join(" · ");
});

const searchResults = computed(() => {
  if (!hasAnyFilter.value) return [];

  return transactionStore.visibleTransactions.filter((t) => {
    // Time filter
    if (timeMode.value !== "") {
      const dateValue: unknown = t.date;
      const dateString =
        typeof dateValue === "string" ? dateValue.replace(/-/g, "/") : dateValue;
      const date = new Date(dateString as string | number);
      if (isNaN(date.getTime())) return false;

      if (timeMode.value === "monthly") {
        if (
          date.getFullYear() !== selectedYear.value ||
          date.getMonth() + 1 !== selectedMonth.value
        )
          return false;
      } else if (timeMode.value === "yearly") {
        if (date.getFullYear() !== selectedYear.value) return false;
      } else {
        const start = new Date(customStartDate.value);
        const end = new Date(customEndDate.value);
        if (date < start || date > end) return false;
      }
    }

    // Category filter
    if (selectedCategoryIds.value.length > 0) {
      if (!selectedCategoryIds.value.includes(t.category_id)) return false;
    }

    // Text filter
    if (searchQuery.value.trim()) {
      const query = searchQuery.value.trim().toLowerCase();
      if (!(t.note || "").toLowerCase().includes(query)) return false;
    }

    return true;
  });
});

const groupedResults = computed<DailyGroup[]>(() => {
  const groups = new Map<string, DailyGroup>();
  const sorted = [...searchResults.value].sort((a, b) => b.date - a.date);

  sorted.forEach((transaction) => {
    const date = new Date(transaction.date);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!groups.has(dateKey)) {
      const weekDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")} ${weekDays[date.getDay()]}`,
        total: 0,
        transactions: [],
      });
    }

    const group = groups.get(dateKey)!;
    group.transactions.push(transaction);
    if (transaction.type === "EXPENSE") {
      group.total -= transaction.amount;
    } else {
      group.total += transaction.amount;
    }
  });

  return Array.from(groups.values());
});

const highlightNote = (
  note: string,
): Array<{ text: string; match: boolean }> => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query || !note) return [{ text: note || "", match: false }];

  const parts: Array<{ text: string; match: boolean }> = [];
  const lowerNote = note.toLowerCase();
  let lastIndex = 0;

  let idx = lowerNote.indexOf(query, lastIndex);
  while (idx !== -1) {
    if (idx > lastIndex) {
      parts.push({ text: note.slice(lastIndex, idx), match: false });
    }
    parts.push({ text: note.slice(idx, idx + query.length), match: true });
    lastIndex = idx + query.length;
    idx = lowerNote.indexOf(query, lastIndex);
  }

  if (lastIndex < note.length) {
    parts.push({ text: note.slice(lastIndex), match: false });
  }

  return parts;
};

// ── Lifecycle ─────────────────────────────────────────────────────────────────

onMounted(async () => {
  await userStore.loadUser();
  inputRef.value?.focus();

  // Restore filter state from URL (Vue Router auto-decodes query values)
  const q = route.query;
  if (typeof q.q === "string") searchQuery.value = q.q;
  if (q.mode === "monthly" || q.mode === "yearly" || q.mode === "custom") {
    timeMode.value = q.mode;
  }
  if (typeof q.year === "string") {
    const y = parseInt(q.year);
    if (!isNaN(y)) selectedYear.value = y;
  }
  if (typeof q.month === "string") {
    const m = parseInt(q.month);
    if (!isNaN(m)) selectedMonth.value = m;
  }
  if (typeof q.start === "string") {
    const s = parseInt(q.start);
    if (!isNaN(s)) customStartDate.value = s;
  }
  if (typeof q.end === "string") {
    const e = parseInt(q.end);
    if (!isNaN(e)) customEndDate.value = e;
  }
  if (typeof q.cat === "string" && q.cat) {
    selectedCategoryIds.value = q.cat
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // Let the URL-restore writes settle before enabling the URL-sync watcher
  await nextTick();
  isInitialized.value = true;

  await Promise.all([
    transactionStore.loadTransactions(),
    transactionStore.loadCategories(),
  ]);
});
</script>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 24px;
  overflow-y: auto;
}

/* ── Search section ── */
.search-section {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-bar {
  height: 39px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--bg-card, #f5f5f5);
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  transition: border-color 0.15s;
}

.search-bar:focus-within {
  border-color: var(--text-primary, #333);
}

.search-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.search-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-disabled);
}

.clear-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--text-disabled, #bbb);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s;
}

.clear-btn.invisible {
  visibility: hidden;
  pointer-events: none;
}

/* ── Funnel button (inside search bar) ── */
.funnel-btn {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  color: var(--text-secondary);
  -webkit-tap-highlight-color: transparent;
}

.funnel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.funnel-icon :deep(svg) {
  width: 24px;
  height: 24px;
  stroke: currentColor;
}

.filter-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  background: #ef4444;
  border-radius: 50%;
  border: 1.5px solid var(--bg-card, #f5f5f5);
}

/* ── Active filter summary ── */
.filter-summary {
  font-size: 12px;
  color: var(--text-secondary, #888);
  padding: 0 4px;
}

/* ── Results ── */
.search-results {
  padding: 0 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  color: var(--text-disabled);
  font-size: 14px;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 4px;
}

.date-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.daily-total {
  font-size: 16px;
  font-weight: 700;
}

.daily-total.expense {
  color: var(--janote-expense);
}

.daily-total.income {
  color: var(--janote-income);
}

.transaction-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  position: relative;
  background: var(--bg-page);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
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

.no-note {
  color: var(--text-disabled);
}

.highlight {
  background: rgba(255, 200, 0, 0.4);
  border-radius: 2px;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 16px;
  color: var(--text-primary);
}
</style>
