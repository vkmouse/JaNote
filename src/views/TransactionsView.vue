<template>
  <section class="transactions-page">
    <!-- Top Navigation Bar -->
    <TopNavigation>
      <button class="month-selector" @click="showMonthPicker = true">
        <span class="month-display">{{ currentMonthDisplay }}</span>
        <span class="icon-arrow" v-html="iconArrowDown"></span>
      </button>
    </TopNavigation>

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />

    <div class="page-content page">
    <StatsChart
      :monthlyExpense="monthlyExpense"
      :monthlyIncome="monthlyIncome"
      :balance="balance"
      :expensePercentage="expensePercentage"
      :incomePercentage="incomePercentage"
    />

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
import MonthPicker from '../components/MonthPicker.vue'
import StatsChart from '../components/StatsChart.vue'
import type { Transaction, Category } from '../types'
import { transactionRepository } from '../repositories/transactionRepository'
import { categoryRepository } from '../repositories/categoryRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import iconArrowDown from '../assets/icons/icon-arrow-down.svg?raw'

const router = useRouter()
const transactions = ref<Transaction[]>([])
const categories = ref<Category[]>([])
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

.icon-arrow {
  display: flex;
  align-items: center;
  justify-content: center;
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
