<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import TopNavigation from '../components/TopNavigation.vue'
import MonthPicker from '../components/MonthPicker.vue'
import YearPicker from '../components/YearPicker.vue'
import DonutChart from '../components/DonutChart.vue'
import type { DonutSlice } from '../components/DonutChart.vue'
import type { Transaction, Category, EntryType } from '../types'
import { transactionRepository } from '../repositories/transactionRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { userRepository } from '../repositories/userRepository'
import { getCategoryIcon } from '../utils/categoryIcons'

type ViewMode = 'monthly' | 'yearly'

interface SelectedUser {
  id: string
  email: string
}

interface CategorySummary {
  category_id: string
  category_name: string
  total_amount: number
  color: string
}

const router = useRouter()
const transactions = ref<Transaction[]>([])
const categories = ref<Category[]>([])
const viewMode = ref<ViewMode>('monthly')
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const showMonthPicker = ref(false)
const showYearPicker = ref(false)
const currentUserId = ref<string>('')
const selectedUser = ref<SelectedUser | null>(null)
const transactionType = ref<EntryType>('EXPENSE')

const categoryColors = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AED6F1',
  '#F1948A', '#82E0AA', '#FAD7A0', '#D7BDE2', '#A3E4D7'
]

const currentMonthDisplay = computed(() => {
  if (viewMode.value === 'monthly') {
    return `${selectedYear.value}/${selectedMonth.value}`
  } else {
    return `${selectedYear.value}`
  }
})

const openPicker = () => {
  if (viewMode.value === 'monthly') {
    showMonthPicker.value = true
  } else {
    showYearPicker.value = true
  }
}

const activeUserId = computed(() => {
  return selectedUser.value?.id || currentUserId.value
})

const isViewingShared = computed(() => {
  return selectedUser.value !== null
})

const filteredCategories = computed(() => {
  return categories.value.filter(c => {
    if (c.is_deleted) return false
    return c.user_id === activeUserId.value
  })
})

const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    if (t.is_deleted) return false
    if (activeUserId.value && t.user_id !== activeUserId.value) return false

    const dateValue: any = t.date
    const dateString = typeof dateValue === 'string' ? dateValue.replace(/-/g, '/') : dateValue
    const date = new Date(dateString)

    if (isNaN(date.getTime())) return false

    if (viewMode.value === 'monthly') {
      return date.getFullYear() === Number(selectedYear.value) &&
             (date.getMonth() + 1) === Number(selectedMonth.value)
    } else {
      return date.getFullYear() === Number(selectedYear.value)
    }
  })
})

const typeFilteredTransactions = computed(() => {
  return filteredTransactions.value.filter(t => t.type === transactionType.value)
})

const categorySummaries = computed<CategorySummary[]>(() => {
  const categoryMap = new Map<string, CategorySummary>()

  typeFilteredTransactions.value.forEach((transaction) => {
    const category = filteredCategories.value.find(c => c.id === transaction.category_id)
    const categoryName = category?.name || '未知分類'

    if (!categoryMap.has(transaction.category_id)) {
      categoryMap.set(transaction.category_id, {
        category_id: transaction.category_id,
        category_name: categoryName,
        total_amount: 0,
        color: categoryColors[categoryMap.size % categoryColors.length] || '#FF6B6B'
      })
    }

    const summary = categoryMap.get(transaction.category_id)!
    summary.total_amount += transaction.amount
  })

  return Array.from(categoryMap.values()).sort((a, b) => b.total_amount - a.total_amount)
})

const totalAmount = computed(() => {
  return categorySummaries.value.reduce((sum, cat) => sum + cat.total_amount, 0)
})

const donutSlices = computed<DonutSlice[]>(() => {
  return categorySummaries.value.map(summary => ({
    sliceLabel: summary.category_name,
    sliceValue: summary.total_amount,
    sliceColor: summary.color
  }))
})

const centerLabel = computed(() => {
  return transactionType.value === 'EXPENSE' ? '總支出' : '總收入'
})

const centerBalance = computed(() => {
  return `$${totalAmount.value.toLocaleString()}`
})

const getCategoryIconSvg = (categoryId: string): string => {
  const category = filteredCategories.value.find(c => c.id === categoryId)
  return getCategoryIcon(category?.name || '其他')
}

const onUserChanged = (user: SelectedUser | null) => {
  selectedUser.value = user
}

const loadTransactions = async () => {
  const allTransactions = await transactionRepository.getAll()
  transactions.value = allTransactions
}

const loadCategories = async () => {
  categories.value = await categoryRepository.getAll()
}

onMounted(async () => {
  const user = await userRepository.get()
  if (user) {
    currentUserId.value = user.id
  }
  await loadCategories()
  await loadTransactions()
})

watch(selectedUser, async () => {
  await loadCategories()
  await loadTransactions()
})
</script>

<template>
  <section class="dashboard-page">
    <TopNavigation mode="menu-title-avatar" title="帳務總覽" @user-changed="onUserChanged" />

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />

    <YearPicker
      v-model:open="showYearPicker"
      v-model:year="selectedYear"
    />

    <div class="page-content page">
      <!-- 月份/年份顯示與視圖模式切換 -->
      <div class="header-section">
        <!-- 左：月/年 toggle -->
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
          </div>
        </div>

        <!-- 中：月份 picker，自動置中 -->
        <div class="month-display" @click="openPicker">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ currentMonthDisplay }}</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        <!-- 右：支出/收入 toggle，靠右 -->
        <div class="right-controls">
          <div class="type-toggle">
            <button
              :class="['toggle-btn', { active: transactionType === 'EXPENSE', 'expense-active': transactionType === 'EXPENSE' }]"
              @click="transactionType = 'EXPENSE'"
            >
              支出
            </button>
            <button
              :class="['toggle-btn', { active: transactionType === 'INCOME', 'income-active': transactionType === 'INCOME' }]"
              @click="transactionType = 'INCOME'"
            >
              收入
            </button>
          </div>
        </div>
      </div>

      <!-- 甜甜圈圖表 -->
      <DonutChart
        :centerLabel="centerLabel"
        :centerBalance="centerBalance"
        :slices="donutSlices"
      />

      <!-- 分類摘要列表 -->
      <div class="category-list">
        <div v-if="categorySummaries.length === 0" class="empty-state">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
          <p>暫無資料</p>
        </div>

        <div v-else class="category-group">
          <!-- 列表標頭 -->
          <div class="list-header">
            <span class="list-header-label">分類</span>
            <span class="list-header-label">金額</span>
          </div>

          <div class="category-items">
            <div
              v-for="(summary, index) in categorySummaries"
              :key="summary.category_id"
              class="category-item"
            >
              <div class="item-left">
                <div
                  class="color-indicator"
                  :style="{ backgroundColor: summary.color }"
                ></div>
                <div class="category-icon" v-html="getCategoryIconSvg(summary.category_id)"></div>
                <div class="category-info">
                  <span class="category-name">{{ summary.category_name }}</span>
                  <!-- 百分比進度條 -->
                  <div class="progress-bar-track">
                    <div
                      class="progress-bar-fill"
                      :style="{
                        width: totalAmount > 0 ? (summary.total_amount / totalAmount * 100) + '%' : '0%',
                        backgroundColor: summary.color
                      }"
                    ></div>
                  </div>
                </div>
              </div>
              <div class="item-right">
                <span class="item-amount">${{ summary.total_amount.toLocaleString() }}</span>
                <span class="item-percentage" v-if="totalAmount > 0">
                  {{ (summary.total_amount / totalAmount * 100).toFixed(1) }}%
                </span>
              </div>
              <div v-if="index < categorySummaries.length - 1" class="item-divider"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.dashboard-page {
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 80px;
}

/* ── 共用 toggle 尺寸規格 ── */
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

/* 月/年：active = 黑底白字 */
.mode-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}

/* 支出/收入：active 保留各自用色 */
.toggle-btn.expense-active {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.toggle-btn.income-active {
  background: var(--janote-income);
  color: var(--text-light);
}

/* ── 月份 / 年份切換列 ── */
.header-section {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  padding: 12px 16px;
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

.month-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
  padding: 6px 10px;
  border-radius: 10px;
  transition: background 0.15s;
}

.month-display:hover {
  background: #f0f0f0;
}

/* ── 分類列表 ── */
.category-list {
  padding: 16px;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  min-height: 200px;
  color: var(--text-disabled);
  font-size: 14px;
}

.category-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}

/* 列表標頭 */
.list-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-bottom: 2px solid var(--border-primary);
  background: var(--bg-page);
}

.list-header-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-disabled);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* 分類項目 */
.category-items {
  background: var(--bg-page);
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  position: relative;
  background: var(--bg-page);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.color-indicator {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #f5f5f5;
  border-radius: 10px;
}

.category-icon :deep(svg) {
  width: 22px;
  height: 22px;
  stroke: var(--text-primary);
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

/* 分類名稱 + 進度條 */
.category-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
  flex: 1;
  min-width: 0;
}

.category-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.progress-bar-track {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.4s ease;
}

/* 右側金額 + 百分比 */
.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-amount {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
}

.item-percentage {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-disabled);
}

.item-divider {
  position: absolute;
  bottom: 0;
  left: 76px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}

/* ── 響應式 ── */
@media (max-width: 768px) {
  .header-section {
    padding: 10px 12px;
  }

  .month-display {
    font-size: 14px;
    padding: 5px 6px;
  }

  .mode-btn,
  .toggle-btn {
    padding: 3px 8px;
    font-size: 11px;
    min-width: 28px;
  }
}
</style>