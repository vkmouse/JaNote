<template>
  <div class="transaction-edit-page">
    <!-- Header -->
    <div class="edit-header">
      <button class="back-btn" @click="goBack">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="type-toggle">
        <button 
          :class="['toggle-btn', { active: transactionType === 'EXPENSE' }]"
          @click="transactionType = 'EXPENSE'"
        >
          支出
        </button>
        <button 
          :class="['toggle-btn', { active: transactionType === 'INCOME' }]"
          @click="transactionType = 'INCOME'"
        >
          收入
        </button>
      </div>
    </div>

    <!-- Main Content -->
    <div class="edit-content">
      <!-- Categories Grid -->
      <div class="categories-section">
        <div class="categories-grid">
          <button
            v-for="category in filteredCategories"
            :key="category.id"
            :class="['category-item', { selected: selectedCategoryId === category.id }]"
            @click="selectCategory(category)"
          >
            {{ category.name }}
          </button>
        </div>
      </div>

      <!-- Amount and Notes Input -->
      <div class="input-section">
        <div class="input-group">
          <label class="label">
            <span class="category-name">{{ selectedCategoryName }}</span>
            <span class="amount-display">{{ formattedAmount }}</span>
          </label>
          <input
            v-model="notes"
            type="text"
            placeholder="備註"
            class="notes-input"
          />
        </div>
      </div>

      <!-- Date Picker -->
      <div class="date-picker">
        <button class="date-nav-btn" @click="previousDate">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <div class="date-display" @click="showCalendar = true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
          <span>{{ formattedDate }}</span>
        </div>
        <button class="date-nav-btn" @click="nextDate">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
      </div>

      <!-- Calendar Modal -->
      <div v-if="showCalendar" class="calendar-overlay" @click="showCalendar = false">
        <div class="calendar-modal" @click.stop>
          <div class="calendar-header">
            <button class="calendar-nav-btn" @click="previousMonth">◀</button>
            <span class="calendar-title">{{ calendarYearMonth }}</span>
            <button class="calendar-nav-btn" @click="nextMonth">▶</button>
            <button class="today-btn" @click="selectToday">今日</button>
          </div>
          <div class="calendar-weekdays">
            <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
          </div>
          <div class="calendar-days">
            <div 
              v-for="day in calendarDays" 
              :key="`${day.year}-${day.month}-${day.day}`"
              :class="['calendar-day', { 
                'other-month': !day.isCurrentMonth, 
                'selected': isSelectedDate(day),
                'today': isToday(day)
              }]"
              @click="selectDate(day)"
            >
              {{ day.day }}
            </div>
          </div>
        </div>
      </div>

      <!-- Calculator Keyboard -->
      <div class="calculator">
        <div class="calc-grid">
          <!-- Row 1 -->
          <button v-for="key in calculatorKeys.slice(0, 4)" :key="key" class="calc-btn" @click="handleCalcKey(key)">
            {{ key }}
          </button>
          <button class="calc-btn func-btn" @click="handleCalcKey('AC')">AC</button>

          <!-- Row 2 -->
          <button v-for="key in calculatorKeys.slice(4, 8)" :key="key" class="calc-btn" @click="handleCalcKey(key)">
            {{ key }}
          </button>
          <button class="calc-btn func-btn" @click="handleCalcKey('←')">←</button>

          <!-- Row 3 -->
          <button v-for="key in calculatorKeys.slice(8, 12)" :key="key" class="calc-btn" @click="handleCalcKey(key)">
            {{ key }}
          </button>
          <button class="calc-btn save-btn-calc" @click="saveTransaction" :disabled="!canSave">確定</button>

          <!-- Row 4 -->
          <button v-for="key in calculatorKeys.slice(12, 16)" :key="key" class="calc-btn" @click="handleCalcKey(key)">
            {{ key }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import type { Category, EntryType, Transaction } from '../types'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'

const router = useRouter()
const route = useRoute()

// State
const editingTransactionId = ref<string | null>(null)
const editingTransaction = ref<Transaction | null>(null)
const transactionType = ref<EntryType>('EXPENSE')
const selectedCategoryId = ref<string>('')
const selectedCategoryName = ref<string>('選擇分類')
const amount = ref<string>('')
const notes = ref<string>('')
const currentDate = ref<number>(Date.now())
const allCategories = ref<Category[]>([])
const showCalendar = ref<boolean>(false)
const calendarViewDate = ref<Date>(new Date())

// Weekdays for calendar
const weekdays = ['週一', '週二', '週三', '週四', '週五', '週六', '週日']

interface CalendarDay {
  day: number
  month: number
  year: number
  isCurrentMonth: boolean
  date: Date
}

// Calculator keys layout
const calculatorKeys = [
  '7', '8', '9', '÷',
  '4', '5', '6', '×',
  '1', '2', '3', '+',
  '00', '0', '.', '=',
]

// Computed properties
const filteredCategories = computed(() => {
  return allCategories.value.filter(cat => cat.type === transactionType.value && !cat.is_deleted)
})

const formattedAmount = computed(() => {
  return amount.value || '0'
})

const formattedDate = computed(() => {
  const date = new Date(currentDate.value)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const weekDay = weekDays[date.getDay()]
  return `${year}/${month}/${day} 星期${weekDay}`
})

const canSave = computed(() => {
  return selectedCategoryId.value && amount.value && parseFloat(amount.value) > 0
})

const calendarYearMonth = computed(() => {
  const year = calendarViewDate.value.getFullYear()
  const month = calendarViewDate.value.getMonth() + 1
  return `${year} 年 ${month} 月`
})

const calendarDays = computed<CalendarDay[]>(() => {
  const year = calendarViewDate.value.getFullYear()
  const month = calendarViewDate.value.getMonth()
  
  // First day of the month
  const firstDay = new Date(year, month, 1)
  // Last day of the month
  const lastDay = new Date(year, month + 1, 0)
  
  // Get day of week (0 = Sunday, 1 = Monday, etc.)
  let firstDayOfWeek = firstDay.getDay()
  // Convert Sunday (0) to 7, so Monday is 1
  firstDayOfWeek = firstDayOfWeek === 0 ? 7 : firstDayOfWeek
  
  const days: CalendarDay[] = []
  
  // Add days from previous month
  const prevMonthLastDay = new Date(year, month, 0).getDate()
  for (let i = firstDayOfWeek - 2; i >= 0; i--) {
    const day = prevMonthLastDay - i
    const prevMonth = month - 1
    const prevYear = prevMonth < 0 ? year - 1 : year
    const actualMonth = prevMonth < 0 ? 11 : prevMonth
    days.push({
      day,
      month: actualMonth,
      year: prevYear,
      isCurrentMonth: false,
      date: new Date(prevYear, actualMonth, day)
    })
  }
  
  // Add days from current month
  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({
      day,
      month,
      year,
      isCurrentMonth: true,
      date: new Date(year, month, day)
    })
  }
  
  // Add days from next month to fill the grid
  const remainingDays = 42 - days.length // 6 rows * 7 days
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month + 1
    const nextYear = nextMonth > 11 ? year + 1 : year
    const actualMonth = nextMonth > 11 ? 0 : nextMonth
    days.push({
      day,
      month: actualMonth,
      year: nextYear,
      isCurrentMonth: false,
      date: new Date(nextYear, actualMonth, day)
    })
  }
  
  return days
})

// Methods
const loadCategories = async () => {
  const categories = await categoryRepository.getAll()
  allCategories.value = categories
}

const loadTransaction = async (id: string) => {
  const transaction = await transactionRepository.getById(id)
  if (transaction) {
    editingTransactionId.value = id
    editingTransaction.value = transaction
    transactionType.value = transaction.type
    selectedCategoryId.value = transaction.category_id
    amount.value = String(transaction.amount)
    notes.value = transaction.note || ''
    currentDate.value = transaction.date
    
    // Set category name
    const category = allCategories.value.find(c => c.id === transaction.category_id)
    if (category) {
      selectedCategoryName.value = category.name
    }
  }
}

const selectCategory = (category: Category) => {
  selectedCategoryId.value = category.id
  selectedCategoryName.value = category.name
  if (!notes.value) {
    notes.value = category.name
  }
}

const handleCalcKey = (key: string) => {
  if (key === 'AC') {
    amount.value = ''
    return
  }

  if (key === '←') {
    amount.value = amount.value.slice(0, -1)
    return
  }

  if (key === '=') {
    try {
      // Replace Chinese operators with standard operators
      let expr = amount.value
        .replace(/÷/g, '/')
        .replace(/×/g, '*')
      amount.value = String(Math.round(eval(expr) * 100) / 100)
    } catch {
      // Invalid expression, ignore
    }
    return
  }

  // Handle number and operator input
  if (key === '.' && amount.value.includes('.')) {
    return // Prevent multiple decimal points
  }

  amount.value += key
}

const previousDate = () => {
  currentDate.value -= 24 * 60 * 60 * 1000
}

const nextDate = () => {
  currentDate.value += 24 * 60 * 60 * 1000
}

const previousMonth = () => {
  const newDate = new Date(calendarViewDate.value)
  newDate.setMonth(newDate.getMonth() - 1)
  calendarViewDate.value = newDate
}

const nextMonth = () => {
  const newDate = new Date(calendarViewDate.value)
  newDate.setMonth(newDate.getMonth() + 1)
  calendarViewDate.value = newDate
}

const selectToday = () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  currentDate.value = today.getTime()
  calendarViewDate.value = today
  showCalendar.value = false
}

const selectDate = (day: CalendarDay) => {
  const selected = new Date(day.year, day.month, day.day)
  selected.setHours(0, 0, 0, 0)
  currentDate.value = selected.getTime()
  
  // Update calendar view if selecting from another month
  if (!day.isCurrentMonth) {
    calendarViewDate.value = selected
  }
  
  showCalendar.value = false
}

const isSelectedDate = (day: CalendarDay): boolean => {
  const selected = new Date(currentDate.value)
  return (
    day.day === selected.getDate() &&
    day.month === selected.getMonth() &&
    day.year === selected.getFullYear()
  )
}

const isToday = (day: CalendarDay): boolean => {
  const today = new Date()
  return (
    day.day === today.getDate() &&
    day.month === today.getMonth() &&
    day.year === today.getFullYear()
  )
}

const goBack = () => {
  router.push('/transactions')
}

const saveTransaction = async () => {
  if (!canSave.value) return

  const isEditing = !!editingTransactionId.value
  const baseVersion = isEditing ? (editingTransaction.value?.version || 0) : 0
  
  const transaction: Transaction = {
    id: isEditing ? editingTransactionId.value! : `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    category_id: selectedCategoryId.value,
    type: transactionType.value,
    amount: parseFloat(amount.value),
    note: notes.value,
    date: currentDate.value, // Use milliseconds timestamp directly
    version: baseVersion + 1,
    is_deleted: 0
  }

  await transactionRepository.upsert(transaction)
  // Enqueue sync operation so the change will be pushed to server
  try {
    const mutationId = crypto.randomUUID()
    const payload = JSON.stringify({
      id: transaction.id,
      user_id: localStorage.getItem('sync_user_id') || 'demo-user',
      category_id: transaction.category_id,
      type: transaction.type,
      amount: transaction.amount,
      note: transaction.note,
      date: transaction.date,
    })

    await syncQueueRepository.add({
      mutation_id: mutationId,
      entity_type: 'TXN',
      entity_id: transaction.id,
      payload,
      base_version: baseVersion,
      created_at: Date.now(),
    })
  } catch (e) {
    // If enqueuing fails, still navigate back; queue can be reconstructed later
    // avoid blocking the user flow
  }
  router.push('/transactions')
}

// Lifecycle
onMounted(async () => {
  await loadCategories()
  
  // Initialize calendar view date
  calendarViewDate.value = new Date(currentDate.value)
  
  // Check if we're editing an existing transaction
  const transactionId = route.params.id as string
  if (transactionId) {
    await loadTransaction(transactionId)
    // Update calendar view to match transaction date
    calendarViewDate.value = new Date(currentDate.value)
  }
})
</script>

<style scoped>
.transaction-edit-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  max-height: 100vh;
  background: #fff;
  overflow: hidden;
}

/* Header */
.edit-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  flex-shrink: 0;
}

.back-btn {
  background: #000;
  border: none;
  padding: 8px 12px;
  border-radius: 20px;
  cursor: pointer;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
}

.back-btn:hover {
  opacity: 0.8;
}

.back-btn svg {
  stroke: #fff;
}

.type-toggle {
  display: flex;
  gap: 8px;
  background: #f5f5f5;
  border-radius: 12px;
  padding: 4px;
}

.toggle-btn {
  padding: 8px 20px;
  border: none;
  background: none;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  color: #999;
  transition: all 0.2s;
}

.toggle-btn.active {
  background: #000;
  color: #fff;
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
  flex: 0 0 auto;
  max-height: 30vh;
  overflow-y: auto;
  padding: 16px;
  border-bottom: 2px solid #000;
}

.categories-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.category-item {
  padding: 14px 10px;
  border: 2px solid #000;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  text-align: center;
  transition: all 0.2s;
  word-break: break-word;
}

.category-item:hover {
  background: #f9f9f9;
}

.category-item.selected {
  background: #000;
  color: #fff;
}

/* Input Section */
.input-section {
  flex-shrink: 0;
  padding: 16px;
  border-bottom: 2px solid #000;
}

.input-group {
  display: flex;
  align-items: center;
  gap: 12px;
}

.label {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 150px;
}

.category-name {
  font-size: 14px;
  color: #666;
  font-weight: 500;
  white-space: nowrap;
}

.amount-display {
  font-size: 24px;
  font-weight: 700;
  color: #000;
}

.notes-input {
  flex: 1;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 12px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.notes-input:focus {
  border-color: #000;
}

/* Date Picker */
.date-picker {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  border-bottom: 2px solid #000;
  background: #fff;
  margin: 0;
}

.date-nav-btn {
  background: #f5f5f5;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  cursor: pointer;
  color: #000;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.2s;
}

.date-nav-btn:hover {
  background: #e0e0e0;
}

.date-display {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #000;
  font-weight: 600;
  font-size: 15px;
  flex: 1;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s;
}

.date-display:hover {
  opacity: 0.7;
}

/* Calculator */
.calculator {
  flex-shrink: 0;
  padding: 16px;
  background: #fff;
}

.calc-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.calc-btn {
  padding: 18px;
  border: 2px solid #000;
  border-radius: 12px;
  background: #fff;
  cursor: pointer;
  font-size: 18px;
  font-weight: 600;
  transition: all 0.2s;
}

.calc-btn:hover {
  background: #f5f5f5;
}

.calc-btn:active {
  background: #e8e8e8;
}

.calc-btn.func-btn {
  background: #f5f5f5;
  color: #000;
  font-weight: 600;
}

.calc-btn.func-btn:hover {
  background: #e8e8e8;
}

.calc-btn.save-btn-calc {
  background: var(--janote-primary);
  border: 2px solid var(--janote-primary);
  color: #fff;
  font-weight: 700;
  font-size: 16px;
  grid-row: span 2;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(255, 82, 82, 0.3);
}

.calc-btn.save-btn-calc:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 82, 82, 0.4);
}

.calc-btn.save-btn-calc:disabled {
  background: #e0e0e0;
  border-color: #e0e0e0;
  color: #999;
  cursor: not-allowed;
  box-shadow: none;
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
  background: #999;
}

/* Calendar Modal */
.calendar-overlay {
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

.calendar-modal {
  background: #fff;
  border-radius: 16px;
  padding: 20px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
}

.calendar-nav-btn {
  background: #f5f5f5;
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  font-size: 16px;
  cursor: pointer;
  transition: background 0.2s;
}

.calendar-nav-btn:hover {
  background: #e0e0e0;
}

.calendar-title {
  font-size: 16px;
  font-weight: 700;
  flex: 1;
  text-align: center;
}

.today-btn {
  background: #000;
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
}

.today-btn:hover {
  opacity: 0.8;
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #666;
  padding: 8px 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.2s;
}

.calendar-day:hover {
  background: #f5f5f5;
}

.calendar-day.other-month {
  color: #ccc;
}

.calendar-day.today {
  background: #FFE5E5;
  color: var(--janote-primary);
  font-weight: 700;
}

.calendar-day.selected {
  background: var(--janote-primary);
  color: #fff;
  font-weight: 700;
}

.calendar-day.selected:hover {
  background: var(--janote-primary-hover);
}
</style>
