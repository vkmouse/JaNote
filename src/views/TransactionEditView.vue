<template>
  <div class="transaction-edit-page">
    <!-- Header -->
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <div class="date-display" @click="showCalendar = true">
          <span>{{ formattedDate }}</span>
        </div>
      </template>
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
      <!-- Header Section -->
      <div class="header-section">
        <div class="left-controls">
          <button
            class="page-badge transaction-badge"
            @click="router.replace('/transactions/budget/new')"
          >
            <span class="page-badge-icon" v-html="iconDollarCircle"></span>
            <span class="page-badge-label">記帳</span>
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
          v-model="selectedCategoryId"
          @select="onCategorySelect"
        />
      </div>

      <!-- Amount and Notes Input -->
      <AmountInput
        :icon="selectedCategoryIcon"
        :formattedAmount="formattedAmount"
        :type="transactionType"
        v-model="notes"
        placeholder="備註"
      />

      <!-- Calculator Panel -->
      <div class="input-panel">
        <CalculatorPad
          v-model="amount"
          :canConfirm="canSave"
          @confirm="saveTransaction"
        />
      </div>
    </div>

    <CalendarPicker v-model:open="showCalendar" v-model="currentDate" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import CalculatorPad from "../components/CalculatorPad.vue";
import type { Category, EntryType, Transaction } from "../types";
import { getCategoryIcon } from "../utils/categoryIcons";
import { useTransactionStore } from "../stores/transactionStore";
import { iconDollarCircle } from "../utils/icons";
import TypeToggle from "../components/TypeToggle.vue";
import CategoryGrid from "../components/CategoryGrid.vue";
import AmountInput from "../components/AmountInput.vue";

const router = useRouter();
const route = useRoute();
const transactionStore = useTransactionStore();

// State
const editingTransactionId = ref<string | null>(null);
const editingTransaction = ref<Transaction | null>(null);
const transactionType = ref<EntryType>("EXPENSE");
const selectedCategoryId = ref<string>("");
const amount = ref<string>("");
const notes = ref<string>("");
const previousAutoNote = ref<string | null>(null);
const currentDate = ref<number>(Date.now());
const showCalendar = ref(false);

// Computed properties
const filteredCategories = computed(() => {
  return transactionStore.visibleCategories.filter(
    (cat) => cat.type === transactionType.value,
  );
});

const formattedAmount = computed(() => {
  const num = amount.value || "0";
  // Add comma separators for numbers
  if (/^[0-9.]+$/.test(num)) {
    const parts = num.split(".");
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }
  return num;
});

const canSave = computed(() => {
  return !!(
    selectedCategoryId.value &&
    amount.value &&
    parseFloat(amount.value) > 0
  );
});

const selectedCategoryIcon = computed(() => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === selectedCategoryId.value,
  );
  return getCategoryIcon(category?.name || "其他");
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

// Methods
const loadCategories = async () => {
  await transactionStore.loadCategories();
};

const loadTransaction = async (id: string) => {
  const transaction = await transactionStore.getTransactionById(id);
  if (transaction) {
    editingTransactionId.value = id;
    editingTransaction.value = transaction;
    transactionType.value = transaction.type;
    selectedCategoryId.value = transaction.category_id;
    amount.value = String(transaction.amount);
    notes.value = transaction.note || "";
    currentDate.value = transaction.date;

    const category = transactionStore.visibleCategories.find(
      (c) => c.id === transaction.category_id,
    );
    if (category) {
      if (!transaction.note || transaction.note === category.name) {
        previousAutoNote.value = category.name;
      } else {
        previousAutoNote.value = null;
      }
    }
  }
};

const onCategorySelect = (category: Category) => {
  if (!notes.value || notes.value === previousAutoNote.value) {
    notes.value = category.name;
    previousAutoNote.value = category.name;
  } else {
    previousAutoNote.value = null;
  }
};

watch(notes, (newVal) => {
  if (previousAutoNote.value && newVal !== previousAutoNote.value) {
    previousAutoNote.value = null;
  }
});

const previousDate = () => {
  const date = new Date(currentDate.value);
  date.setDate(date.getDate() - 1);
  date.setHours(0, 0, 0, 0);
  currentDate.value = date.getTime();
};

const nextDate = () => {
  const date = new Date(currentDate.value);
  date.setDate(date.getDate() + 1);
  date.setHours(0, 0, 0, 0);
  currentDate.value = date.getTime();
};

const saveTransaction = async () => {
  if (!canSave.value) return;

  const isEditing = !!editingTransactionId.value;

  if (isEditing) {
    await transactionStore.updateTransaction({
      id: editingTransactionId.value!,
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

  router.replace("/transactions");
};

// Lifecycle
onMounted(async () => {
  await loadCategories();

  // Check if we're editing an existing transaction
  const transactionId = route.params.id as string;
  if (transactionId) {
    await loadTransaction(transactionId);
  }
});
</script>

<style scoped>
.transaction-edit-page {
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

/* Date display in TopNav */
.date-display {
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

.transaction-badge {
  background: var(--janote-expense-light);
  color: var(--text-primary);
  border-color: var(--janote-expense);
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

.back-icon {
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
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
