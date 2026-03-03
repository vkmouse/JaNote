<template>
  <div class="donut-chart-container">
    <svg class="donut-chart" viewBox="0 0 200 200">
      <path
        v-for="(slice, index) in processedSlices"
        :key="index"
        :d="getSliceArcPath(index)"
        :fill="slice.sliceColor"
        stroke="#333"
        stroke-width="1"
        stroke-linejoin="round"
      />
    </svg>
    <div class="chart-center">
      <div class="chart-label">{{ centerLabel }}</div>
      <div class="chart-balance">{{ centerBalance }}</div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface DonutSlice {
  sliceLabel: string
  sliceValue: number
  sliceColor: string
}

const props = defineProps<{
  centerLabel: string
  centerBalance: string
  slices: DonutSlice[]
  minSliceThreshold?: number
}>()

const cx = 100
const cy = 100
const outerR = 90
const innerR = 55
const gapPx = 2
const minThreshold = props.minSliceThreshold ?? 2 // 預設 2%

// 將度數轉換為弧度
function toRad(deg: number) {
  return ((deg - 90) * Math.PI) / 180
}

// 產生甜甜圈弧形路徑
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

// 外圈與內圈對應的間隔角度
const outerGapDeg = computed(() => (gapPx / outerR) * (180 / Math.PI))
const innerGapDeg = computed(() => (gapPx / innerR) * (180 / Math.PI))

// 處理切片資料：補足極小切片，按比例縮減大切片
const processedSlices = computed<{
  sliceLabel: string
  sliceValue: number
  slicePercentage: number
  sliceColor: string
}[]>(() => {
  // 若所有數值皆為 0，回傳灰色的 100% 切片
  const total = props.slices.reduce((sum, slice) => sum + slice.sliceValue, 0)
  if (total === 0) {
    return [
      {
        sliceLabel: '无数据',
        sliceValue: 100,
        slicePercentage: 100,
        sliceColor: '#e0e0e0',
      },
    ]
  }

  // 計算初始百分比
  const slicesWithPercentage = props.slices.map((slice) => ({
    ...slice,
    slicePercentage: (slice.sliceValue / total) * 100,
  }))

  // 識別小於門檻的切片
  const smallSlices = slicesWithPercentage.filter(s => s.slicePercentage > 0 && s.slicePercentage < minThreshold)
  const largeSlices = slicesWithPercentage.filter(s => s.slicePercentage >= minThreshold)

  // 若沒有極小切片，直接返回
  if (smallSlices.length === 0) {
    return slicesWithPercentage
  }

  // 計算需要補足的總百分比
  const subsidyNeeded = smallSlices.length * minThreshold - smallSlices.reduce((sum, s) => sum + s.slicePercentage, 0)

  // 從大切片按比例縮減空間
  const largeSlicesTotalPercentage = largeSlices.reduce((sum, s) => sum + s.slicePercentage, 0)
  const reductionRatio = (largeSlicesTotalPercentage - subsidyNeeded) / largeSlicesTotalPercentage

  // 套用調整
  const adjustedLargeSlices = largeSlices.map(s => ({
    ...s,
    slicePercentage: s.slicePercentage * reductionRatio,
  }))

  // 小切片補足到最小門檻
  const adjustedSmallSlices = smallSlices.map(s => ({
    ...s,
    slicePercentage: minThreshold,
  }))

  // 合併並保留原始順序
  const result: {
    sliceLabel: string
    sliceValue: number
    slicePercentage: number
    sliceColor: string
  }[] = []

  slicesWithPercentage.forEach((slice) => {
    const adjusted = adjustedSmallSlices.find(s => s.sliceLabel === slice.sliceLabel) ||
                     adjustedLargeSlices.find(s => s.sliceLabel === slice.sliceLabel)
    if (adjusted) {
      result.push(adjusted)
    }
  })

  return result
})

// 取得第 i 個切片的弧形路徑
function getSliceArcPath(index: number): string {
  const slices = processedSlices.value
  if (!slices || slices.length === 0 || index >= slices.length) {
    return ''
  }

  let startDeg = 0

  // 累計前方切片的角度
  for (let i = 0; i < index; i++) {
    startDeg += (slices[i]!.slicePercentage * 3.6)
  }

  const sliceAngleDeg = slices[index]!.slicePercentage * 3.6
  const endDeg = startDeg + sliceAngleDeg

  // 在每個切片兩端套用間隔
  const outerStartDeg = startDeg + outerGapDeg.value
  const outerEndDeg = endDeg - outerGapDeg.value
  const innerStartDeg = startDeg + innerGapDeg.value
  const innerEndDeg = endDeg - innerGapDeg.value

  return getArcPath(
    outerStartDeg,
    outerEndDeg,
    innerStartDeg,
    innerEndDeg,
    innerR,
    outerR
  )
}
</script>

<style scoped>
.donut-chart-container {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.donut-chart {
  width: 240px;
  height: 240px;
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
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}
</style>
