<template>
  <section class="transactions-page">
    <!-- Top Navigation Bar -->
    <TopNavigation>
      <template #left><NavMenu /></template>
      <template #center>
        <div class="month-display" @click="showMonthPicker = true">
          <span>{{ currentMonthDisplay }}</span>
        </div>
      </template>
      <template #right><NavAvatar /></template>
    </TopNavigation>

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />

    <div class="page-content page">
      <!-- Stats + Summary Button -->
      <div class="stats-wrapper">
        <StatsChart
          :monthlyExpense="monthlyExpense"
          :monthlyIncome="monthlyIncome"
          :balance="balance"
          :expensePercentage="expensePercentage"
          :incomePercentage="incomePercentage"
        />
      </div>

      <!-- Daily Transaction List -->
      <div class="transaction-list">
        <div v-if="groupedTransactions.length === 0" class="empty-state">
          <p>暫無交易記錄</p>
        </div>

        <div v-else class="daily-groups">
          <div
            v-for="group in groupedTransactions"
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
                class="transaction-item-wrapper"
                @touchstart="handleTouchStart($event, transaction.id)"
                @touchmove="handleTouchMove($event, transaction.id)"
                @touchend="handleTouchEnd($event, transaction.id)"
                @mousedown="handleMouseDown($event, transaction.id)"
                @mousemove="handleMouseMove($event, transaction.id)"
                @mouseup="handleMouseUp(transaction.id)"
                @mouseleave="handleMouseLeave(transaction.id)"
              >
                <div
                  class="transaction-item"
                  :style="{
                    transform: `translateX(${swipeState[transaction.id]?.offset || 0}px)`,
                  }"
                  @click="
                    !swipeState[transaction.id]?.hasSwipped &&
                    !isViewingShared &&
                    editTransaction(transaction.id)
                  "
                >
                  <div class="item-left">
                    <div
                      class="category-icon"
                      v-html="getCategoryIconSvg(transaction.category_id)"
                    ></div>
                    <span class="category-name">{{
                      transaction.note || "無備註"
                    }}</span>
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
                <button
                  class="delete-btn"
                  @click.stop="deleteTransaction(transaction.id)"
                  :disabled="isViewingShared"
                  :style="{
                    opacity: swipeState[transaction.id]?.showDelete ? 1 : 0,
                    pointerEvents:
                      swipeState[transaction.id]?.showDelete && !isViewingShared
                        ? 'auto'
                        : 'none',
                  }"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="white"
                    stroke-width="2"
                  >
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path
                      d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                    ></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Navigation -->
      <div v-if="!isViewingShared" class="bottom-nav">

        <!-- Center Capsule: Search + Summary + Budget -->
        <div class="capsule-group">
          <button class="capsule-btn" @click="goToSearch" aria-label="搜尋">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </button>

          <div class="capsule-divider"></div>

          <button class="capsule-btn" @click="goToSummary" aria-label="總覽">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          </button>

          <div class="capsule-divider"></div>

          <button class="capsule-btn" @click="goToBudget" aria-label="預算">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
          </button>
        </div>

        <!-- Right Capsule: Add -->
        <div class="capsule-group">
          <button class="capsule-btn add-btn" @click="goToNewTransaction" aria-label="新增交易">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
        </div>

      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import StatsChart from "../components/StatsChart.vue";
import type { Transaction } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);

// Swipe-to-delete state
const swipeState = ref<
  Record<
    string,
    {
      offset: number;
      startX: number;
      startY: number;
      showDelete: boolean;
      isDragging: boolean;
      hasSwipped: boolean;
      isHorizontal: boolean | null;
    }
  >
>({});

interface DailyGroup {
  date: string;
  dateDisplay: string;
  total: number;
  transactions: Transaction[];
}

const currentMonthDisplay = computed(() => {
  return `${selectedYear.value}\u5e74${selectedMonth.value}\u6708`;
});

const isViewingShared = computed(() => userStore.isViewingShared);

const filteredTransactions = computed(() => {
  return transactionStore.visibleTransactions.filter((t) => {
    const date = new Date(t.date);
    return (
      date.getFullYear() === selectedYear.value &&
      date.getMonth() + 1 === selectedMonth.value
    );
  });
});

const monthlyExpense = computed(() => {
  return filteredTransactions.value
    .filter((t) => t.type === "EXPENSE")
    .reduce((sum, t) => sum + t.amount, 0);
});

const monthlyIncome = computed(() => {
  return filteredTransactions.value
    .filter((t) => t.type === "INCOME")
    .reduce((sum, t) => sum + t.amount, 0);
});

const balance = computed(() => {
  return monthlyIncome.value - monthlyExpense.value;
});

const expensePercentage = computed(() => {
  const total = monthlyExpense.value + monthlyIncome.value;
  if (total === 0) return 0;
  return (monthlyExpense.value / total) * 100;
});

const incomePercentage = computed(() => {
  const total = monthlyExpense.value + monthlyIncome.value;
  if (total === 0) return 0;
  return (monthlyIncome.value / total) * 100;
});

const groupedTransactions = computed<DailyGroup[]>(() => {
  const groups = new Map<string, DailyGroup>();

  const sortedTransactions = [...filteredTransactions.value].sort(
    (a, b) => b.date - a.date,
  );

  sortedTransactions.forEach((transaction) => {
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

const loadTransactions = async () => {
  await transactionStore.loadTransactions();
};

const loadCategories = async () => {
  await transactionStore.loadCategories();
};

const getCategoryIconSvg = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find((c) => c.id === categoryId);
  return getCategoryIcon(category?.name || "其他");
};

const goToNewTransaction = () => {
  router.push("/transactions/new");
};

const goToSearch = () => {
  router.push("/transactions/search");
};

const goToSummary = () => {
  router.push("/transactions/summary");
};

const goToBudget = () => {
  router.push("/budget");
};

const editTransaction = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/transaction/${id}/edit`);
};

// Swipe-to-delete handlers (Touch)
const handleTouchStart = (event: TouchEvent, id: string) => {
  const touch = event.touches[0];
  if (!touch) return;

  Object.keys(swipeState.value).forEach((key) => {
    if (key !== id && swipeState.value[key]) {
      swipeState.value[key].offset = 0;
      swipeState.value[key].showDelete = false;
      swipeState.value[key].hasSwipped = false;
    }
  });

  swipeState.value[id] = {
    offset: swipeState.value[id]?.offset || 0,
    startX: touch.clientX,
    startY: touch.clientY,
    showDelete: swipeState.value[id]?.showDelete || false,
    isDragging: true,
    hasSwipped: false,
    isHorizontal: swipeState.value[id]?.offset !== 0 ? true : null,
  };
};

const handleTouchMove = (event: TouchEvent, id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return;

  const touch = event.touches[0];
  if (!touch) return;
  const currentX = touch.clientX;
  const currentY = touch.clientY;
  const startX = swipeState.value[id].startX;
  const startY = swipeState.value[id].startY;
  const diff = currentX - startX;

  if (swipeState.value[id].isHorizontal === null) {
    const dx = Math.abs(currentX - startX);
    const dy = Math.abs(currentY - startY);
    if (dx < 3 && dy < 3) return;
    swipeState.value[id].isHorizontal = dx >= dy;
  }

  if (!swipeState.value[id].isHorizontal) return;

  (event.currentTarget as HTMLElement).style.touchAction = "none";

  if (Math.abs(diff) > 5) {
    swipeState.value[id].hasSwipped = true;
  }

  const currentOffset = swipeState.value[id].offset;
  let newOffset = currentOffset + diff;
  newOffset = Math.min(0, Math.max(newOffset, -80));

  swipeState.value[id].offset = newOffset;
  swipeState.value[id].showDelete = newOffset < -40;
  swipeState.value[id].startX = currentX;
};

const handleTouchEnd = (event: TouchEvent, id: string) => {
  (event.currentTarget as HTMLElement).style.touchAction = "pan-y";

  if (!swipeState.value[id]) return;

  swipeState.value[id].isDragging = false;

  if (swipeState.value[id].offset < -40) {
    swipeState.value[id].offset = -80;
    swipeState.value[id].showDelete = true;
  } else {
    swipeState.value[id].offset = 0;
    swipeState.value[id].showDelete = false;
  }
};

// Mouse handlers for desktop
const handleMouseDown = (event: MouseEvent, id: string) => {
  Object.keys(swipeState.value).forEach((key) => {
    if (key !== id && swipeState.value[key]) {
      swipeState.value[key].offset = 0;
      swipeState.value[key].showDelete = false;
      swipeState.value[key].hasSwipped = false;
    }
  });

  swipeState.value[id] = {
    offset: swipeState.value[id]?.offset || 0,
    startX: event.clientX,
    startY: event.clientY,
    showDelete: swipeState.value[id]?.showDelete || false,
    isDragging: true,
    hasSwipped: false,
    isHorizontal: swipeState.value[id]?.offset !== 0 ? true : null,
  };
};

const handleMouseMove = (event: MouseEvent, id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return;

  const currentX = event.clientX;
  const startX = swipeState.value[id].startX;
  const diff = currentX - startX;

  if (Math.abs(diff) > 5) {
    swipeState.value[id].hasSwipped = true;
  }

  const currentOffset = swipeState.value[id].offset;
  let newOffset = currentOffset + diff;
  newOffset = Math.min(0, Math.max(newOffset, -80));

  swipeState.value[id].offset = newOffset;
  swipeState.value[id].showDelete = newOffset < -40;
  swipeState.value[id].startX = currentX;
};

const handleMouseUp = (id: string) => {
  if (!swipeState.value[id]) return;

  swipeState.value[id].isDragging = false;

  if (swipeState.value[id].offset < -40) {
    swipeState.value[id].offset = -80;
    swipeState.value[id].showDelete = true;
  } else {
    swipeState.value[id].offset = 0;
    swipeState.value[id].showDelete = false;
  }
};

const handleMouseLeave = (id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return;
  handleMouseUp(id);
};

const deleteTransaction = async (id: string) => {
  if (isViewingShared.value) return;

  if (confirm("確定要刪除這筆交易嗎？")) {
    const transaction = transactionStore.transactions.find((t) => t.id === id);
    if (transaction) {
      await transactionStore.deleteTransaction(id);
      delete swipeState.value[id];
    }
  } else {
    if (swipeState.value[id]) {
      swipeState.value[id].offset = 0;
      swipeState.value[id].showDelete = false;
      swipeState.value[id].hasSwipped = false;
    }
  }
};

onMounted(async () => {
  await userStore.loadUser();
  loadTransactions();
  loadCategories();
});
</script>

<style scoped>
.transactions-page {
  display: flex;
  flex-direction: column;
}

.month-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.month-display:hover {
  opacity: 0.7;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}

.stats-wrapper {
  position: relative;
}

/* Transaction List */
.transaction-list {
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
}

.daily-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}

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

.transaction-items {
  background: var(--bg-page);
}

.transaction-item-wrapper {
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: pan-y;
}

.transaction-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.3s ease-out;
  position: relative;
  background: var(--bg-page);
  z-index: 1;
}

.transaction-item:hover {
  background: #f9f9f9;
}

.delete-btn {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--janote-action);
  border: none;
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 0;
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

/* ─── Bottom Navigation ─── */
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 0 16px 16px;
  z-index: 1000;
  pointer-events: none;
}

/* Each capsule group — matches the app's card language exactly */
.capsule-group {
  display: flex;
  align-items: center;
  pointer-events: auto;

  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;

  /* Subtle lift shadow — same depth feel as modal/card */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.10), 0 1px 4px rgba(0, 0, 0, 0.06);
}

.capsule-divider {
  width: 2px;
  height: 20px;
  background: var(--border-primary);
  margin: 0 2px;
  flex-shrink: 0;
  border-radius: 1px;
}

/* Base button */
.capsule-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-primary);
  transition: background 0.15s ease, transform 0.12s ease;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.capsule-btn:hover {
  background: #f0f0f0;
}

.capsule-btn:active {
  transform: scale(0.91);
  background: #e8e8e8;
}

/* Add button — filled, matches FAB style used across the app */
.capsule-btn.add-btn {
  background: var(--janote-action, #1a1a1a);
  color: #fff;
}

.capsule-btn.add-btn:hover {
  opacity: 0.88;
  background: var(--janote-action, #1a1a1a);
}

.capsule-btn.add-btn:active {
  transform: scale(0.91);
  opacity: 0.75;
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

  .capsule-btn {
    width: 46px;
    height: 46px;
  }
}
</style>