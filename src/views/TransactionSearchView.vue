<template>
  <section class="search-page">
    <!-- Top Navigation Bar -->
    <TopNavigation mode="back-avatar" @user-changed="onUserChanged" />

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

    <!-- Bottom: Search Input + X Button -->
    <div class="floating-actions-container">
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
      </div>

      <!-- X Button: clear input or go back -->
      <button class="close-fab" @click="onCloseClick" aria-label="清除或返回">
        <svg
          width="22"
          height="22"
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import type { Transaction, Category } from "../types";
import { transactionRepository } from "../repositories/transactionRepository";
import { categoryRepository } from "../repositories/categoryRepository";
import { userRepository } from "../repositories/userRepository";
import { getCategoryIcon } from "../utils/categoryIcons";

interface SelectedUser {
  id: string;
  email: string;
}

interface DailyGroup {
  date: string;
  dateDisplay: string;
  total: number;
  transactions: Transaction[];
}

const router = useRouter();
const transactions = ref<Transaction[]>([]);
const categories = ref<Category[]>([]);
const searchQuery = ref("");
const inputRef = ref<HTMLInputElement | null>(null);
const currentUserId = ref<string>("");
const selectedUser = ref<SelectedUser | null>(null);

const activeUserId = computed(() => {
  return selectedUser.value?.id || currentUserId.value;
});

const isViewingShared = computed(() => {
  return selectedUser.value !== null;
});

const onUserChanged = (user: SelectedUser | null) => {
  selectedUser.value = user;
};

const onCloseClick = () => {
  if (searchQuery.value) {
    searchQuery.value = "";
    nextTick(() => inputRef.value?.focus());
  } else {
    router.back();
  }
};

const editTransaction = (id: string) => {
  router.push(`/transaction/${id}/edit`);
};

const getCategoryIconSvg = (categoryId: string): string => {
  const category = categories.value.find((c) => c.id === categoryId);
  return getCategoryIcon(category?.name || "其他");
};

// Fuzzy search results filtered by user
const searchResults = computed<Transaction[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  if (!query) return [];

  return transactions.value.filter((t) => {
    if (t.is_deleted) return false;
    if (activeUserId.value && t.user_id !== activeUserId.value) return false;
    return (t.note || "").toLowerCase().includes(query);
  });
});

// Group results by date, sorted by date descending
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

// Highlight matching parts in note text
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
  const user = await userRepository.get();
  if (user) {
    currentUserId.value = user.id;
  }

  const [allTransactions, allCategories] = await Promise.all([
    transactionRepository.getAll(),
    categoryRepository.getAll(),
  ]);
  transactions.value = allTransactions;
  categories.value = allCategories;

  // Auto-focus the search input
  await nextTick();
  inputRef.value?.focus();
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
  padding-bottom: 100px;
  overflow-y: auto;
}

/* Search Results */
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
  border-radius: 16px;
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
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
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

/* Floating Actions Container */
.floating-actions-container {
  position: fixed;
  bottom: 24px;
  left: 16px;
  right: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  z-index: 1000;
}

/* Search Bar */
.search-bar {
  flex: 1;
  height: 52px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  background: white;
  border: 2px solid var(--border-primary);
  border-radius: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.search-icon {
  width: 20px;
  height: 20px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
}

.search-input::placeholder {
  color: var(--text-disabled);
}

/* Close / X Button */
.close-fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--bg-card, #fff);
  border: 2px solid var(--border-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  flex-shrink: 0;
  padding: 0;
  color: var(--text-primary);
}

.close-fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.close-fab:active {
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 480px) {
  .daily-group {
    border-radius: 12px;
  }

  .category-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
}
</style>
