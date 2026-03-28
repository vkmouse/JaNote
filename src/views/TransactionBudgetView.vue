<template>
  <section class="budget-page">
    <!-- Top Navigation -->
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
      <!-- Header controls -->
      <div class="header-section">
        <div class="left-controls">
          <ViewModeToggle v-model="viewMode" />
        </div>
        <div class="right-controls">
          <TypeToggle v-model="transactionType" />
        </div>
      </div>

      <!-- Summary Section -->
      <div v-if="currentBudgets.length > 0" class="budget-summary">
        <div class="summary-donut">
          <DonutChart
            :slices="summaryDonutSlices"
            :center-label="summaryCenterLabel"
            :center-balance="summaryCenterBalance"
          />
        </div>
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">本期目標</div>
            <div class="stat-value">${{ totalGoal.toLocaleString() }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">實際{{ transactionType === 'EXPENSE' ? '支出' : '收入' }}</div>
            <div class="stat-value">${{ totalActual.toLocaleString() }}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">執行率</div>
            <div class="stat-value" :class="summaryValueClass">{{ overallPercentage.toFixed(1) }}%</div>
          </div>
        </div>
      </div>

      <!-- Budget List -->
      <div class="budget-list">
        <div v-if="currentBudgets.length === 0" class="empty-state">
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>
            尚未設定{{
              transactionType === "EXPENSE" ? "支出預算" : "收入目標"
            }}
          </p>
        </div>

        <ListGroup
          v-for="group in groupedBudgets"
          :key="group.monthKey"
        >
          <template #header-left>
            <span class="header-label">{{ formatMonthKey(group.monthKey) }}</span>
          </template>
          <template #header-right />
          <ListItem
            v-for="budget in group.budgets"
            :key="budget.id"
            :swipeable="!isViewingShared"
            @delete="onBudgetSwipeDelete(budget)"
            @edit="openEditModal(budget)"
          >
            <div class="budget-item">
            <div class="item-left">
              <CategoryIcon
                :category-name="getBudgetCategoryName(budget)"
                color-mode="type"
                :entry-type="transactionType"
              />
              <div class="category-info">
                <div class="category-name">{{ budget.name }}</div>
                <div class="progress-row">
                  <div class="progress-bar-track">
                    <div
                      class="progress-bar-fill"
                      :style="{
                        width: `${Math.min(budget.percentage, 100)}%`,
                        background:
                          budget.percentage > 100
                            ? '#EF4444'
                            : transactionType === 'EXPENSE'
                              ? 'var(--janote-expense)'
                              : 'var(--janote-income)',
                      }"
                    ></div>
                  </div>
                  <span
                    class="percentage-badge"
                    :class="{
                      'over-budget': budget.percentage > 100,
                      expense:
                        transactionType === 'EXPENSE' &&
                        budget.percentage <= 100,
                      income:
                        transactionType === 'INCOME' &&
                        budget.percentage <= 100,
                    }"
                  >
                    {{ budget.percentage.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
            <div class="item-right">
              <div class="item-actual">
                ${{ budget.actual.toLocaleString() }}
              </div>
              <div class="item-goal">/ ${{ budget.goal.toLocaleString() }}</div>
            </div>
            </div>
          </ListItem>
        </ListGroup>
      </div>
    </div>

    <BottomTabBar />

    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除預算"
      message="確定要刪除這個預算嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmBudgetDelete"
      @cancel="cancelBudgetDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import YearPicker from "../components/YearPicker.vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import CategoryIcon from "../components/CategoryIcon.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import { useBudgetStore } from "../stores/budgetStore";
import type { EntryType, Budget } from "../types";
import BottomTabBar from "../components/BottomTabBar.vue";
import ViewModeToggle from "../components/ViewModeToggle.vue";
import TypeToggle from "../components/TypeToggle.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useSharedSwipeContext } from "../components/ListGroup.vue";

// ── Types ──────────────────────────────────────────────────

type ViewMode = "monthly" | "yearly" | "custom";

// ── Stores ─────────────────────────────────────────────────

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();
const budgetStore = useBudgetStore();

useSharedSwipeContext();

const isViewingShared = computed(() => userStore.isViewingShared);

// ── State ──────────────────────────────────────────────────

const viewMode = ref<ViewMode>("monthly");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);
const showYearPicker = ref(false);
const showDateRangePicker = ref(false);
const customStartDate = ref(new Date().setHours(0, 0, 0, 0));
const customEndDate = ref(new Date().setHours(23, 59, 59, 999));
const transactionType = ref<EntryType>("EXPENSE");

// ── Delete mode ────────────────────────────────────────────

const showDeleteConfirm = ref(false);
const deletingBudgetId = ref<string | null>(null);

// ── Date display & picker ──────────────────────────────────

const currentMonthDisplay = computed(() => {
  if (viewMode.value === "monthly") {
    return `${selectedYear.value}年${selectedMonth.value}月`;
  } else if (viewMode.value === "yearly") {
    return `${selectedYear.value}年`;
  } else {
    const fmt = (d: Date) =>
      `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    return `${fmt(new Date(customStartDate.value))}~${fmt(new Date(customEndDate.value))}`;
  }
});

function openPicker(): void {
  if (viewMode.value === "monthly") showMonthPicker.value = true;
  else if (viewMode.value === "yearly") showYearPicker.value = true;
  else showDateRangePicker.value = true;
}

// ── Month key helpers ─────────────────────────────────────

function toMonthKey(year: number, month: number): string {
  return `${year}${String(month).padStart(2, "0")}`;
}

function formatMonthKey(key: string): string {
  const year = key.slice(0, 4);
  const month = parseInt(key.slice(4, 6));
  return `${year}年${month}月`;
}

// ── Budget key range for filtering ────────────────────────

const budgetKeyRange = computed(() => {
  if (viewMode.value === "monthly") {
    const key = toMonthKey(selectedYear.value, selectedMonth.value);
    return { start: key, end: key };
  } else if (viewMode.value === "yearly") {
    return {
      start: toMonthKey(selectedYear.value, 1),
      end: toMonthKey(selectedYear.value, 12),
    };
  } else {
    const s = new Date(customStartDate.value);
    const e = new Date(customEndDate.value);
    return {
      start: toMonthKey(s.getFullYear(), s.getMonth() + 1),
      end: toMonthKey(e.getFullYear(), e.getMonth() + 1),
    };
  }
});

// ── Category helpers ───────────────────────────────────────

function getBudgetCategoryName(budget: Budget): string {
  const ids = budget.category_ids.split(",").filter(Boolean);
  if (ids.length === 1) {
    const cat = transactionStore.visibleCategories.find((c) => c.id === ids[0]);
    return cat?.name ?? "其他";
  }
  return "其他";
}

function getActualForBudget(budget: Budget): number {
  const ids = budget.category_ids.split(",").filter(Boolean);
  const bKey = budget.month_key;
  const bYear = parseInt(bKey.slice(0, 4));
  const bMonth = parseInt(bKey.slice(4, 6));

  let rangeStart: Date;
  let rangeEnd: Date;

  if (viewMode.value === "monthly" || viewMode.value === "yearly") {
    rangeStart = new Date(bYear, bMonth - 1, 1, 0, 0, 0, 0);
    rangeEnd = new Date(bYear, bMonth, 0, 23, 59, 59, 999);
  } else {
    const { start: startKey, end: endKey } = budgetKeyRange.value;
    const customStart = new Date(customStartDate.value);
    const customEnd = new Date(customEndDate.value);
    if (bKey === startKey && bKey === endKey) {
      rangeStart = customStart;
      rangeEnd = customEnd;
    } else if (bKey === startKey) {
      rangeStart = customStart;
      rangeEnd = new Date(bYear, bMonth, 0, 23, 59, 59, 999);
    } else if (bKey === endKey) {
      rangeStart = new Date(bYear, bMonth - 1, 1, 0, 0, 0, 0);
      rangeEnd = customEnd;
    } else {
      rangeStart = new Date(bYear, bMonth - 1, 1, 0, 0, 0, 0);
      rangeEnd = new Date(bYear, bMonth, 0, 23, 59, 59, 999);
    }
  }

  return transactionStore.visibleTransactions
    .filter((t) => {
      const date = new Date(t.date);
      if (isNaN(date.getTime())) return false;
      return (
        t.type === budget.type &&
        ids.includes(t.category_id) &&
        date >= rangeStart &&
        date <= rangeEnd
      );
    })
    .reduce((sum, t) => sum + t.amount, 0);
}

// ── Computed budgets with actual ───────────────────────────

const currentBudgets = computed(() => {
  const { start, end } = budgetKeyRange.value;
  return budgetStore.visibleBudgets
    .filter(
      (b) =>
        b.type === transactionType.value &&
        b.month_key >= start &&
        b.month_key <= end,
    )
    .map((b) => {
      const actual = getActualForBudget(b);
      return {
        ...b,
        actual,
        percentage: b.goal > 0 ? (actual / b.goal) * 100 : 0,
      };
    });
});

const groupedBudgets = computed(() => {
  const map = new Map<string, (typeof currentBudgets.value)[number][]>();
  for (const budget of currentBudgets.value) {
    if (!map.has(budget.month_key)) map.set(budget.month_key, []);
    map.get(budget.month_key)!.push(budget);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([monthKey, budgets]) => ({ monthKey, budgets }));
});

const totalGoal = computed(() =>
  currentBudgets.value.reduce((s, b) => s + b.goal, 0),
);
const totalActual = computed(() =>
  currentBudgets.value.reduce((s, b) => s + b.actual, 0),
);
const overallPercentage = computed(() =>
  totalGoal.value > 0 ? (totalActual.value / totalGoal.value) * 100 : 0,
);

const summaryDonutSlices = computed<DonutSlice[]>(() => {
  if (transactionType.value === "EXPENSE") {
    if (overallPercentage.value > 100) {
      return [{ sliceLabel: "超出預算", sliceValue: 1, sliceColor: "#EF4444" }];
    }
    return [
      { sliceLabel: "已使用", sliceValue: totalActual.value, sliceColor: "#FFC952" },
      { sliceLabel: "剩餘", sliceValue: totalGoal.value - totalActual.value, sliceColor: "#E0E0E0" },
    ];
  } else {
    if (overallPercentage.value >= 100) {
      return [{ sliceLabel: "超出目標", sliceValue: 1, sliceColor: "#47B8E0" }];
    }
    return [
      { sliceLabel: "已達成", sliceValue: totalActual.value, sliceColor: "#47B8E0" },
      { sliceLabel: "距目標", sliceValue: totalGoal.value - totalActual.value, sliceColor: "#E0E0E0" },
    ];
  }
});

const summaryCenterLabel = computed(() => {
  if (transactionType.value === "EXPENSE") {
    return overallPercentage.value > 100 ? "超出預算" : "剩餘預算";
  }
  return overallPercentage.value >= 100 ? "超出目標" : "距離目標";
});

const summaryCenterBalance = computed(() =>
  `$${Math.abs(totalGoal.value - totalActual.value).toLocaleString()}`
);

const summaryValueClass = computed(() => {
  if (transactionType.value === "EXPENSE" && overallPercentage.value > 100) return "warn";
  if (transactionType.value === "INCOME" && overallPercentage.value >= 100) return "success";
  return "";
});

// ── Navigation to edit view ────────────────────────────────

function openEditModal(budget: Budget): void {
  router.push({ name: "budget-edit", params: { id: budget.id } });
}

function onBudgetSwipeDelete(budget: Budget): void {
  deletingBudgetId.value = budget.id;
  showDeleteConfirm.value = true;
}

async function confirmBudgetDelete(): Promise<void> {
  showDeleteConfirm.value = false;
  const id = deletingBudgetId.value;
  deletingBudgetId.value = null;
  if (!id) return;
  await budgetStore.deleteBudget(id);
}

function cancelBudgetDelete(): void {
  showDeleteConfirm.value = false;
  deletingBudgetId.value = null;
}

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  await userStore.loadUser();
  await transactionStore.loadCategories();
  await transactionStore.loadTransactions();
  await budgetStore.loadBudgets();
});

watch(
  () => userStore.activeUserId,
  async () => {
    await transactionStore.loadCategories();
    await transactionStore.loadTransactions();
    await budgetStore.loadBudgets();
  },
);
</script>

<style scoped>
.budget-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Month display ── */
.month-display {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  padding: 6px 10px;
  border-radius: 10px;
  transition: opacity 0.15s;
}

/* ── Page content ── */
.page-content {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 100px;
}

/* ── Header section (mirrors TransactionSummaryView) ── */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 12px;
}

.left-controls,
.right-controls {
  display: flex;
  align-items: center;
}

/* ── Budget Summary (DonutChart + Stats) ── */
.budget-summary {
  padding: 0 16px 8px;
}

.summary-donut {
  display: flex;
  justify-content: center;
}

.stats-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 8px;
  margin-top: 4px;
}

.stat-card {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-label {
  font-size: 11px;
  color: var(--text-primary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-value.warn {
  color: #ef4444;
}

.stat-value.success {
  color: #47B8E0;
}

/* ── Budget list ── */
.budget-list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 260px;
  color: var(--text-disabled);
  font-size: 14px;
}

.header-label {
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Budget item ── */
.budget-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  cursor: pointer;
  position: relative;
  background: var(--bg-page);
  transition: background 0.15s;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.category-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.progress-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.category-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Budget item ── */
.budget-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.progress-bar-track {
  flex: 1;
  height: 5px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.4s ease;
}

.percentage-badge {
  font-size: 12px;
  font-weight: 700;
  flex-shrink: 0;
  min-width: 46px;
  text-align: right;
}

.percentage-badge.expense {
  color: #b45309;
}

.percentage-badge.income {
  color: var(--janote-income);
}

.percentage-badge.over-budget {
  color: #ef4444;
}

.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 12px;
}

.item-actual {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.item-goal {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-disabled);
}

</style>
