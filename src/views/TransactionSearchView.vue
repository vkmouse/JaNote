<template>
  <section class="search-page">
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <div class="search-bar">
          <svg
            class="search-icon"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜尋交易備註"
            autocomplete="off"
          />
          <button
            v-if="searchQuery"
            class="clear-btn"
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
        </div>
      </template>
      <template #right><NavAvatar /></template>
    </TopNavigation>

    <div class="page-content page">
      <!-- Search Results -->
      <div class="search-results">
        <div v-if="!searchQuery.trim()" class="empty-state">
          <p>輸入關鍵字搜尋交易紀錄</p>
        </div>

        <div v-else-if="groupedResults.length === 0" class="empty-state">
          <p>找不到「{{ searchQuery }}」相關的交易</p>
        </div>

        <div v-else class="daily-groups">
          <div
            v-for="group in groupedResults"
            :key="group.date"
            class="daily-group"
          >
            <!-- Date Header -->
            <div class="date-header">
              <span class="date-title">{{ group.dateDisplay }}</span>
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
            </div>

            <!-- Transaction Items -->
            <div class="transaction-items">
              <div
                v-for="(transaction, index) in group.transactions"
                :key="transaction.id"
                class="transaction-item"
                @click="!isViewingShared && editTransaction(transaction.id)"
              >
                <div class="item-left">
                  <div
                    class="category-icon"
                    v-html="getCategoryIconSvg(transaction.category_id)"
                  ></div>
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
                <div
                  v-if="index < group.transactions.length - 1"
                  class="item-divider"
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <BottomTabBar
      :show-add-button="true"
      :add-disabled="isViewingShared"
      @add="goToNewTransaction"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import NavAvatar from "../components/NavAvatar.vue";
import BottomTabBar from "../components/BottomTabBar.vue";
import type { Transaction } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";

interface DailyGroup {
  date: string;
  dateDisplay: string;
  total: number;
  transactions: Transaction[];
}

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();
const searchQuery = ref("");
const inputRef = ref<HTMLInputElement | null>(null);

const isViewingShared = computed(() => userStore.isViewingShared);

const clearSearch = () => {
  searchQuery.value = "";
  nextTick(() => inputRef.value?.focus());
};

const goToNewTransaction = () => {
  router.push("/transactions/new");
};

const editTransaction = (id: string) => {
  router.push(`/transaction/${id}/edit`);
};

const getCategoryIconSvg = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return getCategoryIcon(category?.name || "其他");
};

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [];

  return transactionStore.visibleTransactions.filter((t) => {
    return (t.note || "").toLowerCase().includes(query);
  });
});

const groupedResults = computed<DailyGroup[]>(() => {
  const groups = new Map<string, DailyGroup>();

  const sorted = [...searchResults.value].sort((a, b) => b.date - a.date);

  sorted.forEach((transaction) => {
    const date = new Date(transaction.date);
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    if (!groups.has(dateKey)) {
      const weekDays = [
        "星期日",
        "星期一",
        "星期二",
        "星期三",
        "星期四",
        "星期五",
        "星期六",
      ];
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      const weekDay = weekDays[date.getDay()];

      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: `${year}/${month}/${day} ${weekDay}`,
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

onMounted(async () => {
  await userStore.loadUser();

  // Focus the search input immediately so iOS shows keyboard
  // (must happen as close to the user gesture as possible)
  inputRef.value?.focus();

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

/* search-bar styling remains for use inside TopNavigation */

.search-bar {
  flex: 1;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  margin: 0 8px;
  background: var(--bg-card, #f5f5f5);
  border: 1.5px solid var(--border-primary);
  border-radius: 20px;
  transition: border-color 0.15s;
}

.search-bar:focus-within {
  border-color: var(--text-primary, #333);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
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

.clear-btn:hover {
  background: var(--text-secondary, #888);
}

/* ── Page Content ── */
.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 180px;
  overflow-y: auto;
}

.search-results {
  padding: 0 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 300px;
  color: var(--text-disabled);
  font-size: 14px;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 16px;
}

.daily-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
}

/* Date Header */
.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-page);
  border-bottom: 2px solid var(--border-primary);
}

.date-title {
  font-size: 14px;
  font-weight: 600;
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

/* Transaction Items */
.transaction-items {
  background: var(--bg-page);
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

.transaction-item:hover {
  background: #f9f9f9;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.category-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}

.category-icon :deep(svg) {
  width: 24px;
  height: 24px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.category-name {
  font-size: 15px;
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

.item-divider {
  position: absolute;
  bottom: 0;
  left: 72px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}
</style>
