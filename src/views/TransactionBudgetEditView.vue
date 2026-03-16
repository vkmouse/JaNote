<template>
  <div class="budget-edit-page">
    <!-- Header -->
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #right>
        <div class="page-badge budget-badge">
          <span class="page-badge-icon" v-html="PiggyBankIcon"></span>
          <span class="page-badge-label">預算</span>
        </div>
      </template>
      <template #center>
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
      </template>
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
      <!-- Categories Grid (multi-select) -->
      <div class="categories-section">
        <div class="categories-grid">
          <button
            v-for="category in filteredCategories"
            :key="category.id"
            :class="[
              'category-item',
              { selected: selectedCategoryIds.includes(category.id) },
            ]"
            @click="toggleCategory(category)"
          >
            <div
              class="category-icon-wrapper"
              v-html="getCategoryIcon(category.name)"
            ></div>
            <span class="category-label">{{ category.name }}</span>
          </button>
        </div>
      </div>

      <!-- Amount and Budget Name Input -->
      <div class="input-section">
        <div class="input-group">
          <label class="label">
            <div class="category-icon-display" v-html="budgetIcon"></div>
            <span
              :class="[
                'amount-display',
                {
                  'amount-expense': transactionType === 'EXPENSE',
                  'amount-income': transactionType === 'INCOME',
                },
              ]"
              >{{ "$" + formattedAmount }}</span
            >
          </label>
          <input
            v-model="budgetName"
            type="text"
            placeholder="預算名稱"
            class="notes-input"
          />
        </div>
      </div>

      <!-- Month Picker & Calculator Panel -->
      <div class="input-panel">
        <div class="month-section">
          <button class="date-control-btn" @click="previousMonth">
            <span v-html="ArrowLeftIcon" class="arrow-icon"></span>
          </button>
          <button class="date-info" @click="showMonthPicker = true">
            <span class="date-text"
              >{{ selectedYear }}年{{ selectedMonth }}月</span
            >
          </button>
          <button class="date-control-btn" @click="nextMonth">
            <span v-html="ArrowRightIcon" class="arrow-icon"></span>
          </button>
        </div>
        <CalculatorPad
          v-model="amount"
          :canConfirm="canSave"
          @confirm="saveBudget"
        />
      </div>
    </div>

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CalculatorPad from "../components/CalculatorPad.vue";
import MonthPicker from "../components/MonthPicker.vue";
import type { Category, EntryType } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useTransactionStore } from "../stores/transactionStore";
import { useBudgetStore } from "../stores/budgetStore";
import ArrowLeftIcon from "../assets/icons/icon-arrow-left.svg?raw";
import ArrowRightIcon from "../assets/icons/icon-arrow-right.svg?raw";
import PiggyBankIcon from "../assets/icons/new/icon-piggy-bank.svg?raw";

const router = useRouter();
const route = useRoute();
const transactionStore = useTransactionStore();
const budgetStore = useBudgetStore();

// ── State ──────────────────────────────────────────────────

const editingBudgetId = ref<string | null>(null);
const transactionType = ref<EntryType>("EXPENSE");
const selectedCategoryIds = ref<string[]>([]);
const budgetName = ref<string>("");
const amount = ref<string>("");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);

// ── Computed ───────────────────────────────────────────────

const filteredCategories = computed(() =>
  transactionStore.visibleCategories.filter(
    (cat) => cat.type === transactionType.value,
  ),
);

const formattedAmount = computed(() => {
  const num = amount.value || "0";
  if (/^[0-9.]+$/.test(num)) {
    const parts = num.split(".");
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  return num;
});

const canSave = computed(() => {
  const resolvedName =
    selectedCategoryIds.value.length === 1
      ? getCategoryNameById(selectedCategoryIds.value[0]!)
      : budgetName.value.trim();
  return !!(
    selectedCategoryIds.value.length > 0 &&
    resolvedName &&
    amount.value &&
    parseFloat(amount.value) > 0
  );
});

const budgetIcon = computed(() => {
  if (selectedCategoryIds.value.length === 1) {
    const cat = transactionStore.visibleCategories.find(
      (c) => c.id === selectedCategoryIds.value[0],
    );
    return getCategoryIcon(cat?.name ?? "其他");
  }
  return getCategoryIcon("其他");
});

// ── Helpers ────────────────────────────────────────────────

function getCategoryNameById(id: string): string {
  return (
    transactionStore.visibleCategories.find((c) => c.id === id)?.name ??
    "未知分類"
  );
}

// ── Category multi-select ──────────────────────────────────

function toggleCategory(category: Category): void {
  const idx = selectedCategoryIds.value.indexOf(category.id);
  if (idx === -1) {
    selectedCategoryIds.value.push(category.id);
    if (selectedCategoryIds.value.length === 1) {
      budgetName.value = category.name;
    } else if (selectedCategoryIds.value.length === 2) {
      budgetName.value = "";
    }
  } else {
    selectedCategoryIds.value.splice(idx, 1);
    if (selectedCategoryIds.value.length === 1) {
      budgetName.value = getCategoryNameById(selectedCategoryIds.value[0]!);
    } else if (selectedCategoryIds.value.length === 0) {
      budgetName.value = "";
    }
  }
}

// ── Month navigation ───────────────────────────────────────

function previousMonth(): void {
  if (selectedMonth.value === 1) {
    selectedYear.value -= 1;
    selectedMonth.value = 12;
  } else {
    selectedMonth.value -= 1;
  }
}

function nextMonth(): void {
  if (selectedMonth.value === 12) {
    selectedYear.value += 1;
    selectedMonth.value = 1;
  } else {
    selectedMonth.value += 1;
  }
}

// ── Save ───────────────────────────────────────────────────

async function saveBudget(): Promise<void> {
  if (!canSave.value) return;

  const resolvedName =
    selectedCategoryIds.value.length === 1
      ? getCategoryNameById(selectedCategoryIds.value[0]!)
      : budgetName.value.trim();

  const payload = {
    name: resolvedName,
    type: transactionType.value,
    goal: parseFloat(amount.value),
    month_key: `${selectedYear.value}-${selectedMonth.value}`,
    category_ids: selectedCategoryIds.value.join(","),
  };

  if (editingBudgetId.value) {
    await budgetStore.updateBudget({ id: editingBudgetId.value, ...payload });
  } else {
    await budgetStore.addBudget(payload);
  }

  router.push("/transactions/budget");
}

// ── Load existing budget ───────────────────────────────────

async function loadBudget(id: string): Promise<void> {
  await budgetStore.loadBudgets();
  const budget = budgetStore.visibleBudgets.find((b) => b.id === id);
  if (!budget) return;

  editingBudgetId.value = id;
  transactionType.value = budget.type;
  selectedCategoryIds.value = budget.category_ids.split(",").filter(Boolean);
  budgetName.value = budget.name;
  amount.value = String(budget.goal);
  const [yearStr, monthStr] = budget.month_key.split("-");
  selectedYear.value = parseInt(yearStr ?? String(new Date().getFullYear()));
  selectedMonth.value = parseInt(monthStr ?? String(new Date().getMonth() + 1));
}

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  await transactionStore.loadCategories();

  const budgetId = route.params.id as string | undefined;
  if (budgetId) {
    await loadBudget(budgetId);
  } else {
    // Apply query params for new budget
    const typeParam = route.query.type as string | undefined;
    const yearParam = route.query.year as string | undefined;
    const monthParam = route.query.month as string | undefined;
    if (typeParam === "EXPENSE" || typeParam === "INCOME") {
      transactionType.value = typeParam;
    }
    if (yearParam) selectedYear.value = parseInt(yearParam);
    if (monthParam) selectedMonth.value = parseInt(monthParam);
  }
});
</script>

<style scoped>
.budget-edit-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

/* Type Toggle inside TopNavigation */
.type-toggle {
  display: flex;
  background: #f5f5f5;
  border-radius: 12px;
  border: 2px solid var(--border-primary);
}

.toggle-btn {
  padding: 4px 20px;
  border: none;
  background: var(--bg-page);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}

.toggle-btn.expense-active {
  background: var(--janote-expense);
  color: var(--text-primary);
  border-color: transparent;
}

.toggle-btn.income-active {
  background: var(--janote-income);
  color: var(--text-light);
  border-color: transparent;
}

/* Main Content */
.edit-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* Categories Section */
.categories-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.category-item {
  padding: 6px 4px;
  border: 2px solid transparent;
  border-radius: 12px;
  background: transparent;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  transition:
    background 0.2s,
    border-color 0.2s;
}

.category-item.selected {
  background: #f0f0f0;
  border-color: var(--border-primary);
}

.category-item.selected .category-icon-wrapper {
  position: relative;
}

.category-item.selected .category-icon-wrapper::after {
  content: "";
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  background: var(--border-primary);
  border-radius: 50%;
  border: 1.5px solid var(--bg-page);
}

.category-icon-wrapper {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon-wrapper :deep(svg) {
  width: 24px;
  height: 24px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.category-label {
  font-size: 12px;
  font-weight: 500;
  text-align: center;
  word-break: break-word;
  color: var(--text-primary);
  line-height: 1.2;
}

/* Input Section */
.input-section {
  flex-shrink: 0;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 150px;
}

.category-icon-display {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.category-icon-display :deep(svg) {
  width: 24px;
  height: 24px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.amount-display {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.notes-input {
  flex: 1;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 8px;
  font-size: 13px;
  outline: none;
  transition: border-color 0.2s;
}

.notes-input:focus {
  border-color: var(--border-primary);
}

/* Input Panel */
.input-panel {
  flex-shrink: 0;
  background: var(--janote-expense);
  margin: 0;
  border-radius: 0;
  padding: 16px;
}

/* Month Section (mirrors CalendarPicker's date-section) */
.month-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
  background: #ffffff;
  border-radius: 8px;
  border: 2px solid var(--border-primary);
}

.date-control-btn {
  background: transparent;
  border: 0;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.date-control-btn:active {
  background: var(--bg-active, #e0e0e0);
}

.date-info {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex: 1;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 8px 12px;
  border-radius: 8px;
  transition: all 0.2s;
}

.date-text {
  color: var(--text-primary);
  font-weight: 600;
  font-size: 16px;
  white-space: nowrap;
}

.arrow-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

/* Page badge */
.page-badge {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px 4px 6px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  border: 2px solid;
  white-space: nowrap;
}

.budget-badge {
  background: var(--janote-income-light);
  color: var(--text-primary);
  border-color: var(--janote-income);
}

.page-badge-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.page-badge-icon :deep(svg) {
  width: 16px;
  height: 16px;
  stroke: currentColor;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.page-badge-label {
  line-height: 1;
}

/* Scrollbar styling */
.categories-section::-webkit-scrollbar {
  width: 4px;
}

.categories-section::-webkit-scrollbar-track {
  background: transparent;
}

.categories-section::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 2px;
}

.categories-section::-webkit-scrollbar-thumb:hover {
  background: var(--text-disabled);
}
</style>
