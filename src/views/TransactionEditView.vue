<template>
  <div class="edit-page">
    <!-- Header -->
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <!-- Transaction (non-recurring): date picker -->
        <div v-if="!isBudget && !isRecurring" class="date-display" @click="showCalendar = true">
          <span>{{ formattedDate }}</span>
        </div>
        <!-- Transaction recurring: recurrence picker -->
        <div v-else-if="!isBudget && isRecurring" class="recurrence-display" @click="showRecurrencePicker = true">
          <span>{{ formattedRecurrence }}</span>
        </div>
        <!-- Budget (non-recurring): month picker -->
        <div v-else-if="isBudget && !isRecurring" class="month-display" @click="showMonthPicker = true">
          <span>{{ selectedYear }}年{{ selectedMonth }}月</span>
        </div>
        <!-- Budget recurring: static -->
        <div v-else class="recurrence-display">
          <span>每月1日</span>
        </div>
      </template>
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
      <!-- Header Section -->
      <div class="header-section">
        <div class="left-controls">
          <!-- Main mode badge: 記帳 / 預算 -->
          <button
            :class="['page-badge', isBudget ? 'budget-badge' : 'transaction-badge']"
            @click="toggleMode"
          >
            <span class="page-badge-icon" v-html="isBudget ? iconPiggyBank : iconDollarCircle"></span>
            <span class="page-badge-label">{{ isBudget ? '預算' : '記帳' }}</span>
          </button>
          <!-- Fixed badge: active / inactive -->
          <button
            :class="['page-badge', isRecurring ? 'recurring-badge-active' : 'recurring-badge-inactive']"
            @click="toggleRecurring"
          >
            <span class="page-badge-icon" v-html="iconTag"></span>
            <span class="page-badge-label">固定</span>
          </button>
        </div>
        <div class="right-controls">
          <TypeToggle v-model="transactionType" />
        </div>
      </div>

      <!-- Categories Grid -->
      <div class="categories-section">
        <CategoryGrid
          :categories="filteredCategories"
          :multiple="isBudget"
          :modelValue="isBudget ? selectedCategoryIds : selectedCategoryId"
          @update:modelValue="handleCategoryUpdate"
          @select="onCategorySelect"
        />
      </div>

      <!-- Amount and Notes / Budget Name Input -->
      <AmountInput
        :categoryName="displayCategoryName"
        :formattedAmount="formattedAmount"
        :type="transactionType"
        :modelValue="isBudget ? budgetName : notes"
        @update:modelValue="handleTextUpdate"
        :placeholder="isBudget ? '預算名稱' : '備註'"
      />

      <!-- Calculator Panel -->
      <div class="input-panel">
        <CalculatorPad
          v-model="amount"
          :canConfirm="canSave"
          @confirm="save"
        />
      </div>
    </div>

    <CalendarPicker v-if="!isBudget && !isRecurring" v-model:open="showCalendar" v-model="currentDate" />
    <MonthPicker v-if="isBudget && !isRecurring" v-model:open="showMonthPicker" v-model:year="selectedYear" v-model:month="selectedMonth" />
    <RecurrencePicker v-if="!isBudget && isRecurring" v-model:open="showRecurrencePicker" v-model:recurrenceType="recurrenceType" v-model:recurrenceDay="recurrenceDay" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import MonthPicker from "../components/MonthPicker.vue";
import RecurrencePicker from "../components/RecurrencePicker.vue";
import CalculatorPad from "../components/CalculatorPad.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import AmountInput from "../components/AmountInput.vue";
import TypeToggle from "../components/TypeToggle.vue";
import type { Category, EntryType } from "../types";
import { formatRecurrence } from "../utils/recurrence";
import { useTransactionStore } from "../stores/transactionStore";
import { useBudgetStore } from "../stores/budgetStore";
import { useRecurringStore } from "../stores/recurringStore";
import { useUserStore } from "../stores/userStore";
import { iconDollarCircle, iconPiggyBank, iconTag } from "../utils/icons";

const router = useRouter();
const route = useRoute();
const transactionStore = useTransactionStore();
const budgetStore = useBudgetStore();
const recurringStore = useRecurringStore();
const userStore = useUserStore();

// ── Mode detection ─────────────────────────────────────────
const isBudget = computed(() => route.path.includes("/budget"));
const isRecurring = computed(() => route.path.includes("/recurring"));

// ── Shared state ───────────────────────────────────────────
const editingId = ref<string | null>(null);
const transactionType = ref<EntryType>("EXPENSE");
const amount = ref<string>("");

// ── Transaction mode state ─────────────────────────────────
const selectedCategoryId = ref<string>("");
const notes = ref<string>("");
const previousAutoNote = ref<string | null>(null);
const currentDate = ref<number>(Date.now());
const showCalendar = ref(false);

// ── Budget mode state ──────────────────────────────────────
const selectedCategoryIds = ref<string[]>([]);
const budgetName = ref<string>("");
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);

// ── Recurring mode state ───────────────────────────────────
const recurrenceType = ref<"MONTHLY" | "WEEKLY">("MONTHLY");
const recurrenceDay = ref<number>(1);
const showRecurrencePicker = ref(false);

// ── Computed ───────────────────────────────────────────────
const filteredCategories = computed(() =>
  transactionStore.visibleCategories.filter((cat) => cat.type === transactionType.value),
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
  if (isBudget.value) {
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
  }
  return !!(selectedCategoryId.value && amount.value && parseFloat(amount.value) > 0);
});

const displayCategoryName = computed(() => {
  if (isBudget.value) {
    if (selectedCategoryIds.value.length === 1) {
      const cat = transactionStore.visibleCategories.find(
        (c) => c.id === selectedCategoryIds.value[0],
      );
      return cat?.name ?? "其他";
    }
    return "其他";
  }
  const cat = transactionStore.visibleCategories.find((c) => c.id === selectedCategoryId.value);
  return cat?.name || "其他";
});

const formattedDate = computed(() => {
  const date = new Date(currentDate.value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const weekDays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekDay = weekDays[date.getDay()];
  return `${year}年${month}月${day} 星期${weekDay}`;
});

const formattedRecurrence = computed(() =>
  formatRecurrence(recurrenceType.value, recurrenceDay.value),
);

// ── Helpers ────────────────────────────────────────────────
function getCategoryNameById(id: string): string {
  return transactionStore.visibleCategories.find((c) => c.id === id)?.name ?? "未知分類";
}

// ── Event handlers ─────────────────────────────────────────
function handleCategoryUpdate(v: string | string[]) {
  if (isBudget.value) {
    selectedCategoryIds.value = v as string[];
  } else {
    selectedCategoryId.value = v as string;
  }
}

function handleTextUpdate(v: string) {
  if (isBudget.value) {
    budgetName.value = v;
  } else {
    notes.value = v;
  }
}

const onCategorySelect = (category: Category, _selected?: boolean) => {
  if (isBudget.value) {
    const ids = selectedCategoryIds.value;
    if (ids.length === 0) {
      budgetName.value = "";
    } else if (ids.length === 1) {
      budgetName.value = getCategoryNameById(ids[0]!);
    } else {
      budgetName.value = "";
    }
  } else {
    if (!notes.value || notes.value === previousAutoNote.value) {
      notes.value = category.name;
      previousAutoNote.value = category.name;
    } else {
      previousAutoNote.value = null;
    }
  }
};

watch(notes, (newVal) => {
  if (previousAutoNote.value && newVal !== previousAutoNote.value) {
    previousAutoNote.value = null;
  }
});

// ── Badge navigation ───────────────────────────────────────
// Clicking 記帳/預算 badge → toggle mode, keep recurring state
function toggleMode() {
  if (!isBudget.value && !isRecurring.value) {
    router.replace("/transactions/budget/new");
  } else if (!isBudget.value && isRecurring.value) {
    router.replace("/transactions/budget/recurring/new");
  } else if (isBudget.value && !isRecurring.value) {
    router.replace("/transactions/new");
  } else {
    router.replace("/transactions/recurring/new");
  }
}

// Clicking 固定 badge → toggle recurring, keep mode
function toggleRecurring() {
  if (!isBudget.value && !isRecurring.value) {
    router.replace("/transactions/recurring/new");
  } else if (!isBudget.value && isRecurring.value) {
    router.replace("/transactions/new");
  } else if (isBudget.value && !isRecurring.value) {
    router.replace("/transactions/budget/recurring/new");
  } else {
    router.replace("/transactions/budget/new");
  }
}

// ── Save ───────────────────────────────────────────────────
async function save() {
  if (!canSave.value) return;
  if (!isBudget.value && !isRecurring.value) {
    await saveTransaction();
  } else if (!isBudget.value && isRecurring.value) {
    await saveRecurringTransaction();
  } else if (isBudget.value && !isRecurring.value) {
    await saveBudget();
  } else {
    await saveRecurringBudget();
  }
}

async function saveTransaction() {
  if (editingId.value) {
    await transactionStore.updateTransaction({
      id: editingId.value,
      category_id: selectedCategoryId.value,
      type: transactionType.value,
      amount: parseFloat(amount.value),
      note: notes.value,
      date: currentDate.value,
    });
  } else {
    await transactionStore.addTransaction({
      category_id: selectedCategoryId.value,
      type: transactionType.value,
      amount: parseFloat(amount.value),
      note: notes.value,
      date: currentDate.value,
    });
  }
  router.back();
}

async function saveBudget() {
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
  if (editingId.value) {
    await budgetStore.updateBudget({ id: editingId.value, ...payload });
  } else {
    await budgetStore.addBudget(payload);
  }
  router.back();
}

async function saveRecurringTransaction() {
  if (editingId.value) {
    await recurringStore.updateRecurringTransaction({
      id: editingId.value,
      category_id: selectedCategoryId.value,
      type: transactionType.value,
      amount: parseFloat(amount.value),
      note: notes.value,
      recurrence_type: recurrenceType.value,
      recurrence_day: recurrenceDay.value,
    });
  } else {
    await recurringStore.addRecurringTransaction({
      category_id: selectedCategoryId.value,
      type: transactionType.value,
      amount: parseFloat(amount.value),
      note: notes.value,
      recurrence_type: recurrenceType.value,
      recurrence_day: recurrenceDay.value,
    });
  }
  router.replace("/transactions/recurring");
}

async function saveRecurringBudget() {
  const resolvedName =
    selectedCategoryIds.value.length === 1
      ? getCategoryNameById(selectedCategoryIds.value[0]!)
      : budgetName.value.trim();
  const payload = {
    name: resolvedName,
    type: transactionType.value,
    goal: parseFloat(amount.value),
    category_ids: selectedCategoryIds.value.join(","),
  };
  if (editingId.value) {
    await recurringStore.updateRecurringBudget({ id: editingId.value, ...payload });
  } else {
    await recurringStore.addRecurringBudget(payload);
  }
  router.replace("/transactions/recurring");
}

// ── Load existing ──────────────────────────────────────────
async function loadTransaction(id: string) {
  const transaction = await transactionStore.getTransactionById(id);
  if (!transaction) return;
  editingId.value = id;
  transactionType.value = transaction.type;
  selectedCategoryId.value = transaction.category_id;
  amount.value = String(transaction.amount);
  notes.value = transaction.note || "";
  currentDate.value = transaction.date;
  const cat = transactionStore.visibleCategories.find((c) => c.id === transaction.category_id);
  if (cat) {
    previousAutoNote.value = !transaction.note || transaction.note === cat.name ? cat.name : null;
  }
}

async function loadBudget(id: string) {
  await budgetStore.loadBudgets();
  const budget = budgetStore.visibleBudgets.find((b) => b.id === id);
  if (!budget) return;
  editingId.value = id;
  transactionType.value = budget.type;
  selectedCategoryIds.value = budget.category_ids.split(",").filter(Boolean);
  budgetName.value = budget.name;
  amount.value = String(budget.goal);
  selectedYear.value = parseInt(budget.month_key.slice(0, 4) || String(new Date().getFullYear()));
  selectedMonth.value = parseInt(budget.month_key.slice(4, 6) || String(new Date().getMonth() + 1));
}

async function loadRecurringTransaction(id: string) {
  await recurringStore.loadRecurringTransactions();
  const item = recurringStore.visibleRecurringTransactions.find((t) => t.id === id);
  if (!item) return;
  editingId.value = id;
  transactionType.value = item.type;
  selectedCategoryId.value = item.category_id;
  amount.value = String(item.amount);
  notes.value = item.note;
  recurrenceType.value = item.recurrence_type;
  recurrenceDay.value = item.recurrence_day ?? 1;
}

async function loadRecurringBudget(id: string) {
  await recurringStore.loadRecurringBudgets();
  const item = recurringStore.visibleRecurringBudgets.find((b) => b.id === id);
  if (!item) return;
  editingId.value = id;
  transactionType.value = item.type;
  selectedCategoryIds.value = item.category_ids.split(",").filter(Boolean);
  budgetName.value = item.name;
  amount.value = String(item.goal);
}

// ── Lifecycle ──────────────────────────────────────────────
onMounted(async () => {
  // Shared viewers cannot create or edit recurring items
  if (userStore.isViewingShared && isRecurring.value) {
    router.replace("/transactions/recurring");
    return;
  }

  await transactionStore.loadCategories();

  const id = route.params.id as string | undefined;
  if (id) {
    if (!isBudget.value && !isRecurring.value) {
      await loadTransaction(id);
    } else if (!isBudget.value && isRecurring.value) {
      await loadRecurringTransaction(id);
    } else if (isBudget.value && !isRecurring.value) {
      await loadBudget(id);
    } else {
      await loadRecurringBudget(id);
    }
  } else if (isBudget.value && !isRecurring.value) {
    // Apply state passed from BudgetView via history.state
    const state = window.history.state as
      | { type?: string; year?: number; month?: number }
      | undefined;
    if (state?.type === "EXPENSE" || state?.type === "INCOME") {
      transactionType.value = state.type as EntryType;
    }
    if (state?.year) selectedYear.value = state.year;
    if (state?.month) selectedMonth.value = state.month;
  }
});
</script>

<style scoped>
.edit-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

.edit-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

.categories-section {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
}

.input-panel {
  flex-shrink: 0;
  background: var(--janote-expense);
  margin: 0;
  border-radius: 0;
  padding: 16px;
}

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 13px 12px;
}

.left-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}

.right-controls {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.date-display,
.month-display,
.recurrence-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  user-select: none;
}

.date-display,
.month-display {
  cursor: pointer;
}

.recurrence-display {
  cursor: pointer;
}

.categories-section::-webkit-scrollbar { width: 4px; }
.categories-section::-webkit-scrollbar-track { background: transparent; }
.categories-section::-webkit-scrollbar-thumb { background: #ddd; border-radius: 2px; }
.categories-section::-webkit-scrollbar-thumb:hover { background: var(--text-disabled); }
</style>
