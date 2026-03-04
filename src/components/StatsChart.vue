<template>
  <div>
    <!-- 支出/收入標籤，寬度 fit-content，點擊跳轉摘要頁 -->
    <div class="summary-section">
      <div
        class="summary-item summary-item-left"
        @click="router.push('/transactions/summary')"
      >
        <div class="summary-label">月支出</div>
        <div class="summary-amount">${{ monthlyExpense.toLocaleString() }}</div>
      </div>

      <div
        class="summary-item summary-item-right"
        @click="router.push('/transactions/summary')"
      >
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
import { computed } from "vue";
import { useRouter } from "vue-router";
import DonutChart from "./DonutChart.vue";
import type { DonutSlice } from "./DonutChart.vue";

const props = defineProps<{
  monthlyExpense: number;
  monthlyIncome: number;
  balance: number;
  expensePercentage: number;
  incomePercentage: number;
}>();

const router = useRouter();

const chartSlices = computed<DonutSlice[]>(() => [
  {
    sliceLabel: "月收入",
    sliceValue: props.incomePercentage,
    sliceColor: "#47B8E0",
  },
  {
    sliceLabel: "月支出",
    sliceValue: props.expensePercentage,
    sliceColor: "#FFC952",
  },
]);
</script>

<style scoped>
.summary-section {
  display: flex;
  justify-content: space-between;
  padding: 6px 20px 0;
  background: var(--bg-page);
}

.summary-item {
  display: flex;
  flex-direction: column;
  width: fit-content;
  cursor: pointer;
}

.summary-item-left {
  align-items: flex-start;
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

.summary-item:nth-child(1) .summary-label {
  border-color: var(--janote-expense);
}
.summary-item:nth-child(2) .summary-label {
  border-color: var(--janote-income);
}

.summary-amount {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.chart-section {
  background: var(--bg-page);
  padding-bottom: 40px;
}
</style>
