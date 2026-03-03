<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import TopNavigation from '../components/TopNavigation.vue'
import MonthPicker from '../components/MonthPicker.vue'
import DonutChart from '../components/DonutChart.vue'
import type { DonutSlice } from '../components/DonutChart.vue'
import type { Transaction, Category, EntryType } from '../types'
import { transactionRepository } from '../repositories/transactionRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { userRepository } from '../repositories/userRepository'
import { getCategoryIcon } from '../utils/categoryIcons'

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
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const showMonthPicker = ref(false)
const currentUserId = ref<string>('')
const selectedUser = ref<SelectedUser | null>(null)
const transactionType = ref<EntryType>('EXPENSE')

// 預定義的分類顏色
const categoryColors =[
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B88B', '#AED6F1',
  '#F1948A', '#82E0AA', '#FAD7A0', '#D7BDE2', '#A3E4D7'
]

const currentMonthDisplay = computed(() => {
  return `${selectedYear.value}/${selectedMonth.value}`
})

const activeUserId = computed(() => {
  return selectedUser.value?.id || currentUserId.value
})

const isViewingShared = computed(() => {
  return selectedUser.value !== null
})

// 根據選擇的月份與使用者篩選交易紀錄
const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    // 排除已刪除的紀錄
    if (t.is_deleted) return false
    
    // 確認使用者 ID 是否符合
    if (activeUserId.value && t.user_id !== activeUserId.value) return false
    
    // 解決 iOS/Safari 的日期解析問題 (將 '-' 替換為 '/')
    const dateString = typeof t.date === 'string' ? t.date.replace(/-/g, '/') : t.date
    const date = new Date(dateString)
    
    // 防呆：如果日期格式錯誤導致無法解析，則略過
    if (isNaN(date.getTime())) return false

    // 使用 Number() 強制轉型，避免 MonthPicker 元件傳回字串導致嚴格比較(===)失敗
    return date.getFullYear() === Number(selectedYear.value) && 
           (date.getMonth() + 1) === Number(selectedMonth.value)
  })
})

// 根據交易類型（支出或收入）篩選
const typeFilteredTransactions = computed(() => {
  // 這裡需要確保 t.type 的大小寫與 transactionType.value ('EXPENSE' / 'INCOME') 完全一致
  // 如果資料庫是小寫，可以改成 t.type.toUpperCase() === transactionType.value
  return filteredTransactions.value.filter(t => t.type === transactionType.value)
})

// 將交易按分類分組並計算總額
const categorySummaries = computed<CategorySummary[]>(() => {
  const categoryMap = new Map<string, CategorySummary>()
  
  typeFilteredTransactions.value.forEach((transaction) => {
    const category = categories.value.find(c => c.id === transaction.category_id)
    const categoryName = category?.name || '未知分類'
    
    if (!categoryMap.has(transaction.category_id)) {
      categoryMap.set(transaction.category_id, {
        category_id: transaction.category_id,
        category_name: categoryName,
        total_amount: 0,
        color: categoryColors[categoryMap.size % categoryColors.length]
      })
    }
    
    const summary = categoryMap.get(transaction.category_id)!
    summary.total_amount += transaction.amount
  })
  
  // 依總金額由高到低排序
  return Array.from(categoryMap.values()).sort((a, b) => b.total_amount - a.total_amount)
})

// 計算當前類型的總金額
const totalAmount = computed(() => {
  return categorySummaries.value.reduce((sum, cat) => sum + cat.total_amount, 0)
})

// 準備提供給甜甜圈圖表的資料格式
const donutSlices = computed<DonutSlice[]>(() => {
  return categorySummaries.value.map(summary => ({
    sliceLabel: summary.category_name,
    sliceValue: summary.total_amount,
    sliceColor: summary.color
  }))
})

// 甜甜圈圖表中央的文字標籤
const centerLabel = computed(() => {
  return transactionType.value === 'EXPENSE' ? '總支出' : '總收入'
})

// 甜甜圈圖表中央的總金額
const centerBalance = computed(() => {
  return `$${totalAmount.value.toLocaleString()}`
})

const getCategoryIconSvg = (categoryId: string): string => {
  const category = categories.value.find(c => c.id === categoryId)
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

// 監聽使用者變更，重新載入交易紀錄
watch(selectedUser, async () => {
  await loadTransactions()
})
</script>

<template>
  <section class="dashboard-page">
    <!-- 頂部導覽列 -->
    <TopNavigation mode="menu-title-avatar" title="帳務總覽" @user-changed="onUserChanged" />

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />

    <div class="page-content page">
      <!-- 月份顯示與類型切換 -->
      <div class="header-section">
        <div class="month-display" @click="showMonthPicker = true">
          {{ currentMonthDisplay }}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>
        
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

      <!-- 甜甜圈圖表 -->
      <DonutChart
        :centerLabel="centerLabel"
        :centerBalance="centerBalance"
        :slices="donutSlices"
      />

      <!-- 分類摘要列表 -->
      <div class="category-list">
        <div v-if="categorySummaries.length === 0" class="empty-state">
          <p>暫無資料</p>
        </div>
        
        <div v-else class="category-group">
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
                <span class="category-name">{{ summary.category_name }}</span>
              </div>
              <div class="item-amount">
                ${{ summary.total_amount.toLocaleString() }}
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

/* 頂部區塊 */
.header-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
}

.month-display {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 8px;
  user-select: none;
}

.month-display:hover {
  opacity: 0.7;
}

/* 類型切換按鈕 */
.type-toggle {
  display: flex;
  gap: 8px;
  border: 2px solid var(--border-primary);
  border-radius: 24px;
  padding: 4px;
  background: var(--bg-page);
}

.toggle-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 20px;
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.toggle-btn:hover {
  background: #f0f0f0;
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

/* 分類列表 */
.category-list {
  padding: 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
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

.category-items {
  background: var(--bg-page);
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  position: relative;
  background: var(--bg-page);
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.color-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.category-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
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
  color: var(--text-primary);
  flex-shrink: 0;
  margin-left: 16px;
}

.item-divider {
  position: absolute;
  bottom: 0;
  left: 84px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}

/* 響應式設定 */
@media (max-width: 768px) {
  .header-section {
    padding: 12px 16px;
  }
  
  .month-display {
    font-size: 16px;
  }
  
  .toggle-btn {
    padding: 6px 16px;
    font-size: 13px;
  }
}

@media (max-width: 480px) {
  .category-group {
    border-radius: 12px;
  }
  
  .category-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
  
  .item-divider {
    left: 80px;
  }
}
</style>