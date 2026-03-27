<template>
  <section class="transactions-page">
    <!-- Top Navigation Bar -->
    <TopNavigation>
      <template #left>
        <NavMenu />
        <NavSearch />
        <NavDelete :active="deleteMode" @click="toggleDeleteMode" />
      </template>
      <template #center>
        <div class="month-display" @click="showMonthPicker = true">
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

    <div class="page-content page">
      <!-- Stats Section -->
      <div class="stats-section">
        <div class="summary-section">
          <div class="summary-item summary-item-left">
            <div class="summary-label">月支出</div>
            <div class="summary-amount">
              ${{ monthlyExpense.toLocaleString() }}
            </div>
          </div>
          <div class="summary-item summary-item-right">
            <div class="summary-label">月收入</div>
            <div class="summary-amount">
              ${{ monthlyIncome.toLocaleString() }}
            </div>
          </div>
        </div>
        <div class="chart-section">
          <DonutChart
            :center-label="'月結餘'"
            :center-balance="`$${balance.toLocaleString()}`"
            :slices="chartSlices"
          />
        </div>
      </div>

      <!-- Daily Transaction List -->
      <div class="transaction-list">
        <div v-if="groupedTransactions.length === 0" class="empty-state">
          <p>暫無交易記錄</p>
        </div>

        <div v-else class="daily-groups">
          <ListGroup
            v-for="group in groupedTransactions"
            :key="group.date"
          >
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <template #header-right>
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
            </template>
            <ListItem
              v-for="transaction in group.transactions"
              :key="transaction.id"
              class="transaction-item"
              :class="{
                'transaction-item--delete': deleteMode && !isViewingShared,
              }"
              @click="!isViewingShared && onTransactionClick(transaction.id)"
            >
              <div class="item-left">
                <CategoryIcon
                  :category-name="getCategoryName(transaction.category_id)"
                  color-mode="type"
                  :entry-type="transaction.type"
                />
                <span class="category-name">{{
                  transaction.note || "無備註"
                }}</span>
              </div>
              <div :class="['item-amount', transaction.type.toLowerCase()]">
                ${{ transaction.type === "EXPENSE" ? "-" : ""
                }}{{ transaction.amount.toLocaleString() }}
              </div>
            </ListItem>
          </ListGroup>
        </div>
      </div>
    </div>

    <BottomTabBar />

    <!-- Delete Confirm Modal -->
    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除交易"
      message="確定要刪除這筆交易嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import type { Transaction } from "../types";
import CategoryIcon from "../components/CategoryIcon.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import NavDelete from "../components/NavDelete.vue";
import { useUserStore } from "../stores/userStore";
import { useTransactionStore } from "../stores/transactionStore";
import BottomTabBar from "../components/BottomTabBar.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";

const router = useRouter();
const userStore = useUserStore();
const transactionStore = useTransactionStore();
const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);

// Delete mode
const deleteMode = ref(false);
const showDeleteConfirm = ref(false);
const deletingTransactionId = ref<string | null>(null);

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

const chartSlices = computed<DonutSlice[]>(() => [
  {
    sliceLabel: "月收入",
    sliceValue: incomePercentage.value,
    sliceColor: "#47B8E0",
  },
  {
    sliceLabel: "月支出",
    sliceValue: expensePercentage.value,
    sliceColor: "#FFC952",
  },
]);

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

const getCategoryName = (categoryId: string): string => {
  const category = transactionStore.visibleCategories.find(
    (c) => c.id === categoryId,
  );
  return category?.name || "其他";
};

const editTransaction = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/transaction/${id}/edit`);
};

const toggleDeleteMode = () => {
  deleteMode.value = !deleteMode.value;
};

const onTransactionClick = (id: string) => {
  if (deleteMode.value) {
    deletingTransactionId.value = id;
    showDeleteConfirm.value = true;
  } else {
    editTransaction(id);
  }
};

const confirmDelete = async () => {
  showDeleteConfirm.value = false;
  const id = deletingTransactionId.value;
  deletingTransactionId.value = null;
  if (!id || isViewingShared.value) return;
  await transactionStore.deleteTransaction(id);
};

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  deletingTransactionId.value = null;
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

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}

.stats-section {
  background: var(--bg-page);
}

.summary-section {
  display: flex;
  justify-content: space-between;
  padding: 6px 16px 0;
  height: 61px;
  background: var(--bg-page);
}

.summary-item {
  display: flex;
  flex-direction: column;
  width: fit-content;
}

.summary-item-left {
  align-items: flex-start;
}

.summary-item-right {
  align-items: flex-end;
}

.summary-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  border-bottom: 3px solid;
}

.summary-item:nth-child(1) .summary-label {
  border-color: var(--janote-expense);
}

.summary-item:nth-child(2) .summary-label {
  border-color: var(--janote-income);
}

.summary-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-section {
  background: var(--bg-page);
  padding-bottom: 16px;
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

.transaction-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  background: var(--bg-page);
  transition: background 0.15s;
  -webkit-tap-highlight-color: transparent;
  gap: 8px;
}

.transaction-item:active {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.transaction-item--delete {
  cursor: pointer;
}

.transaction-item--delete:active {
  background: rgba(239, 68, 68, 0.08);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
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
  color: var(--text-primary);
}

</style>
