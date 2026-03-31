<template>
  <section class="recurring-page">
    <!-- Top Navigation -->
    <TopNavigation>
      <template #left>
        <NavMenu />
        <NavSearch />
      </template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <div class="page-content page">
      <!-- Header Section -->
      <div class="header-section">
        <div class="left-controls">
          <button
            :class="['page-badge', viewMode === 'TRANSACTION' ? 'transaction-badge' : 'budget-badge']"
            @click="viewMode = viewMode === 'TRANSACTION' ? 'BUDGET' : 'TRANSACTION'"
          >
            <span class="page-badge-icon" v-html="viewMode === 'TRANSACTION' ? iconDollarCircle : iconPiggyBank"></span>
            <span class="page-badge-label">{{ viewMode === 'TRANSACTION' ? '記帳' : '預算' }}</span>
          </button>
        </div>
        <div class="right-controls">
          <TypeToggle v-model="filterType" />
        </div>
      </div>

      <!-- Recurring Transactions List -->
      <div v-if="viewMode === 'TRANSACTION'" class="recurring-list">
        <div v-if="filteredRecurringTransactions.length === 0" class="empty-state">
          <p>暫無固定記帳</p>
        </div>
        <ListGroup v-else>
          <template #header-left>
            <span class="group-title">固定記帳</span>
          </template>
          <template #header-right />
          <ListItem
            v-for="item in filteredRecurringTransactions"
            :key="item.id"
            :swipeable="!isViewingShared"
            @delete="onItemSwipeDelete('TRANSACTION', item.id)"
            @edit="onItemClick('TRANSACTION', item.id)"
            @item-click="goToSearchByRecurring(item)"
          >
            <div
              class="recurring-item"
              :class="{ 'recurring-item--readonly': isViewingShared }"
              @click="isViewingShared && goToSearchByRecurring(item)"
            >
              <div class="item-icon">
                <CategoryIcon :category-name="getCategoryNameById(item.category_id)" color-mode="type" :entry-type="item.type" />
              </div>
              <div class="item-body">
                <span class="item-name">{{
                  item.note || getCategoryNameById(item.category_id)
                }}</span>
                <span class="item-recurrence">
                  {{
                    formatRecurrence(
                      item.recurrence_type,
                      item.recurrence_day ?? 1,
                    )
                  }}
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
                    :disabled="isViewingShared"
                    @change="
                      !isViewingShared &&
                      recurringStore.toggleRecurringTransactionActive(item.id)
                    "
                  />
                  <span class="toggle-slider" />
                </label>
              </div>
            </div>
          </ListItem>
        </ListGroup>
      </div>

      <!-- Recurring Budgets List -->
      <div v-else class="recurring-list">
        <div v-if="filteredRecurringBudgets.length === 0" class="empty-state">
          <p>暫無固定預算</p>
        </div>
        <ListGroup v-else>
          <template #header-left>
            <span class="group-title">固定預算</span>
          </template>
          <template #header-right />
          <ListItem
            v-for="item in filteredRecurringBudgets"
            :key="item.id"
            :swipeable="!isViewingShared"
            @delete="onItemSwipeDelete('BUDGET', item.id)"
            @edit="onItemClick('BUDGET', item.id)"
          >
            <div
              class="recurring-item"
              :class="{ 'recurring-item--readonly': isViewingShared }"
            >
              <div class="item-icon">
                <CategoryIcon :category-name="getBudgetCategoryName(item.category_ids)" color-mode="type" :entry-type="item.type" />
              </div>
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
                    :disabled="isViewingShared"
                    @change="
                      !isViewingShared &&
                      recurringStore.toggleRecurringBudgetActive(item.id)
                    "
                  />
                  <span class="toggle-slider" />
                </label>
              </div>
            </div>
          </ListItem>
        </ListGroup>
      </div>
    </div>

    <BottomTabBar />

    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除固定"
      message="確定要刪除這筆固定嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmItemDelete"
      @cancel="cancelItemDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavAvatar from "../components/NavAvatar.vue";
import TypeToggle from "../components/TypeToggle.vue";
import BottomTabBar from "../components/BottomTabBar.vue";
import CategoryIcon from "../components/CategoryIcon.vue";
import { formatRecurrence } from "../utils/recurrence";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import { useTransactionStore } from "../stores/transactionStore";
import { useRecurringStore } from "../stores/recurringStore";
import { useUserStore } from "../stores/userStore";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import type { EntryType, RecurringTransaction } from "../types";
import { iconDollarCircle, iconPiggyBank } from "../utils/icons";
import { useSharedSwipeContext } from "../components/ListGroup.vue";

const router = useRouter();
const route = useRoute();
const transactionStore = useTransactionStore();
const recurringStore = useRecurringStore();
const userStore = useUserStore();

useSharedSwipeContext();

const isViewingShared = computed(() => userStore.isViewingShared);

// ── State ──────────────────────────────────────────────────
const viewMode = ref<"TRANSACTION" | "BUDGET">("TRANSACTION");
const filterType = ref<EntryType>("EXPENSE");
const showDeleteConfirm = ref(false);
const deletingItemId = ref<string | null>(null);
const deletingItemType = ref<"TRANSACTION" | "BUDGET">("TRANSACTION");

// ── Computed ───────────────────────────────────────────────
const filteredRecurringTransactions = computed(() =>
  recurringStore.visibleRecurringTransactions
    .filter((t) => t.type === filterType.value)
    .sort((a, b) => a.recurrence_day - b.recurrence_day || b.amount - a.amount),
);

const filteredRecurringBudgets = computed(() =>
  recurringStore.visibleRecurringBudgets
    .filter((b) => b.type === filterType.value)
    .sort((a, b) => a.recurrence_day - b.recurrence_day || b.goal - a.goal),
);

// ── Helpers ────────────────────────────────────────────────
function getCategoryNameById(id: string): string {
  return (
    transactionStore.visibleCategories.find((c) => c.id === id)?.name ?? "其他"
  );
}

function getBudgetCategoryName(categoryIds: string): string {
  const ids = categoryIds.split(",").filter(Boolean);
  if (ids.length === 1) return getCategoryNameById(ids[0]!);
  return "其他";
}

function onItemClick(type: "TRANSACTION" | "BUDGET", id: string): void {
  if (type === "TRANSACTION") {
    router.push(`/transactions/recurring/${id}/edit`);
  } else {
    router.push(`/transactions/budget/recurring/${id}/edit`);
  }
}

function goToSearchByRecurring(item: RecurringTransaction): void {
  const query: Record<string, string> = { cat: item.category_id };
  if (item.note) query.q = item.note;
  router.push({ path: "/transactions/search", query });
}

function onItemSwipeDelete(type: "TRANSACTION" | "BUDGET", id: string): void {
  deletingItemType.value = type;
  deletingItemId.value = id;
  showDeleteConfirm.value = true;
}

async function confirmItemDelete(): Promise<void> {
  showDeleteConfirm.value = false;
  const id = deletingItemId.value;
  const type = deletingItemType.value;
  deletingItemId.value = null;
  if (!id || isViewingShared.value) return;
  if (type === "TRANSACTION") {
    await recurringStore.deleteRecurringTransaction(id);
  } else {
    await recurringStore.deleteRecurringBudget(id);
  }
}

function cancelItemDelete(): void {
  showDeleteConfirm.value = false;
  deletingItemId.value = null;
}

// ── Lifecycle ──────────────────────────────────────────────

const isInitialized = ref(false);

watch(
  [filterType, viewMode],
  () => {
    if (!isInitialized.value) return;
    router.replace({
      query: { type: filterType.value, view: viewMode.value },
    });
  },
);

onMounted(async () => {
  const q = route.query;
  if (q.type === "EXPENSE" || q.type === "INCOME") filterType.value = q.type as EntryType;
  if (q.view === "TRANSACTION" || q.view === "BUDGET") viewMode.value = q.view as "TRANSACTION" | "BUDGET";
  await nextTick();
  isInitialized.value = true;
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

/* List */
.recurring-list {
  flex: 1;
  padding: 8px 16px;
}

.group-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.recurring-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.recurring-item--readonly {
  cursor: default;
}

.item-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.item-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-name {
  font-size: 16px;
  font-weight: 500;
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
  font-size: 16px;
  font-weight: 700;
}

.item-amount.expense {
  color: var(--text-primary);
}

.item-amount.income {
  color: var(--text-primary);
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

.toggle-switch input:disabled + .toggle-slider {
  opacity: 0.5;
  cursor: not-allowed;
}

.toggle-switch:has(input:disabled) {
  cursor: not-allowed;
}

/* Empty state */
.empty-state {
  text-align: center;
  padding: 48px 16px;
  color: var(--text-secondary);
}
</style>
