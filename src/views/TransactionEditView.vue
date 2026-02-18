<template>
  <div class="transaction-edit-page">
    <!-- Header -->
    <TopNavigation>
      <div class="edit-header-content">
        <button class="back-btn" @click="goBack">
          <span v-html="ArrowLeftIcon" class="back-icon"></span>
        </button>
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
    </TopNavigation>

    <!-- Main Content -->
    <div class="edit-content page">
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
              <span :class="['amount-display', { 'amount-expense': transactionType === 'EXPENSE', 'amount-income': transactionType === 'INCOME' }]">{{ '$' + formattedAmount }}</span>
          </label>
          <input
            v-model="notes"
            @input="onNotesInput"
            type="text"
            placeholder="備註"
            class="notes-input"
          />
        </div>
      </div>

      <!-- Date Picker & Calculator Panel -->
      <div class="input-panel">
        <CalendarPicker v-model="currentDate" />
        <CalculatorPad v-model="amount" :canConfirm="canSave" @confirm="saveTransaction" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import TopNavigation from '../components/TopNavigation.vue'
import CalendarPicker from '../components/CalendarPicker.vue'
import CalculatorPad from '../components/CalculatorPad.vue'
import type { Category, EntryType, Transaction } from '../types'
import { categoryRepository } from '../repositories/categoryRepository'
import { transactionRepository } from '../repositories/transactionRepository'
import { syncQueueRepository } from '../repositories/syncQueueRepository'
import ArrowLeftIcon from '../assets/icons/icon-arrow-left.svg?raw'

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
const previousAutoNote = ref<string | null>(null)
const currentDate = ref<number>(Date.now())
const allCategories = ref<Category[]>([])

// Computed properties
const filteredCategories = computed(() => {
  return allCategories.value.filter(cat => cat.type === transactionType.value && !cat.is_deleted)
})

const formattedAmount = computed(() => {
  const num = amount.value || '0'
  // Add comma separators for numbers
  if (/^[0-9.]+$/.test(num)) {
    const parts = num.split('.')
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return parts.join('.')
  }
  return num
})


const canSave = computed(() => {
  return selectedCategoryId.value && amount.value && parseFloat(amount.value) > 0
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
      // If the loaded transaction's note is empty or equals the category name,
      // treat it as an auto-inserted note so future category changes will replace it.
      if (!transaction.note || transaction.note === category.name) {
        previousAutoNote.value = category.name
      } else {
        previousAutoNote.value = null
      }
    }
  }
}

const selectCategory = (category: Category) => {
  selectedCategoryId.value = category.id
  selectedCategoryName.value = category.name
  // Only overwrite notes when it's empty or was previously auto-inserted
  if (!notes.value || notes.value === previousAutoNote.value) {
    notes.value = category.name
    previousAutoNote.value = category.name
  } else {
    // User has a custom note; stop treating notes as auto-inserted
    previousAutoNote.value = null
  }
}

const onNotesInput = () => {
  // If user changes the notes away from the previously auto-inserted value,
  // clear the auto-note marker so future category changes won't overwrite.
  if (previousAutoNote.value && notes.value !== previousAutoNote.value) {
    previousAutoNote.value = null
  }
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

  // Check if we're editing an existing transaction
  const transactionId = route.params.id as string
  if (transactionId) {
    await loadTransaction(transactionId)
  }
})
</script>

<style scoped>
.transaction-edit-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-page);
  overflow: hidden;
}

@media (max-width: 768px) {
  .transaction-edit-page {
    height: calc(100vh - 72px); /* Subtract bottom nav height on mobile */
  }
}

/* Header Content inside TopNavigation */
.edit-header-content {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  position: relative;
}


.back-btn {
  background: transparent;
  border: none;
  padding: 4px 0;
  border-radius: 20px;
  cursor: pointer;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.2s;
  position: absolute;
  left: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.back-btn:hover {
  opacity: 0.8;
}

.back-btn svg {
  stroke: var(--text-primary);
}

.type-toggle {
  display: flex;
  background: #f5f5f5;
  border-radius: 12px;
  border: 2px solid var(--border-primary);
}

.toggle-btn {
  padding: 4px 20px;
  border: none;
  background: var(--bg-page);
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 15px;
  color: var(--text-primary);
  transition: all 0.2s;
}

.toggle-btn.active {
  background: var(--text-primary);
  color: var(--text-light);
}

/* Expense / Income specific active styles */
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

.categories-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.category-item {
  padding: 14px 10px;
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  background: var(--bg-page);
  cursor: pointer;
  font-size: 16px;
  font-weight: 500;
  text-align: center;
  transition: all 0.2s;
  word-break: break-word;
  color: var(--text-primary);
}

.category-item:hover {
  background: #f9f9f9;
}

.category-item.selected {
  background: var(--text-primary);
  color: var(--text-light);
}

/* Input Section */
.input-section {
  flex-shrink: 0;
  padding: 16px;
  border-bottom: 2px solid var(--border-primary);
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
  color: var(--text-secondary);
  font-weight: 500;
  white-space: nowrap;
}

.amount-display {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

/* Amount color follows transaction type */
.amount-display.amount-expense {
  color: var(--text-primary);
}

.amount-display.amount-income {
  color: var(--text-primary);
}

.notes-input {
  flex: 1;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  padding: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.2s;
}

.notes-input:focus {
  border-color: var(--border-primary);
}

@media (max-width: 480px) {
  .notes-input {
    padding: 8px;
    font-size: 13px;
  }
}

/* Input Panel - Unified Date Picker & Calculator Block (updated per request) */
.input-panel {
  flex-shrink: 0;
  background: var(--janote-expense);
  margin: 0;
  border-radius: 0;
  padding: 16px;
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
