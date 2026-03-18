<template>
  <section class="recurring-page">
    <!-- Top Navigation -->
    <TopNavigation>
      <template #left><NavMenu /></template>
      <template #center><span class="page-title">固定</span></template>
      <template #right><NavAvatar /></template>
    </TopNavigation>

    <div class="page-content page">
      <!-- Header Section -->
      <div class="header-section">
        <TypeToggle
          v-model="viewMode"
          leftLabel="記帳"
          rightLabel="預算"
          leftValue="TRANSACTION"
          rightValue="BUDGET"
        />
        <TypeToggle v-model="filterType" />
      </div>

      <!-- Recurring Transactions List -->
      <div v-if="viewMode === 'TRANSACTION'" class="recurring-list">
        <div v-if="filteredRecurringTransactions.length === 0" class="empty-state">
          <p>暫無固定記帳</p>
        </div>
        <div v-else class="list-items">
          <div
            v-for="(item, index) in filteredRecurringTransactions"
            :key="item.id"
            class="list-item"
            @click="router.push(`/transactions/recurring/${item.id}/edit`)"
          >
            <div class="item-icon" v-html="getCategoryIconById(item.category_id)" />
            <div class="item-body">
              <span class="item-name">{{ item.note || getCategoryNameById(item.category_id) }}</span>
              <span class="item-recurrence">
                {{ formatRecurrence(item.recurrence_type, parseRecurrenceDays(item.recurrence_days)) }}
              </span>
            </div>
            <div class="item-right">
              <span :class="['item-amount', item.type.toLowerCase()]">
                ${{ item.amount.toLocaleString() }}
              </span>
              <label class="toggle-switch" @click.stop>
                <input
                  type="checkbox"
                  :checked="item.is_active === 1"
                  @change="recurringStore.toggleRecurringTransactionActive(item.id)"
                />
                <span class="toggle-slider" />
              </label>
            </div>
            <div
              v-if="index < filteredRecurringTransactions.length - 1"
              class="item-divider"
            />
          </div>
        </div>
      </div>

      <!-- Recurring Budgets List -->
      <div v-else class="recurring-list">
        <div v-if="filteredRecurringBudgets.length === 0" class="empty-state">
          <p>暫無固定預算</p>
        </div>
        <div v-else class="list-items">
          <div
            v-for="(item, index) in filteredRecurringBudgets"
            :key="item.id"
            class="list-item"
            @click="router.push(`/transactions/budget/recurring/${item.id}/edit`)"
          >
            <div class="item-icon" v-html="getBudgetIcon(item.category_ids)" />
            <div class="item-body">
              <span class="item-name">{{ item.name }}</span>
              <span class="item-recurrence">每月</span>
            </div>
            <div class="item-right">
              <span :class="['item-amount', item.type.toLowerCase()]">
                ${{ item.goal.toLocaleString() }}
              </span>
              <label class="toggle-switch" @click.stop>
                <input
                  type="checkbox"
                  :checked="item.is_active === 1"
                  @change="recurringStore.toggleRecurringBudgetActive(item.id)"
                />
                <span class="toggle-slider" />
              </label>
            </div>
            <div
              v-if="index < filteredRecurringBudgets.length - 1"
              class="item-divider"
            />
          </div>
        </div>
      </div>
    </div>

    <BottomTabBar
      :show-add-button="true"
      @add="router.push(viewMode === 'BUDGET' ? '/transactions/budget/recurring/new' : '/transactions/recurring/new')"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import TypeToggle from "../components/TypeToggle.vue";
import BottomTabBar from "../components/BottomTabBar.vue";
import { getCategoryIcon } from "../utils/categoryIcons";
import { formatRecurrence, parseRecurrenceDays } from "../utils/recurrence";
import { useTransactionStore } from "../stores/transactionStore";
import { useRecurringStore } from "../stores/recurringStore";
import type { EntryType } from "../types";

const router = useRouter();
const transactionStore = useTransactionStore();
const recurringStore = useRecurringStore();

// ── State ──────────────────────────────────────────────────
const viewMode = ref<"TRANSACTION" | "BUDGET">("TRANSACTION");
const filterType = ref<EntryType>("EXPENSE");

// ── Computed ───────────────────────────────────────────────
const filteredRecurringTransactions = computed(() =>
  recurringStore.visibleRecurringTransactions.filter(
    (t) => t.type === filterType.value,
  ),
);

const filteredRecurringBudgets = computed(() =>
  recurringStore.visibleRecurringBudgets.filter(
    (b) => b.type === filterType.value,
  ),
);

// ── Helpers ────────────────────────────────────────────────
function getCategoryNameById(id: string): string {
  return (
    transactionStore.visibleCategories.find((c) => c.id === id)?.name ?? "其他"
  );
}

function getCategoryIconById(id: string): string {
  const name = getCategoryNameById(id);
  return getCategoryIcon(name);
}

function getBudgetIcon(categoryIds: string): string {
  const ids = categoryIds.split(",").filter(Boolean);
  if (ids.length === 1) return getCategoryIconById(ids[0]!);
  return getCategoryIcon("其他");
}

// ── Lifecycle ──────────────────────────────────────────────
onMounted(async () => {
  await Promise.all([
    transactionStore.loadCategories(),
    recurringStore.loadRecurringTransactions(),
    recurringStore.loadRecurringBudgets(),
  ]);
});
</script>

<style scoped>
.recurring-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-page);
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

.page-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: calc(80px + env(safe-area-inset-bottom));
}

.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
}

/* List */
.recurring-list {
  flex: 1;
}

.list-items {
  display: flex;
  flex-direction: column;
  padding: 8px 16px;
}

.list-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 0;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.item-icon {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--janote-expense-light);
  border: 2px solid var(--border-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-icon :deep(svg) {
  width: 20px;
  height: 20px;
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-recurrence {
  font-size: 12px;
  color: var(--text-secondary);
}

.item-right {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.item-amount {
  font-size: 15px;
  font-weight: 700;
}

.item-amount.expense {
  color: var(--text-primary);
}

.item-amount.income {
  color: var(--text-primary);
}

.item-divider {
  position: absolute;
  bottom: 0;
  left: 52px;
  right: 0;
  height: 1px;
  background: var(--border-primary);
  opacity: 0.15;
}

/* Toggle switch */
.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  cursor: pointer;
  flex-shrink: 0;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
  position: absolute;
}

.toggle-slider {
  position: absolute;
  inset: 0;
  background: #e0e0e0;
  border-radius: 12px;
  transition: background 0.2s ease;
  border: 1.5px solid #ccc;
}

.toggle-slider::before {
  content: "";
  position: absolute;
  width: 18px;
  height: 18px;
  left: 2px;
  top: 50%;
  transform: translateY(-50%);
  background: #fff;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
  transition: transform 0.2s ease;
}

.toggle-switch input:checked + .toggle-slider {
  background: var(--janote-income);
  border-color: var(--janote-income);
}

.toggle-switch input:checked + .toggle-slider::before {
  transform: translateY(-50%) translateX(20px);
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
}
</style>
