<template>
  <section class="budget-page">
    <!-- Top Navigation -->
    <TopNavigation>
      <template #left><NavMenu /></template>
      <template #center>
        <div class="month-display" @click="openPicker">
          <span>{{ currentMonthDisplay }}</span>
          <span class="month-chevron" v-html="ArrowDownIcon"></span>
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

    <!-- Edit / Add Modal -->
    <Transition name="modal">
      <div v-if="showModal" class="modal-overlay" @click.self="closeModal">
        <div class="modal">
          <div class="modal-header">
            <h3>
              {{
                editingBudget
                  ? transactionType === "EXPENSE"
                    ? "編輯支出預算"
                    : "編輯收入目標"
                  : transactionType === "EXPENSE"
                    ? "新增支出預算"
                    : "新增收入目標"
              }}
            </h3>
            <button class="modal-close" @click="closeModal" aria-label="關閉">
              <svg
                width="20"
                height="20"
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

          <div class="modal-body">
            <!-- Category multi-select -->
            <div class="modal-field">
              <label class="field-label">選擇分類（可多選）</label>
              <div class="category-select-wrap">
                <div
                  class="category-select-trigger"
                  @click="showCategoryDropdown = !showCategoryDropdown"
                >
                  <div class="select-preview">
                    <span
                      v-if="modalForm.selectedCategoryIds.length === 0"
                      class="select-placeholder"
                      >請選擇分類</span
                    >
                    <div v-else class="select-pills">
                      <span
                        v-for="id in modalForm.selectedCategoryIds"
                        :key="id"
                        class="category-pill"
                        >{{ getCategoryNameById(id) }}</span
                      >
                    </div>
                  </div>
                  <svg
                    :class="[
                      'select-chevron',
                      { rotated: showCategoryDropdown },
                    ]"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2.5"
                  >
                    <polyline points="6 9 12 15 18 9"></polyline>
                  </svg>
                </div>
                <div v-if="showCategoryDropdown" class="category-dropdown">
                  <div
                    v-for="cat in availableCategories"
                    :key="cat.id"
                    class="dropdown-item"
                    :class="{
                      selected: modalForm.selectedCategoryIds.includes(cat.id),
                    }"
                    @click.stop="toggleCategory(cat.id)"
                  >
                    <div
                      class="dropdown-check"
                      :class="{
                        checked: modalForm.selectedCategoryIds.includes(cat.id),
                      }"
                    >
                      <svg
                        v-if="modalForm.selectedCategoryIds.includes(cat.id)"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="3"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </div>
                    <div
                      class="dropdown-icon"
                      v-html="getCategoryIcon(cat.name)"
                    ></div>
                    <span class="dropdown-label">{{ cat.name }}</span>
                  </div>
                  <div
                    v-if="availableCategories.length === 0"
                    class="dropdown-empty"
                  >
                    無可用的{{
                      transactionType === "EXPENSE" ? "支出" : "收入"
                    }}分類
                  </div>
                </div>
              </div>
            </div>

            <!-- Budget name -->
            <div class="modal-field">
              <label class="field-label">預算名稱</label>
              <input
                v-model="modalForm.name"
                type="text"
                class="field-input"
                :placeholder="
                  modalForm.selectedCategoryIds.length === 1
                    ? getCategoryNameById(modalForm.selectedCategoryIds[0]!)
                    : '例：雜支'
                "
                :disabled="modalForm.selectedCategoryIds.length === 1"
              />
              <span
                v-if="modalForm.selectedCategoryIds.length > 1"
                class="field-hint"
              >
                已選多個分類，請自訂群組名稱
              </span>
            </div>

            <!-- Budget goal -->
            <div class="modal-field">
              <label class="field-label">{{
                transactionType === "EXPENSE"
                  ? "月預算目標 ($)"
                  : "月收入目標 ($)"
              }}</label>
              <input
                v-model.number="modalForm.goal"
                type="number"
                class="field-input"
                placeholder="0"
                min="1"
              />
            </div>
          </div>

          <div class="modal-actions">
            <button
              v-if="editingBudget"
              class="modal-btn modal-delete-btn"
              @click="deleteBudget"
            >
              刪除
            </button>
            <button class="modal-btn modal-cancel-btn" @click="closeModal">
              取消
            </button>
            <button class="modal-btn modal-save-btn" @click="saveBudget">
              儲存
            </button>
          </div>
        </div>
      </div>
    </Transition>

    <BottomTabBar :show-add-button="true" @add="openAddModal" />
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
import ArrowDownIcon from "../assets/icons/icon-arrow-down.svg?raw";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import type { EntryType } from "../types";
import BottomTabBar from "../components/BottomTabBar.vue";

// ── Types ──────────────────────────────────────────────────

type ViewMode = "monthly" | "yearly" | "custom";

interface Budget {
  id: string;
  name: string;
  type: EntryType;
  goal: number;
  categoryIds: string[];
  monthKey: string;
}

// ── Stores ─────────────────────────────────────────────────

const userStore = useUserStore();
const transactionStore = useTransactionStore();

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
const showCategoryDropdown = ref(false);

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

const availableCategories = computed(() =>
  transactionStore.visibleCategories.filter(
    (c) => c.type === transactionType.value,
  ),
);

function getCategoryNameById(id: string): string {
  return (
    transactionStore.visibleCategories.find((c) => c.id === id)?.name ??
    "未知分類"
  );
}

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
const modalForm = ref({
  name: "",
  goal: 0,
  selectedCategoryIds: [] as string[],
});

function openAddModal(): void {
  editingBudget.value = null;
  modalForm.value = { name: "", goal: 0, selectedCategoryIds: [] };
  showCategoryDropdown.value = false;
  showModal.value = true;
}

function openEditModal(budget: Budget): void {
  editingBudget.value = budget;
  modalForm.value = {
    name: budget.name,
    goal: budget.goal,
    selectedCategoryIds: [...budget.categoryIds],
  };
  showCategoryDropdown.value = false;
  showModal.value = true;
}

function closeModal(): void {
  showModal.value = false;
  showCategoryDropdown.value = false;
  editingBudget.value = null;
}

function toggleCategory(id: string): void {
  const idx = modalForm.value.selectedCategoryIds.indexOf(id);
  if (idx === -1) {
    modalForm.value.selectedCategoryIds.push(id);
    if (modalForm.value.selectedCategoryIds.length === 1) {
      modalForm.value.name = getCategoryNameById(id);
    } else if (modalForm.value.selectedCategoryIds.length === 2) {
      modalForm.value.name = "";
    }
  } else {
    modalForm.value.selectedCategoryIds.splice(idx, 1);
    if (modalForm.value.selectedCategoryIds.length === 1) {
      modalForm.value.name = getCategoryNameById(
        modalForm.value.selectedCategoryIds[0]!,
      );
    }
  }
}

function saveBudget(): void {
  const { name, goal, selectedCategoryIds } = modalForm.value;
  const resolvedName =
    selectedCategoryIds.length === 1
      ? getCategoryNameById(selectedCategoryIds[0]!)
      : name.trim();
  if (!resolvedName || goal <= 0 || selectedCategoryIds.length === 0) return;

  if (editingBudget.value) {
    const idx = budgets.value.findIndex(
      (b) => b.id === editingBudget.value!.id,
    );
    if (idx !== -1) {
      budgets.value[idx] = {
        ...budgets.value[idx]!,
        name: resolvedName,
        goal,
        categoryIds: selectedCategoryIds,
      };
    }
  } else {
    budgets.value.push({
      id: `budget-${Date.now()}`,
      name: resolvedName,
      type: transactionType.value,
      goal,
      categoryIds: selectedCategoryIds,
      monthKey: currentMonthKey.value,
    });
  }
  closeModal();
}

function deleteBudget(): void {
  if (!editingBudget.value) return;
  budgets.value = budgets.value.filter((b) => b.id !== editingBudget.value!.id);
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

.month-chevron {
  display: inline-flex;
  align-items: center;
}

.month-chevron :deep(svg) {
  width: 16px;
  height: 16px;
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
  padding: 12px 16px;
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

/* ── Modal ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 1000;
  padding: 0;
}

@media (min-width: 480px) {
  .modal-overlay {
    align-items: center;
  }
}

.modal {
  background: var(--bg-page);
  border-radius: 20px 20px 0 0;
  width: 100%;
  max-width: 480px;
  padding: 24px;
  box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.15);
  max-height: 90vh;
  overflow-y: auto;
}

@media (min-width: 480px) {
  .modal {
    border-radius: 20px;
    width: 90%;
    max-height: 85vh;
  }
}

.modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.modal-header h3 {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.modal-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f0f0f0;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: var(--text-primary);
  transition: background 0.2s;
  flex-shrink: 0;
}

.modal-close:hover {
  background: #e0e0e0;
}

.modal-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 24px;
}

.modal-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.field-hint {
  font-size: 12px;
  color: var(--text-disabled);
  margin-top: -2px;
}

.field-input {
  width: 100%;
  padding: 12px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  font-size: 15px;
  font-family: inherit;
  color: var(--text-primary);
  background: var(--bg-page);
  outline: none;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.field-input:focus {
  border-color: var(--border-primary);
}

.field-input:disabled {
  background: #f5f5f5;
  color: var(--text-secondary);
  cursor: not-allowed;
}

.modal-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modal-btn {
  padding: 10px 20px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  border: 2px solid transparent;
  transition:
    opacity 0.2s,
    background 0.2s;
}

.modal-delete-btn {
  margin-right: auto;
  background: var(--janote-action-light, #fdd5d5);
  color: #b91c1c;
}

.modal-delete-btn:hover {
  background: var(--janote-action, #f87171);
  color: var(--text-light);
}

.modal-cancel-btn {
  background: #f0f0f0;
  color: var(--text-primary);
}

.modal-cancel-btn:hover {
  background: #e0e0e0;
}

.modal-save-btn {
  background: var(--text-primary);
  color: var(--text-light);
}

.modal-save-btn:hover {
  opacity: 0.8;
}

/* ── Modal transition ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal,
.modal-leave-active .modal {
  transition: transform 0.25s ease;
}

.modal-enter-from .modal {
  transform: translateY(40px);
}

.modal-leave-to .modal {
  transform: translateY(40px);
}

/* ── Floating Add Button ── */
.floating-actions-container {
  position: fixed;
  bottom: 24px;
  right: 16px;
  z-index: 1000;
}

.fab {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--janote-action);
  border: 2px solid var(--border-primary);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition:
    transform 0.2s,
    box-shadow 0.2s;
  padding: 0;
}

.fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.fab:active {
  transform: translateY(0);
}

/* ── Category multi-select ── */
.category-select-wrap {
  position: relative;
}

.category-select-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 14px;
  border: 2px solid #e0e0e0;
  border-radius: 12px;
  background: var(--bg-page);
  cursor: pointer;
  min-height: 48px;
  transition: border-color 0.2s;
}

.category-select-trigger:hover {
  border-color: var(--border-primary);
}

.select-preview {
  flex: 1;
  min-width: 0;
}

.select-placeholder {
  font-size: 15px;
  color: var(--text-disabled);
}

.select-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.category-pill {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: #f0f0f0;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.select-chevron {
  flex-shrink: 0;
  color: var(--text-disabled);
  transition: transform 0.2s;
}

.select-chevron.rotated {
  transform: rotate(180deg);
}

.category-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  overflow: hidden;
  z-index: 200;
  max-height: 220px;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.dropdown-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.dropdown-item:hover {
  background: #f9f9f9;
}

.dropdown-item.selected {
  background: #f5f5f5;
}

.dropdown-check {
  width: 20px;
  height: 20px;
  border: 2px solid #d0d0d0;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: var(--bg-page);
  transition: all 0.15s;
  color: var(--text-primary);
}

.dropdown-check.checked {
  background: var(--text-primary);
  border-color: var(--text-primary);
  color: white;
}

.dropdown-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  border-radius: 8px;
  flex-shrink: 0;
}

.dropdown-icon :deep(svg) {
  width: 16px;
  height: 16px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.dropdown-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.dropdown-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-disabled);
  font-size: 14px;
}

/* ── Responsive ── */
@media (max-width: 768px) {
  .header-section {
    padding: 10px 12px;
  }
}
</style>
