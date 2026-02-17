<template>
  <section class="transactions-page">
    <!-- Top Navigation Bar -->
    <header class="top-nav">
      <button class="month-selector" @click="showMonthPicker = true">
        <span class="month-display">{{ currentMonthDisplay }}</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>

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
    </header>

    <!-- Summary Statistics -->
    <div class="summary-section">
      <div class="summary-item">
        <div class="summary-label">月支出</div>
        <div class="summary-amount expense">${{ monthlyExpense }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">月收入</div>
        <div class="summary-amount income">${{ monthlyIncome }}</div>
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
              ${{ group.total >= 0 ? group.total : Math.abs(group.total) }}
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
            >
              <div 
                class="transaction-item"
                :style="{ transform: `translateX(${swipeState[transaction.id]?.offset || 0}px)` }"
                @click="editTransaction(transaction.id)"
              >
                <div class="item-left">
                  <div class="category-icon" :style="{ background: getCategoryColor(transaction.category_id) }">
                    {{ getCategoryEmoji(transaction.category_id) }}
                  </div>
                  <span class="category-name">{{ getCategoryName(transaction.category_id) }}</span>
                </div>
                <div :class="['item-amount', transaction.type.toLowerCase()]">
                  ${{ transaction.type === 'EXPENSE' ? '-' : '' }}{{ transaction.amount }}
                </div>
                <div v-if="index < group.transactions.length - 1" class="item-divider"></div>
              </div>
              <button 
                class="delete-btn" 
                @click="deleteTransaction(transaction.id)"
                :style="{ opacity: swipeState[transaction.id]?.showDelete ? 1 : 0 }"
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
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Transaction, Category } from '../types'
import { transactionRepository } from '../repositories/transactionRepository'
import { categoryRepository } from '../repositories/categoryRepository'

const router = useRouter()
const transactions = ref<Transaction[]>([])
const categories = ref<Category[]>([])
const currentDate = ref(new Date())
const selectedYear = ref(new Date().getFullYear())
const selectedMonth = ref(new Date().getMonth() + 1)
const showMonthPicker = ref(false)

// Swipe-to-delete state
const swipeState = ref<Record<string, { offset: number; startX: number; showDelete: boolean }>>({})

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
  return colors[index % colors.length]
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

// Swipe-to-delete handlers
const handleTouchStart = (event: TouchEvent, id: string) => {
  const touch = event.touches[0]
  swipeState.value[id] = {
    offset: 0,
    startX: touch.clientX,
    showDelete: false
  }
}

const handleTouchMove = (event: TouchEvent, id: string) => {
  if (!swipeState.value[id]) return
  
  const touch = event.touches[0]
  const diff = touch.clientX - swipeState.value[id].startX
  
  // Only allow left swipe (negative offset)
  if (diff < 0) {
    const offset = Math.max(diff, -80) // Limit to -80px
    swipeState.value[id].offset = offset
    swipeState.value[id].showDelete = offset < -40
  }
}

const handleTouchEnd = (id: string) => {
  if (!swipeState.value[id]) return
  
  // Snap to position
  if (swipeState.value[id].offset < -40) {
    swipeState.value[id].offset = -80
    swipeState.value[id].showDelete = true
  } else {
    swipeState.value[id].offset = 0
    swipeState.value[id].showDelete = false
  }
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
  min-height: 100vh;
  background: #fff;
  padding-bottom: 80px;
}

/* Top Navigation Bar */
.top-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

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
  color: #000;
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
  background: #fff;
  border-radius: 16px;
  padding: 24px;
  min-width: 320px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.month-picker h3 {
  margin: 0 0 24px;
  text-align: center;
  font-size: 18px;
  color: #000;
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
  background: #fff;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.2s;
}

.month-btn:hover {
  border-color: #ffc107;
  background: #fffaf0;
}

.month-btn.active {
  background: #ffc107;
  border-color: #ffc107;
  color: #000;
  font-weight: 600;
}

.confirm-btn {
  width: 100%;
  padding: 12px;
  background: #000;
  color: #fff;
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
  padding: 24px 20px;
  gap: 20px;
  background: #fff;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.summary-label {
  font-size: 14px;
  color: #666;
  font-weight: 500;
}

.summary-amount {
  font-size: 32px;
  font-weight: 700;
}

.summary-amount.expense {
  color: #000;
}

.summary-amount.income {
  color: #000;
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
  color: #999;
  font-size: 14px;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.daily-group {
  background: #fff;
  border: 2px solid #000;
  border-radius: 16px;
  overflow: hidden;
}

/* Date Header */
.date-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background: #fff;
  border-bottom: 2px solid #000;
}

.date-title {
  font-size: 14px;
  font-weight: 600;
  color: #000;
}

.daily-total {
  font-size: 16px;
  font-weight: 700;
}

.daily-total.expense {
  color: #FFA726;
}

.daily-total.income {
  color: #66BB6A;
}

/* Transaction Items */
.transaction-items {
  background: #fff;
}

.transaction-item-wrapper {
  position: relative;
  overflow: hidden;
}

.transaction-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  cursor: pointer;
  transition: transform 0.3s ease-out;
  position: relative;
  background: #fff;
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
  background: var(--janote-primary);
  border: none;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.3s;
  pointer-events: all;
}

.delete-btn:active {
  background: var(--janote-primary-hover);
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
  color: #000;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-amount.expense {
  color: #000;
}

.item-amount.income {
  color: #66BB6A;
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
  bottom: 24px;
  right: 24px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--janote-primary);
  border: none;
  box-shadow: 0 4px 12px rgba(255, 82, 82, 0.4);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s, box-shadow 0.2s;
  z-index: 50;
}

.fab:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(255, 82, 82, 0.5);
}

.fab:active {
  transform: translateY(0);
}

/* Responsive */
@media (max-width: 480px) {
  .summary-amount {
    font-size: 28px;
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
    bottom: 20px;
    right: 20px;
    width: 52px;
    height: 52px;
  }
}
</style>
