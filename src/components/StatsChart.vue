<template>
  <div>
    <div class="summary-section">
      <div class="summary-item">
        <div class="summary-label">月支出</div>
        <div class="summary-amount">${{ monthlyExpense.toLocaleString() }}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">月收入</div>
        <div class="summary-amount">${{ monthlyIncome.toLocaleString() }}</div>
      </div>
    </div>

    <div class="chart-section">
      <svg class="donut-chart" viewBox="0 0 200 200">
        <path
          v-if="incomePercentage > 0"
          :d="incomeArcPath"
          fill="#47B8E0"
          stroke="#333"
          stroke-width="1"
          stroke-linejoin="round"
        />
        <path
          v-if="expensePercentage > 0"
          :d="expenseArcPath"
          fill="#FFC952"
          stroke="#333"
          stroke-width="1"
          stroke-linejoin="round"
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
import { computed } from 'vue'

const props = defineProps<{
  monthlyExpense: number
  monthlyIncome: number
  balance: number
  expensePercentage: number
  incomePercentage: number
}>()

const cx = 100
const cy = 100
const outerR = 90
const innerR = 55
const gapPx = 2 // 白色間隔的實際像素寬度

// 各半徑對應的間隔角度（弧長 = r * θ，θ = 弧長 / r，轉為度數）
const outerGapDeg = computed(() => (gapPx / outerR) * (180 / Math.PI))
const innerGapDeg = computed(() => (gapPx / innerR) * (180 / Math.PI))

const incomeAngle = computed(() => props.incomePercentage * 3.6)

function toRad(deg: number) {
  return ((deg - 90) * Math.PI) / 180
}

/**
 * 產生甜甜圈弧形，外圈與內圈各自用對應半徑的間隔角度
 * outerStart/outerEnd: 外圈弧的起訖角度
 * innerStart/innerEnd: 內圈弧的起訖角度
 */
function getArcPath(
  outerStartDeg: number,
  outerEndDeg: number,
  innerStartDeg: number,
  innerEndDeg: number,
  r1: number,
  r2: number
): string {
  const os = toRad(outerStartDeg)
  const oe = toRad(outerEndDeg)
  const is = toRad(innerStartDeg)
  const ie = toRad(innerEndDeg)

  const x1 = cx + r2 * Math.cos(os)
  const y1 = cy + r2 * Math.sin(os)
  const x2 = cx + r2 * Math.cos(oe)
  const y2 = cy + r2 * Math.sin(oe)
  const x3 = cx + r1 * Math.cos(ie)
  const y3 = cy + r1 * Math.sin(ie)
  const x4 = cx + r1 * Math.cos(is)
  const y4 = cy + r1 * Math.sin(is)

  const large = outerEndDeg - outerStartDeg > 180 ? 1 : 0

  return [
    `M ${x1} ${y1}`,
    `A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ')
}

// 收入弧 (藍色)
const incomeArcPath = computed(() =>
  getArcPath(
    outerGapDeg.value,                        // 外圈起點
    incomeAngle.value - outerGapDeg.value,    // 外圈終點
    innerGapDeg.value,                        // 內圈起點
    incomeAngle.value - innerGapDeg.value,    // 內圈終點
    innerR,
    outerR
  )
)

// 支出弧 (黃色)
const expenseArcPath = computed(() =>
  getArcPath(
    incomeAngle.value + outerGapDeg.value,    // 外圈起點
    360 - outerGapDeg.value,                  // 外圈終點
    incomeAngle.value + innerGapDeg.value,    // 內圈起點
    360 - innerGapDeg.value,                  // 內圈終點
    innerR,
    outerR
  )
)
</script>

<style scoped>
/* 同原本樣式，僅補充 filter */
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

.summary-item:first-child { align-items: flex-start; }
.summary-item:last-child  { align-items: flex-end; }

.summary-label {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  border-bottom: 3px solid;
  padding-bottom: 4px;
}

.summary-item:nth-child(1) .summary-label { border-color: var(--janote-expense); }
.summary-item:nth-child(2) .summary-label { border-color: var(--janote-income); }

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
  .summary-amount { font-size: 20px; }
}
</style>