<template>
  <div>
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

    <div class="chart-section">
      <svg class="donut-chart" viewBox="0 0 200 200">
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke="#f0f0f0"
          stroke-width="40"
        />
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
        <circle
          cx="100"
          cy="100"
          r="90"
          fill="none"
          stroke="var(--border-primary)"
          stroke-width="1"
        />
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
  </div>
</template>

<script setup lang="ts">
defineProps<{
  monthlyExpense: number
  monthlyIncome: number
  balance: number
  expensePercentage: number
  incomePercentage: number
}>()
</script>

<style scoped>
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

@media (max-width: 480px) {
  .summary-amount {
    font-size: 20px;
  }
}
</style>
