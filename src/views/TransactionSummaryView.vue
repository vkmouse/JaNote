<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import YearPicker from "../components/YearPicker.vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import type { EntryType } from "../types";
import ViewModeToggle from "../components/ViewModeToggle.vue";
import TypeToggle from "../components/TypeToggle.vue";
import CategoryIcon, { getCategoryColor } from "../components/CategoryIcon.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import BottomTabBar from "../components/BottomTabBar.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";

type ViewMode = "monthly" | "yearly" | "custom";

interface CategorySummary {
  category_id: string;
  category_name: string;
  total_amount: number;
}

const router = useRouter();
const route = useRoute();
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

function prevPeriod(): void {
  if (viewMode.value === "monthly") {
    if (selectedMonth.value === 1) {
      selectedMonth.value = 12;
      selectedYear.value--;
    } else {
      selectedMonth.value--;
    }
  } else if (viewMode.value === "yearly") {
    selectedYear.value--;
  }
}

function nextPeriod(): void {
  if (viewMode.value === "monthly") {
    if (selectedMonth.value === 12) {
      selectedMonth.value = 1;
      selectedYear.value++;
    } else {
      selectedMonth.value++;
    }
  } else if (viewMode.value === "yearly") {
    selectedYear.value++;
  }
}

// 從 Pinia Store 取得使用者狀態

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
    sliceColor: getCategoryColor(summary.category_name),
  }));
});

const centerLabel = computed(() => {
  return transactionType.value === "EXPENSE" ? "總支出" : "總收入";
});

const centerBalance = computed(() => {
  return `$${totalAmount.value.toLocaleString()}`;
});

function buildTimeQuery(): Record<string, string> {
  const q: Record<string, string> = {};
  q.mode = viewMode.value;
  if (viewMode.value === "monthly" || viewMode.value === "yearly") {
    q.year = String(selectedYear.value);
    if (viewMode.value === "monthly") q.month = String(selectedMonth.value);
  }
  if (viewMode.value === "custom") {
    q.start = String(customStartDate.value);
    q.end = String(customEndDate.value);
  }
  return q;
}

function goToSearchByCategory(summary: CategorySummary): void {
  router.push({
    path: "/transactions/search",
    query: { ...buildTimeQuery(), cat: summary.category_id },
  });
}

const getCategoryName = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return category?.name || "其他";
};

const loadTransactions = async () => {
  await transactionStore.loadTransactions();
};

const loadCategories = async () => {
  await transactionStore.loadCategories();
};

const isInitialized = ref(false);

watch(
  [viewMode, transactionType, selectedYear, selectedMonth, customStartDate, customEndDate],
  () => {
    if (!isInitialized.value) return;
    const q: Record<string, string> = {
      type: transactionType.value,
      mode: viewMode.value,
    };
    if (viewMode.value === "monthly" || viewMode.value === "yearly") {
      q.year = String(selectedYear.value);
      if (viewMode.value === "monthly") q.month = String(selectedMonth.value);
    }
    if (viewMode.value === "custom") {
      q.start = String(customStartDate.value);
      q.end = String(customEndDate.value);
    }
    router.replace({ query: q });
  },
);

onMounted(async () => {
  await userStore.loadUser();
  const q = route.query;
  if (q.type === "EXPENSE" || q.type === "INCOME") transactionType.value = q.type as EntryType;
  if (q.mode === "monthly" || q.mode === "yearly" || q.mode === "custom") viewMode.value = q.mode as ViewMode;
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
  await nextTick();
  isInitialized.value = true;
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
        <NavSearch />
      </template>
      <template #center>
        <div class="month-display" @click="openPicker">
          <span>{{ currentMonthDisplay }}</span>
        </div>
      </template>
      <template #right><NavSync /><NavAvatar /></template>
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
          <ViewModeToggle v-model="viewMode" />
        </div>
        <div class="right-controls">
          <TypeToggle v-model="transactionType" />
        </div>
      </div>

      <!-- 甜甜圈圖表 -->
      <div class="chart-wrapper">
        <DonutChart
          :swipeable="viewMode !== 'custom'"
          :centerLabel="centerLabel"
          :centerBalance="centerBalance"
          :slices="donutSlices"
          @swipe-prev="prevPeriod"
          @swipe-next="nextPeriod"
        />
      </div>

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

        <ListGroup>
          <template #header-left>
            <span class="header-label">{{ transactionType === 'EXPENSE' ? '支出明細' : '收入明細' }}</span>
          </template>
          <template #header-right />
          <ListItem
            v-for="summary in categorySummaries"
            :key="summary.category_id"
          >
            <div class="category-item" @click="goToSearchByCategory(summary)">
            <div class="item-left">
              <CategoryIcon
                :category-name="summary.category_name"
                color-mode="category"
              />
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
                      backgroundColor: getCategoryColor(summary.category_name),
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
            </div>
          </ListItem>
        </ListGroup>
      </div>
    </div>

    <BottomTabBar />
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

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}

/* ── 月份 / 年份切換列 ── */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 12px;
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

.chart-wrapper {
  padding: 0 16px 16px;
}

/* ── 分類列表 ── */
.category-list {
  padding: 0 16px;
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

.header-label {
  font-size: 16px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  position: relative;
  background: var(--bg-page);
  cursor: pointer;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.category-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
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
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.item-percentage {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-disabled);
}

</style>
