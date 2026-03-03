<template>
  <div>
    <div class="summary-section">
      <!-- 左：本月支出 -->
      <div class="summary-item summary-item-left">
        <div class="summary-label">月支出</div>
        <div class="summary-amount">${{ monthlyExpense.toLocaleString() }}</div>
      </div>
      
      <!-- 中：月份選擇器 -->
      <div class="summary-item-center">
        <button class="month-selector" @click="$emit('open-month-picker')">
          <span class="month-display">{{ currentMonthDisplay }}</span>
        </button>
      </div>
      
      <!-- 右：本月收入 -->
      <div class="summary-item summary-item-right">
        <div class="summary-label">月收入</div>
        <div class="summary-amount">${{ monthlyIncome.toLocaleString() }}</div>
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
</template>

<script setup lang="ts">
import { computed } from 'vue'
import DonutChart from './DonutChart.vue'
import type { DonutSlice } from './DonutChart.vue'

const props = defineProps<{
  monthlyExpense: number
  monthlyIncome: number
  balance: number
  expensePercentage: number
  incomePercentage: number
  currentMonthDisplay: string
}>()

defineEmits<{
  'open-month-picker': []
}>()

// 為 DonutChart 建構切片資料
const chartSlices = computed<DonutSlice[]>(() => [
  {
    sliceLabel: '月收入',
    sliceValue: props.incomePercentage,
    sliceColor: '#47B8E0',
  },
  {
    sliceLabel: '月支出',
    sliceValue: props.expensePercentage,
    sliceColor: '#FFC952',
  },
])
</script>

<style scoped>
.summary-section {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  padding: 6px 20px 0;
  background: var(--bg-page);
}

.summary-item {
  display: flex;
  flex-direction: column;
}

.summary-item-left {
  align-items: flex-start;
}

.summary-item-center {
  display: flex;
  align-items: flex-start;
  justify-content: center;
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

.summary-item:nth-child(1) .summary-label { border-color: var(--janote-expense); }
.summary-item:nth-child(3) .summary-label { border-color: var(--janote-income); }

.summary-amount {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

/* 月份選擇器 */
.month-selector {
  background: none;
  border: none;
  display: flex;
  align-items: center;
  font-weight: 700;
  font-size: 18px;
  cursor: pointer;
}

.month-display {
  color: var(--text-primary);
}

.month-selector:hover {
  opacity: 0.7;
}

.chart-section {
  background: var(--bg-page);
  padding-bottom: 40px;
}

@media (max-width: 480px) {
  .summary-amount { font-size: 18px; }
}
</style>