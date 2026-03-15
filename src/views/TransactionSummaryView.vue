<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import YearPicker from "../components/YearPicker.vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import type { EntryType } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";
import iconSearch from "../assets/icons/icon-search.svg?raw";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import BottomTabBar from "../components/BottomTabBar.vue";

type ViewMode = "monthly" | "yearly" | "custom";

interface CategorySummary {
  category_id: string;
  category_name: string;
  total_amount: number;
  color: string;
}

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();
const viewMode = ref<ViewMode>("monthly");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);
const showYearPicker = ref(false);
const showDateRangePicker = ref(false);
const customStartDate = ref(new Date().setHours(0, 0, 0, 0));
const customEndDate = ref(new Date().setHours(23, 59, 59, 999));
const transactionType = ref<EntryType>("EXPENSE");

const categoryColors = [
  "#FF6B6B",
  "#4ECDC4",
  "#45B7D1",
  "#FFA07A",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E2",
  "#F8B88B",
  "#AED6F1",
  "#F1948A",
  "#82E0AA",
  "#FAD7A0",
  "#D7BDE2",
  "#A3E4D7",
];

const currentMonthDisplay = computed(() => {
  if (viewMode.value === "monthly") {
    return `${selectedYear.value}年${selectedMonth.value}月`;
  } else if (viewMode.value === "yearly") {
    return `${selectedYear.value}年`;
  } else {
    // custom
    const start = new Date(customStartDate.value);
    const end = new Date(customEndDate.value);
    const startStr = `${start.getFullYear()}/${String(start.getMonth() + 1).padStart(2, "0")}/${String(start.getDate()).padStart(2, "0")}`;
    const endStr = `${end.getFullYear()}/${String(end.getMonth() + 1).padStart(2, "0")}/${String(end.getDate()).padStart(2, "0")}`;
    return `${startStr}~${endStr}`;
  }
});

const openPicker = () => {
  if (viewMode.value === "monthly") {
    showMonthPicker.value = true;
  } else if (viewMode.value === "yearly") {
    showYearPicker.value = true;
  } else {
    showDateRangePicker.value = true;
  }
};

// 從 Pinia Store 取得使用者狀態
const isViewingShared = computed(() => userStore.isViewingShared);

const filteredTransactions = computed(() => {
  return transactionStore.visibleTransactions.filter((t) => {
    const dateValue: any = t.date;
    const dateString =
      typeof dateValue === "string" ? dateValue.replace(/-/g, "/") : dateValue;
    const date = new Date(dateString);

    if (isNaN(date.getTime())) return false;

    if (viewMode.value === "monthly") {
      return (
        date.getFullYear() === Number(selectedYear.value) &&
        date.getMonth() + 1 === Number(selectedMonth.value)
      );
    } else if (viewMode.value === "yearly") {
      return date.getFullYear() === Number(selectedYear.value);
    } else {
      // custom date range
      const startDate = new Date(customStartDate.value);
      const endDate = new Date(customEndDate.value);
      return date >= startDate && date <= endDate;
    }
  });
});

const typeFilteredTransactions = computed(() => {
  return filteredTransactions.value.filter(
    (t) => t.type === transactionType.value,
  );
});

const categorySummaries = computed<CategorySummary[]>(() => {
  const categoryMap = new Map<string, CategorySummary>();

  typeFilteredTransactions.value.forEach((transaction) => {
    const category = transactionStore.visibleCategories.find(
      (c) => c.id === transaction.category_id,
    );
    const categoryName = category?.name || "未知分類";

    if (!categoryMap.has(transaction.category_id)) {
      categoryMap.set(transaction.category_id, {
        category_id: transaction.category_id,
        category_name: categoryName,
        total_amount: 0,
        color:
          categoryColors[categoryMap.size % categoryColors.length] || "#FF6B6B",
      });
    }

    const summary = categoryMap.get(transaction.category_id)!;
    summary.total_amount += transaction.amount;
  });

  return Array.from(categoryMap.values()).sort(
    (a, b) => b.total_amount - a.total_amount,
  );
});

const totalAmount = computed(() => {
  return categorySummaries.value.reduce(
    (sum, cat) => sum + cat.total_amount,
    0,
  );
});

const donutSlices = computed<DonutSlice[]>(() => {
  return categorySummaries.value.map((summary) => ({
    sliceLabel: summary.category_name,
    sliceValue: summary.total_amount,
    sliceColor: summary.color,
  }));
});

const centerLabel = computed(() => {
  return transactionType.value === "EXPENSE" ? "總支出" : "總收入";
});

const centerBalance = computed(() => {
  return `$${totalAmount.value.toLocaleString()}`;
});

const goToSearch = () => router.push("/transactions/search");
const goToNewTransaction = () => router.push("/transactions/new");
const goToBudget = () => router.push("/budget");

const getCategoryIconSvg = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return getCategoryIcon(category?.name || "其他");
};

const loadTransactions = async () => {
  await transactionStore.loadTransactions();
};

const loadCategories = async () => {
  await transactionStore.loadCategories();
};

onMounted(async () => {
  await userStore.loadUser();
  await loadCategories();
  await loadTransactions();
});

// 切換使用者時重新載入資料
watch(
  () => userStore.activeUserId,
  async () => {
    await loadCategories();
    await loadTransactions();
  },
);
</script>

<template>
  <section class="transaction-summary-page">
    <TopNavigation>
      <template #left>
        <NavMenu />
        <button class="nav-search-btn" @click="router.push('/transactions/search')" aria-label="搜尋" v-html="iconSearch"></button>
      </template>
      <template #center>
        <div class="month-display" @click="openPicker">
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

    <YearPicker v-model:open="showYearPicker" v-model:year="selectedYear" />

    <DateRangePicker
      v-model:open="showDateRangePicker"
      v-model:startDate="customStartDate"
      v-model:endDate="customEndDate"
    />

    <div class="page-content page">
      <!-- 右：支出/收入 toggle，靠右 -->
      <div class="header-section">
        <div class="left-controls">
          <div class="view-mode-toggle">
            <button
              :class="['mode-btn', { active: viewMode === 'monthly' }]"
              @click="viewMode = 'monthly'"
            >
              月
            </button>
            <button
              :class="['mode-btn', { active: viewMode === 'yearly' }]"
              @click="viewMode = 'yearly'"
            >
              年
            </button>
            <button
              :class="['mode-btn', { active: viewMode === 'custom' }]"
              @click="viewMode = 'custom'"
            >
              自訂
            </button>
          </div>
        </div>
        <div class="right-controls">
          <div class="type-toggle">
            <button
              :class="[
                'toggle-btn',
                {
                  active: transactionType === 'EXPENSE',
                  'expense-active': transactionType === 'EXPENSE',
                },
              ]"
              @click="transactionType = 'EXPENSE'"
            >
              支出
            </button>
            <button
              :class="[
                'toggle-btn',
                {
                  active: transactionType === 'INCOME',
                  'income-active': transactionType === 'INCOME',
                },
              ]"
              @click="transactionType = 'INCOME'"
            >
              收入
            </button>
          </div>
        </div>
      </div>

      <!-- 甜甜圈圖表 -->
      <DonutChart
        :centerLabel="centerLabel"
        :centerBalance="centerBalance"
        :slices="donutSlices"
      />

      <!-- 分類摘要列表 -->
      <div class="category-list">
        <div v-if="categorySummaries.length === 0" class="empty-state">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>暫無資料</p>
        </div>

        <div v-else class="category-group">
          <!-- 列表標頭 -->
          <div class="list-header">
            <span class="list-header-label">分類</span>
            <span class="list-header-label">金額</span>
          </div>

          <div class="category-items">
            <div
              v-for="(summary, index) in categorySummaries"
              :key="summary.category_id"
              class="category-item"
            >
              <div class="item-left">
                <div
                  class="color-indicator"
                  :style="{ backgroundColor: summary.color }"
                ></div>
                <div
                  class="category-icon"
                  v-html="getCategoryIconSvg(summary.category_id)"
                ></div>
                <div class="category-info">
                  <span class="category-name">{{ summary.category_name }}</span>
                  <!-- 百分比進度條 -->
                  <div class="progress-bar-track">
                    <div
                      class="progress-bar-fill"
                      :style="{
                        width:
                          totalAmount > 0
                            ? (summary.total_amount / totalAmount) * 100 + '%'
                            : '0%',
                        backgroundColor: summary.color,
                      }"
                    ></div>
                  </div>
                </div>
              </div>
              <div class="item-right">
                <span class="item-amount"
                  >${{ summary.total_amount.toLocaleString() }}</span
                >
                <span class="item-percentage" v-if="totalAmount > 0">
                  {{ ((summary.total_amount / totalAmount) * 100).toFixed(1) }}%
                </span>
              </div>
              <div
                v-if="index < categorySummaries.length - 1"
                class="item-divider"
              ></div>
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

<style scoped>
.transaction-summary-page {
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
  padding: 6px 10px;
  border-radius: 10px;
  transition:
    background 0.15s,
    opacity 0.15s;
}

.nav-search-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 50%;
  background: transparent;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s;
  margin-left: 4px;
}

.nav-search-btn:hover {
  background: #f0f0f0;
}

.nav-search-btn :deep(svg) {
  width: 20px;
  height: 20px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.month-display:hover {
  opacity: 0.7;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}

/* ── 共用 toggle 尺寸規格 ── */
.view-mode-toggle,
.type-toggle {
  display: flex;
  gap: 2px;
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  padding: 2px;
  background: var(--bg-page);
}

.mode-btn,
.toggle-btn {
  padding: 4px 14px;
  border: none;
  border-radius: 16px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-width: 38px;
}

.mode-btn:hover,
.toggle-btn:hover {
  background: #f0f0f0;
}

/* 月/年：active = 黑底白字 */
.mode-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}

/* 支出/收入：active 保留各自用色 */
.toggle-btn.expense-active {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.toggle-btn.income-active {
  background: var(--janote-income);
  color: var(--text-light);
}

/* ── 月份 / 年份切換列 ── */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
}

.left-controls {
  display: flex;
  align-items: center;
  justify-content: flex-start;
}

.right-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

/* ── 分類列表 ── */
.category-list {
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--text-disabled);
  font-size: 14px;
}

.category-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}

/* 列表標頭 */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 2px solid var(--border-primary);
  background: var(--bg-page);
}

.list-header-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-disabled);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 分類項目 */
.category-items {
  background: var(--bg-page);
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  position: relative;
  background: var(--bg-page);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.color-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f5f5f5;
  border-radius: 10px;
}

.category-icon :deep(svg) {
  width: 22px;
  height: 22px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 分類名稱 + 進度條 */
.category-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.category-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar-track {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

/* 右側金額 + 百分比 */
.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.item-percentage {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-disabled);
}

.item-divider {
  position: absolute;
  bottom: 0;
  left: 76px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}
</style>
