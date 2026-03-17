<template>
  <div class="budget-edit-page">
    <!-- Header -->
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <div class="month-display" @click="showMonthPicker = true">
          <span>{{ selectedYear }}年{{ selectedMonth }}月</span>
        </div>
      </template>
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
      <!-- Header Section -->
      <div class="header-section">
        <div class="left-controls">
          <button
            class="page-badge budget-badge"
            @click="router.replace('/transactions/new')"
          >
            <span class="page-badge-icon" v-html="iconPiggyBank"></span>
            <span class="page-badge-label">預算</span>
          </button>
        </div>
        <div class="right-controls">
          <TypeToggle v-model="transactionType" />
        </div>
      </div>

      <!-- Categories Grid (multi-select) -->
      <div class="categories-section">
        <CategoryGrid
          :categories="filteredCategories"
          :multiple="true"
          v-model="selectedCategoryIds"
          @select="onCategorySelect"
        />
      </div>

      <!-- Amount and Budget Name Input -->
      <AmountInput
        :icon="budgetIcon"
        :formattedAmount="formattedAmount"
        :type="transactionType"
        v-model="budgetName"
        placeholder="預算名稱"
      />

      <!-- Calculator Panel -->
      <div class="input-panel">
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
import { iconPiggyBank } from "../utils/icons";
import TypeToggle from "../components/TypeToggle.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import AmountInput from "../components/AmountInput.vue";

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

// ── Category select ────────────────────────────────────────

function onCategorySelect(category: Category, selected: boolean): void {
  const ids = selectedCategoryIds.value;
  if (ids.length === 0) {
    budgetName.value = "";
  } else if (ids.length === 1) {
    budgetName.value = getCategoryNameById(ids[0]!);
  } else {
    budgetName.value = "";
  }
}

// ── Month navigation ───────────────────────────────────────

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
    month_key: `${selectedYear.value}${String(selectedMonth.value).padStart(2, "0")}`,
    category_ids: selectedCategoryIds.value.join(","),
  };

  if (editingBudgetId.value) {
    await budgetStore.updateBudget({ id: editingBudgetId.value, ...payload });
  } else {
    await budgetStore.addBudget(payload);
  }

  router.replace("/transactions/budget");
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
  const yearStr = budget.month_key.slice(0, 4);
  const monthStr = budget.month_key.slice(4, 6);
  selectedYear.value = parseInt(yearStr || String(new Date().getFullYear()));
  selectedMonth.value = parseInt(monthStr || String(new Date().getMonth() + 1));
}

// ── Lifecycle ──────────────────────────────────────────────

onMounted(async () => {
  await transactionStore.loadCategories();

  const budgetId = route.params.id as string | undefined;
  if (budgetId) {
    await loadBudget(budgetId);
  } else {
    // Apply state passed from BudgetView (no querystring needed)
    const state = window.history.state as
      | { type?: string; year?: number; month?: number }
      | undefined;
    if (state?.type === "EXPENSE" || state?.type === "INCOME") {
      transactionType.value = state.type;
    }
    if (state?.year) selectedYear.value = state.year;
    if (state?.month) selectedMonth.value = state.month;
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

/* Input Panel */
.input-panel {
  flex-shrink: 0;
  background: var(--janote-expense);
  margin: 0;
  border-radius: 0;
  padding: 16px;
}

/* Header Section */
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

/* Month display in TopNav */
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
  cursor: pointer;
  background: none;
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
