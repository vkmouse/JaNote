<template>
  <section class="budget-page">
    <!-- Top Navigation -->
    <TopNavigation>
      <template #left><NavMenu /></template>
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
      <!-- Header controls -->
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
                { 'expense-active': transactionType === 'EXPENSE' },
              ]"
              @click="transactionType = 'EXPENSE'"
            >
              支出
            </button>
            <button
              :class="[
                'toggle-btn',
                { 'income-active': transactionType === 'INCOME' },
              ]"
              @click="transactionType = 'INCOME'"
            >
              收入
            </button>
          </div>
        </div>
      </div>

      <!-- Professional Summary Card -->
      <div
        v-if="currentBudgets.length > 0"
        class="summary-card"
        :class="transactionType.toLowerCase()"
      >
        <div class="summary-header">
          <span class="summary-title">{{
            transactionType === "EXPENSE" ? "支出預算" : "收入目標"
          }}</span>
          <span class="summary-badge">{{ currentBudgets.length }} 項目</span>
        </div>
        <div class="summary-amounts">
          <div class="amount-block">
            <div class="amount-label">本期目標</div>
            <div class="amount-goal">${{ totalGoal.toLocaleString() }}</div>
          </div>
          <div class="amount-block amount-block-right">
            <div class="amount-label">
              實際{{ transactionType === "EXPENSE" ? "支出" : "收入" }}
            </div>
            <div class="amount-actual">${{ totalActual.toLocaleString() }}</div>
          </div>
        </div>
        <div class="summary-progress-row">
          <div class="summary-pg-track">
            <div
              class="summary-pg-fill"
              :style="{
                width: `${Math.min(overallPercentage, 100)}%`,
                background:
                  overallPercentage > 100 ? '#EF4444' : 'rgba(0,0,0,0.28)',
              }"
            ></div>
          </div>
          <span class="summary-pct">{{ overallPercentage.toFixed(1) }}%</span>
        </div>
        <div class="summary-footer">
          <div class="footer-stat">
            <div class="footer-stat-label">
              {{
                transactionType === "EXPENSE"
                  ? overallPercentage > 100
                    ? "超出預算"
                    : "剩餘預算"
                  : overallPercentage >= 100
                    ? "超出目標"
                    : "距目標差"
              }}
            </div>
            <div
              class="footer-stat-value"
              :class="{
                'value-warn':
                  transactionType === 'EXPENSE' && overallPercentage > 100,
              }"
            >
              ${{ Math.abs(totalGoal - totalActual).toLocaleString() }}
            </div>
          </div>
          <div class="footer-sep"></div>
          <div class="footer-stat footer-stat-right">
            <div class="footer-stat-label">執行率</div>
            <div class="footer-stat-value">
              {{ overallPercentage.toFixed(1) }}%
            </div>
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

        <div v-else class="budget-group">
          <div class="group-header">
            <span class="group-header-label">分類</span>
            <span class="group-header-label">實際 / 目標</span>
          </div>
          <div
            v-for="(budget, index) in currentBudgets"
            :key="budget.id"
            class="budget-item"
            @click="openEditModal(budget)"
          >
            <div class="item-left">
              <div class="category-icon" v-html="getBudgetIcon(budget)"></div>
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
            <div
              v-if="index < currentBudgets.length - 1"
              class="item-divider"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <BudgetModal
      :show="showModal"
      :editingBudget="editingBudget"
      :transactionType="transactionType"
      :monthKey="currentMonthKey"
      @close="closeModal"
      @save="onBudgetSave"
      @delete="onBudgetDelete"
    />

    <BottomTabBar
      :show-add-button="true"
      :add-disabled="isViewingShared"
      @add="openAddModal"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import YearPicker from "../components/YearPicker.vue";
import DateRangePicker from "../components/DateRangePicker.vue";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import type { EntryType } from "../types";
import BottomTabBar from "../components/BottomTabBar.vue";
import BudgetModal from "../components/BudgetModal.vue";
import type { Budget } from "../components/BudgetModal.vue";

// ── Types ──────────────────────────────────────────────────

type ViewMode = "monthly" | "yearly" | "custom";

// ── Stores ─────────────────────────────────────────────────

const userStore = useUserStore();
const transactionStore = useTransactionStore();

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

// ── Budget persistence (localStorage) ─────────────────────
const budgets = ref<Budget[]>([]);

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

// ── Budget key for monthly lookup ─────────────────────────

const currentMonthKey = computed(
  () => `${selectedYear.value}-${selectedMonth.value}`,
);

// ── Filtered transactions (date range for actual amounts) ──

const filteredTransactions = computed(() => {
  return transactionStore.visibleTransactions.filter((t) => {
    const date = new Date(t.date);
    if (isNaN(date.getTime())) return false;
    if (viewMode.value === "monthly") {
      return (
        date.getFullYear() === selectedYear.value &&
        date.getMonth() + 1 === selectedMonth.value
      );
    } else if (viewMode.value === "yearly") {
      return date.getFullYear() === selectedYear.value;
    } else {
      return (
        date >= new Date(customStartDate.value) &&
        date <= new Date(customEndDate.value)
      );
    }
  });
});

// ── Category helpers ───────────────────────────────────────

function getBudgetIcon(budget: { categoryIds: string[] }): string {
  if (budget.categoryIds.length === 1) {
    const cat = transactionStore.visibleCategories.find(
      (c) => c.id === budget.categoryIds[0],
    );
    return getCategoryIcon(cat?.name ?? "其他");
  }
  return getCategoryIcon("其他");
}

function getActualForBudget(budget: Budget): number {
  return filteredTransactions.value
    .filter(
      (t) =>
        t.type === budget.type && budget.categoryIds.includes(t.category_id),
    )
    .reduce((sum, t) => sum + t.amount, 0);
}

// ── Computed budgets with actual ───────────────────────────

const currentBudgets = computed(() =>
  budgets.value
    .filter(
      (b) =>
        b.type === transactionType.value &&
        b.monthKey === currentMonthKey.value,
    )
    .map((b) => {
      const actual = getActualForBudget(b);
      return {
        ...b,
        actual,
        percentage: b.goal > 0 ? (actual / b.goal) * 100 : 0,
      };
    }),
);

const totalGoal = computed(() =>
  currentBudgets.value.reduce((s, b) => s + b.goal, 0),
);
const totalActual = computed(() =>
  currentBudgets.value.reduce((s, b) => s + b.actual, 0),
);
const overallPercentage = computed(() =>
  totalGoal.value > 0 ? (totalActual.value / totalGoal.value) * 100 : 0,
);

// ── Modal ──────────────────────────────────────────────────

const showModal = ref(false);
const editingBudget = ref<Budget | null>(null);

function openAddModal(): void {
  editingBudget.value = null;
  showModal.value = true;
}

function openEditModal(budget: Budget): void {
  editingBudget.value = budget;
  showModal.value = true;
}

function closeModal(): void {
  showModal.value = false;
  editingBudget.value = null;
}

function onBudgetSave(budget: Budget): void {
  if (editingBudget.value) {
    const idx = budgets.value.findIndex((b) => b.id === budget.id);
    if (idx !== -1) budgets.value[idx] = budget;
  } else {
    budgets.value.push(budget);
  }
  closeModal();
}

function onBudgetDelete(id: string): void {
  budgets.value = budgets.value.filter((b) => b.id !== id);
  closeModal();
}

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  await userStore.loadUser();
  await transactionStore.loadCategories();
  await transactionStore.loadTransactions();
});

watch(
  () => userStore.activeUserId,
  async () => {
    await transactionStore.loadCategories();
    await transactionStore.loadTransactions();
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

.month-display:hover {
  opacity: 0.7;
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
  padding: 10px 12px;
}

.left-controls,
.right-controls {
  display: flex;
  align-items: center;
}

/* ── View mode toggle & type toggle ── */
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

.mode-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}

.toggle-btn.expense-active {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.toggle-btn.income-active {
  background: var(--janote-income);
  color: var(--text-light);
}

/* ── Professional Summary Card ── */
.summary-card {
  margin: 0 16px 16px;
  border-radius: 20px;
  padding: 20px;
}

.summary-card.expense {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.summary-card.income {
  background: var(--janote-income);
  color: var(--text-light);
}

.summary-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
}

.summary-title {
  font-size: 13px;
  font-weight: 700;
  opacity: 0.85;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.summary-badge {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 20px;
  background: rgba(0, 0, 0, 0.1);
}

.summary-amounts {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 16px;
}

.amount-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.amount-block-right {
  text-align: right;
}

.amount-label {
  font-size: 11px;
  font-weight: 500;
  opacity: 0.72;
  letter-spacing: 0.04em;
}

.amount-goal {
  font-size: 28px;
  font-weight: 700;
  line-height: 1.15;
  letter-spacing: -0.5px;
}

.amount-actual {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.2;
}

.summary-progress-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.summary-pg-track {
  flex: 1;
  height: 8px;
  background: rgba(0, 0, 0, 0.15);
  border-radius: 4px;
  overflow: hidden;
}

.summary-pg-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease;
  min-width: 4px;
}

.summary-pct {
  font-size: 13px;
  font-weight: 700;
  min-width: 48px;
  text-align: right;
  opacity: 0.9;
}

.summary-footer {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 14px;
  border-top: 1px solid rgba(0, 0, 0, 0.12);
}

.footer-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.footer-stat-right {
  text-align: right;
  margin-left: auto;
}

.footer-stat-label {
  font-size: 10px;
  font-weight: 600;
  opacity: 0.65;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.footer-stat-value {
  font-size: 17px;
  font-weight: 700;
}

.footer-sep {
  width: 1px;
  height: 30px;
  background: rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.value-warn {
  color: #dc2626;
}

/* ── Budget list ── */
.budget-list {
  padding: 0 16px;
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

.budget-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}

.group-header {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 2px solid var(--border-primary);
}

.group-header-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-disabled);
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

.budget-item:hover {
  background: #f9f9f9;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.category-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
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

.category-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.category-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.progress-row {
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

.item-divider {
  position: absolute;
  bottom: 0;
  left: 72px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}
</style>
