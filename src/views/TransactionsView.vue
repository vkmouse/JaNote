<template>
  <section class="transactions-page">
    <!-- Top Navigation Bar -->
    <TopNavigation>
      <button class="month-selector" @click="showMonthPicker = true">
        <span class="month-display">{{ currentMonthDisplay }}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
    </TopNavigation>

    <!-- Month Picker Modal -->
    <div v-if="showMonthPicker" class="month-picker-overlay" @click="showMonthPicker = false">
      <div class="month-picker" @click.stop>
        <h3>選擇年月</h3>
        <div class="picker-controls">
          <button @click="selectedYear--">◀</button>
          <span class="picker-year">{{ selectedYear }}</span>
          <button @click="selectedYear++">▶</button>
        </div>
        <div class="month-grid">
          <button 
            v-for="month in 12" 
            :key="month"
            :class="['month-btn', { active: month === selectedMonth }]"
            @click="selectedMonth = month"
          >
            {{ month }}月
          </button>
        </div>
        <button class="confirm-btn" @click="confirmDateSelection">確認</button>
      </div>
    </div>

    <div class="page-content page">
    <!-- Summary Statistics -->
    <div class="summary-section">
      <div class="summary-item">
        <div class="summary-label">月支出</div>
        <div class="summary-amount expense">${{ monthlyExpense.toLocaleString() }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">月收入</div>
        <div class="summary-amount income">${{ monthlyIncome.toLocaleString() }}</div>
      </div>
    </div>

    <!-- Donut Chart -->
    <div class="chart-section">
      <svg class="donut-chart" viewBox="0 0 200 200">
        <!-- Background circle -->
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="#f0f0f0"
          stroke-width="40"
        />
        <!-- Income arc (blue) -->
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="#47B8E0"
          stroke-width="40"
          :stroke-dasharray="`${Math.max(0, incomePercentage * 4.398 - 4)} 439.8`"
          stroke-dashoffset="-2"
          transform="rotate(-90 100 100)"
          class="chart-arc income-arc"
        />
        <!-- Expense arc (yellow) -->
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="#FFC952"
          stroke-width="40"
          :stroke-dasharray="`${Math.max(0, expensePercentage * 4.398 - 2)} 439.8`"
          :stroke-dashoffset="-(incomePercentage * 4.398 + 1)"
          transform="rotate(-90 100 100)"
          class="chart-arc expense-arc"
        />
        <!-- Outer border -->
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="var(--border-primary)"
          stroke-width="1"
        />
        <!-- Inner border -->
        <circle
          cx="100"
          cy="100"
          r="50"
          fill="none"
          stroke="var(--border-primary)"
          stroke-width="1"
        />
      </svg>
      <div class="chart-center">
        <div class="chart-label">月結餘</div>
        <div class="chart-balance" :class="{ positive: balance >= 0, negative: balance < 0 }">
          ${{ balance.toLocaleString() }}
        </div>
      </div>
    </div>

    <!-- Daily Transaction List -->
    <div class="transaction-list">
      <div v-if="groupedTransactions.length === 0" class="empty-state">
        <p>暫無交易記錄</p>
      </div>
      
      <div v-else class="daily-groups">
        <div v-for="group in groupedTransactions" :key="group.date" class="daily-group">
          <!-- Date Header -->
          <div class="date-header">
            <span class="date-title">{{ group.dateDisplay }}</span>
            <span class="daily-total" :class="group.total >= 0 ? 'income' : 'expense'">
              ${{ (group.total >= 0 ? group.total : Math.abs(group.total)).toLocaleString() }}
            </span>
          </div>

          <!-- Transaction Items -->
          <div class="transaction-items">
            <div 
              v-for="(transaction, index) in group.transactions" 
              :key="transaction.id" 
              class="transaction-item-wrapper"
              @touchstart="handleTouchStart($event, transaction.id)"
              @touchmove="handleTouchMove($event, transaction.id)"
              @touchend="handleTouchEnd(transaction.id)"
              @mousedown="handleMouseDown($event, transaction.id)"
              @mousemove="handleMouseMove($event, transaction.id)"
              @mouseup="handleMouseUp(transaction.id)"
              @mouseleave="handleMouseLeave(transaction.id)"
            >
              <div 
                class="transaction-item"
                :style="{ transform: `translateX(${swipeState[transaction.id]?.offset || 0}px)` }"
                @click="!swipeState[transaction.id]?.hasSwipped && editTransaction(transaction.id)"
              >
                <div class="item-left">
                  <div class="category-icon" :style="{ background: getCategoryColor(transaction.category_id) }">
                    {{ getCategoryEmoji(transaction.category_id) }}
                  </div>
                  <span class="category-name">{{ getCategoryName(transaction.category_id) }}</span>
                </div>
                <div :class="['item-amount', transaction.type.toLowerCase()]">
                  ${{ transaction.type === 'EXPENSE' ? '-' : '' }}{{ transaction.amount.toLocaleString() }}
                </div>
                <div v-if="index < group.transactions.length - 1" class="item-divider"></div>
              </div>
              <button 
                class="delete-btn" 
                @click.stop="deleteTransaction(transaction.id)"
                :style="{ 
                  opacity: swipeState[transaction.id]?.showDelete ? 1 : 0,
                  pointerEvents: swipeState[transaction.id]?.showDelete ? 'auto' : 'none'
                }"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Add Button -->
    <button class="fab" @click="goToNewTransaction">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import TopNavigation from '../components/TopNavigation.vue'
import type { Transaction, Category } from '../types'
import { transactionRepository } from '../repositories/transactionRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'

const router = useRouter()
const transactions = ref<Transaction[]>([])
const categories = ref<Category[]>([])
const currentDate = ref(new Date())
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const showMonthPicker = ref(false)
const syncApiBase = '/api'

// Swipe-to-delete state
const swipeState = ref<Record<string, { offset: number; startX: number; showDelete: boolean; isDragging: boolean; hasSwipped: boolean }>>({})

interface DailyGroup {
  date: string
  dateDisplay: string
  total: number
  transactions: Transaction[]
}

const currentMonthDisplay = computed(() => {
  return `${selectedYear.value} 年 ${selectedMonth.value} 月`
})

const filteredTransactions = computed(() => {
  return transactions.value.filter(t => {
    if (t.is_deleted) return false
    const date = new Date(t.date)
    return date.getFullYear() === selectedYear.value && date.getMonth() + 1 === selectedMonth.value
  })
})

const monthlyExpense = computed(() => {
  return filteredTransactions.value
    .filter(t => t.type === 'EXPENSE')
    .reduce((sum, t) => sum + t.amount, 0)
})

const monthlyIncome = computed(() => {
  return filteredTransactions.value
    .filter(t => t.type === 'INCOME')
    .reduce((sum, t) => sum + t.amount, 0)
})

const balance = computed(() => {
  return monthlyIncome.value - monthlyExpense.value
})

const expensePercentage = computed(() => {
  const total = monthlyExpense.value + monthlyIncome.value
  if (total === 0) return 0
  return (monthlyExpense.value / total) * 100
})

const incomePercentage = computed(() => {
  const total = monthlyExpense.value + monthlyIncome.value
  if (total === 0) return 0
  return (monthlyIncome.value / total) * 100
})

const groupedTransactions = computed<DailyGroup[]>(() => {
  const groups = new Map<string, DailyGroup>()
  
  const sortedTransactions = [...filteredTransactions.value]
    .sort((a, b) => b.date - a.date)

  sortedTransactions.forEach(transaction => {
    const date = new Date(transaction.date)
    const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    
    if (!groups.has(dateKey)) {
      const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      const weekDay = weekDays[date.getDay()]
      
      groups.set(dateKey, {
        date: dateKey,
        dateDisplay: `${year}/${month}/${day} ${weekDay}`,
        total: 0,
        transactions: []
      })
    }
    
    const group = groups.get(dateKey)!
    group.transactions.push(transaction)
    
    if (transaction.type === 'EXPENSE') {
      group.total -= transaction.amount
    } else {
      group.total += transaction.amount
    }
  })

  return Array.from(groups.values())
})

const loadTransactions = async () => {
  const allTransactions = await transactionRepository.getAll()
  transactions.value = allTransactions
}

const loadCategories = async () => {
  categories.value = await categoryRepository.getAll()
}

const getCategoryName = (categoryId: string): string => {
  const category = categories.value.find(c => c.id === categoryId)
  return category?.name || '未知分類'
}

const getCategoryEmoji = (categoryId: string): string => {
  const category = categories.value.find(c => c.id === categoryId)
  if (!category) return '📦'
  
  // Simple emoji mapping based on category name
  const emojiMap: Record<string, string> = {
    '日用品': '🛒',
    '早餐': '🥤',
    '午餐': '🍱',
    '晚餐': '🍽️',
    '餐飲': '🍜',
    '交通': '🚗',
    '娛樂': '🎮',
    '購物': '🛍️',
    '醫療': '💊',
    '教育': '📚',
    '薪水': '💰',
    '獎金': '🎁',
    '股息': '💹',
    '投資': '📈',
    '社交': '👥',
    '禮物': '🎁',
    '數位': '💻',
    '其他': '📦',
    '貓咪': '🐱',
    '旅行': '✈️',
  }
  
  return emojiMap[category.name] || '📝'
}

const getCategoryColor = (categoryId: string): string => {
  const colors = [
    '#FFB84D', '#FF6B9D', '#A8E6CF', '#FFD93D', 
    '#95E1D3', '#F38BA0', '#4ECDC4', '#FFE66D'
  ]
  
  // Use category id to consistently assign color
  const index = categoryId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return colors[index % colors.length] ?? colors[0]!
}

const goToNewTransaction = () => {
  router.push('/transactions/new')
}

const editTransaction = (id: string) => {
  router.push(`/transaction/${id}/edit`)
}

const confirmDateSelection = () => {
  showMonthPicker.value = false
}

// Swipe-to-delete handlers (Touch)
const handleTouchStart = (event: TouchEvent, id: string) => {
  const touch = event.touches[0]
  if (!touch) return
  
  // Close other open swipes
  Object.keys(swipeState.value).forEach(key => {
    if (key !== id && swipeState.value[key]) {
      swipeState.value[key].offset = 0
      swipeState.value[key].showDelete = false
      swipeState.value[key].hasSwipped = false
    }
  })
  
  swipeState.value[id] = {
    offset: swipeState.value[id]?.offset || 0,
    startX: touch.clientX,
    showDelete: swipeState.value[id]?.showDelete || false,
    isDragging: true,
    hasSwipped: false
  }
}

const handleTouchMove = (event: TouchEvent, id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return
  
  const touch = event.touches[0]
  if (!touch) return
  const currentX = touch.clientX
  const startX = swipeState.value[id].startX
  const diff = currentX - startX
  
  // Mark as swiped if movement exceeds 5px
  if (Math.abs(diff) > 5) {
    swipeState.value[id].hasSwipped = true
  }
  
  // Get current offset
  const currentOffset = swipeState.value[id].offset
  
  // Calculate new offset based on current state
  // If we already have a negative offset (open), allow positive movements (closing)
  // If we have no offset (closed), allow negative movements (opening)
  let newOffset = currentOffset + diff
  
  // Limit to -80px to 0px range
  newOffset = Math.min(0, Math.max(newOffset, -80))
  
  swipeState.value[id].offset = newOffset
  swipeState.value[id].showDelete = newOffset < -40
  swipeState.value[id].startX = currentX // Update start position for continuous tracking
}

const handleTouchEnd = (id: string) => {
  if (!swipeState.value[id]) return
  
  swipeState.value[id].isDragging = false
  
  // Snap to position
  if (swipeState.value[id].offset < -40) {
    swipeState.value[id].offset = -80
    swipeState.value[id].showDelete = true
  } else {
    swipeState.value[id].offset = 0
    swipeState.value[id].showDelete = false
  }
}

// Mouse handlers for desktop
const handleMouseDown = (event: MouseEvent, id: string) => {
  // Close other open swipes
  Object.keys(swipeState.value).forEach(key => {
    if (key !== id && swipeState.value[key]) {
      swipeState.value[key].offset = 0
      swipeState.value[key].showDelete = false
      swipeState.value[key].hasSwipped = false
    }
  })
  
  swipeState.value[id] = {
    offset: swipeState.value[id]?.offset || 0,
    startX: event.clientX,
    showDelete: swipeState.value[id]?.showDelete || false,
    isDragging: true,
    hasSwipped: false
  }
}

const handleMouseMove = (event: MouseEvent, id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return
  
  const currentX = event.clientX
  const startX = swipeState.value[id].startX
  const diff = currentX - startX
  
  // Mark as swiped if movement exceeds 5px
  if (Math.abs(diff) > 5) {
    swipeState.value[id].hasSwipped = true
  }
  
  // Get current offset
  const currentOffset = swipeState.value[id].offset
  
  // Calculate new offset based on current state
  // If we already have a negative offset (open), allow positive movements (closing)
  // If we have no offset (closed), allow negative movements (opening)
  let newOffset = currentOffset + diff
  
  // Limit to -80px to 0px range
  newOffset = Math.min(0, Math.max(newOffset, -80))
  
  swipeState.value[id].offset = newOffset
  swipeState.value[id].showDelete = newOffset < -40
  swipeState.value[id].startX = currentX // Update start position for continuous tracking
}

const handleMouseUp = (id: string) => {
  if (!swipeState.value[id]) return
  
  swipeState.value[id].isDragging = false
  
  // Snap to position
  if (swipeState.value[id].offset < -40) {
    swipeState.value[id].offset = -80
    swipeState.value[id].showDelete = true
  } else {
    swipeState.value[id].offset = 0
    swipeState.value[id].showDelete = false
  }
}

const handleMouseLeave = (id: string) => {
  if (!swipeState.value[id] || !swipeState.value[id].isDragging) return
  handleMouseUp(id)
}

const deleteTransaction = async (id: string) => {
  if (confirm('確定要刪除這筆交易嗎？')) {
    // Mark as deleted (soft delete)
    const transaction = transactions.value.find(t => t.id === id)
    if (transaction) {
      await transactionRepository.update(id, (current) => {
        if (!current) return null
        return { ...current, is_deleted: 1, version: current.version + 1 }
      })

      await syncQueueRepository.add({
        mutation_id: crypto.randomUUID(),
        entity_type: 'TXN',
        entity_id: id,
        payload: null,
        base_version: transaction.version || 0,
        created_at: Date.now(),
      })
      
      // Reload transactions
      await loadTransactions()
      
      // Reset swipe state
      delete swipeState.value[id]
    }
  } else {
    // Reset swipe state if cancelled
    if (swipeState.value[id]) {
      swipeState.value[id].offset = 0
      swipeState.value[id].showDelete = false
      swipeState.value[id].hasSwipped = false
    }
  }
}

onMounted(() => {
  loadTransactions()
  loadCategories()
})
</script>

<style scoped>
.transactions-page {
  display: flex;
  flex-direction: column;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 80px;
}

/* Month Selector Button in Top Nav */
.month-selector {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  padding: 8px 16px;
}

.month-display {
  color: var(--text-primary);
}

.month-selector:hover {
  opacity: 0.7;
}

/* Month Picker Modal */
.month-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.month-picker {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.month-picker h3 {
  margin: 0 0 24px;
  text-align: center;
  font-size: 18px;
  color: var(--text-primary);
}

.picker-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  margin-bottom: 24px;
}

.picker-controls button {
  background: #f0f0f0;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.picker-controls button:hover {
  background: #e0e0e0;
}

.picker-year {
  font-size: 20px;
  font-weight: 600;
  min-width: 80px;
  text-align: center;
}

.month-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
}

.month-btn {
  padding: 12px 8px;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: var(--bg-page);
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.month-btn:hover {
  border-color: var(--janote-income);
  background: var(--janote-income-light);
}

.month-btn.active {
  background: var(--janote-income);
  border-color: var(--janote-income);
  color: var(--text-primary);
  font-weight: 600;
}

.confirm-btn {
  width: 100%;
  padding: 12px;
  background: var(--text-primary);
  color: var(--text-light);
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.confirm-btn:hover {
  background: #333;
}

/* Summary Section */
.summary-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  padding: 24px 20px 0;
  gap: 20px;
  background: var(--bg-page);
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-item:first-child {
  align-items: flex-start;
}

.summary-item:last-child {
  align-items: flex-end;
}

.summary-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  border-bottom: 3px solid;
  padding-bottom: 4px;
}

.summary-item:nth-child(1) .summary-label {
  border-color: var(--janote-expense);
}

.summary-item:nth-child(2) .summary-label {
  border-color: var(--janote-income);
}

.summary-amount {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Chart Section */
.chart-section {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 20px 40px;
  background: var(--bg-page);
}

.donut-chart {
  width: 280px;
  height: 280px;
  filter: drop-shadow(0 2px 8px rgba(0, 0, 0, 0.1));
}

.chart-arc {
  transition: stroke-dasharray 0.5s ease, stroke-dashoffset 0.5s ease;
}

.chart-center {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  pointer-events: none;
}

.chart-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
}

.chart-balance {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
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

.daily-group {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  overflow: hidden;
}

/* Date Header */
.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: var(--bg-page);
  border-bottom: 2px solid var(--border-primary);
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

/* Transaction Items */
.transaction-items {
  background: var(--bg-page);
}

.transaction-item-wrapper {
  position: relative;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
}

.transaction-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.3s ease-out;
  position: relative;
  background: var(--bg-page);
  z-index: 1;
}

.transaction-item:hover {
  background: #f9f9f9;
}

.delete-btn {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--janote-action);
  border: none;
  color: var(--text-light);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.3s;
  pointer-events: none;
  z-index: 0;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.category-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}

.category-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-amount {
  color: var(--text-primary);
}

.item-divider {
  position: absolute;
  bottom: 0;
  left: 72px;
  right: 16px;
  height: 1px;
  background: #f0f0f0;
}

/* Floating Action Button */
.fab {
  position: fixed;
  bottom: 82px; /* 72px bottom nav + 10px spacing */
  left: 50%;
  transform: translateX(-50%);
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--janote-action);
  border: 2px solid var(--border-primary);
  box-shadow: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 50;
}

.fab:hover {
  transform: translateX(-50%) translateY(-2px);
  box-shadow: none;
}

.fab:active {
  transform: translateX(-50%) translateY(0);
}

/* Responsive */
@media (max-width: 480px) {
  .summary-amount {
    font-size: 20px;
  }
  
  .daily-group {
    border-radius: 12px;
  }
  
  .category-icon {
    width: 40px;
    height: 40px;
    font-size: 20px;
  }
  
  .fab {
    bottom: 82px; /* 72px bottom nav + 10px spacing */
    width: 52px;
    height: 52px;
  }
}
</style>
