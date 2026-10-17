<template>
  <div class="chart-wrap">
    <svg class="trend-svg" viewBox="0 0 340 180" preserveAspectRatio="none">
      <defs>
        <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" :stop-color="color" stop-opacity="0.28" />
          <stop offset="100%" :stop-color="color" stop-opacity="0" />
        </linearGradient>
      </defs>

      <g v-for="tick in yTicks" :key="tick.value">
        <line
          :x1="PAD_LEFT"
          :y1="tick.y"
          :x2="VIEW_W - PAD_RIGHT"
          :y2="tick.y"
          :class="tick.value === 0 ? 'baseline' : 'grid-line'"
        />
        <text :x="PAD_LEFT - 6" :y="tick.y" class="axis-label y-axis-label" text-anchor="end">
          {{ tick.label }}
        </text>
      </g>

      <path v-if="values.length > 1" :d="areaPath" fill="url(#trendAreaGradient)" />
      <path
        v-if="values.length > 1"
        :d="linePath"
        fill="none"
        :stroke="color"
        stroke-width="2.5"
        stroke-linecap="round"
        stroke-linejoin="round"
      />

      <g v-for="(label, i) in labels" :key="label">
        <circle
          :cx="xAt(i)"
          :cy="yAt(values[i] ?? 0)"
          r="12"
          fill="transparent"
          class="hit-target"
          @click="focusedIndex = i"
        />
        <circle
          :cx="xAt(i)"
          :cy="yAt(values[i] ?? 0)"
          :r="focusedIndex === i ? 5 : 3"
          :fill="focusedIndex === i ? color : 'var(--bg-page)'"
          :stroke="color"
          stroke-width="2"
          class="point"
        />
        <text :x="xAt(i)" :y="VIEW_H - 6" class="axis-label x-axis-label" text-anchor="middle">
          {{ label }}
        </text>
      </g>
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// 純折線圖：只負責畫線、軸與資料點，資料與摘要由父層提供
const props = defineProps<{
  /** X 軸標籤，數量需與 values 一致 */
  labels: string[];
  values: number[];
  color: string;
}>();

/** 目前聚焦的資料點索引，點擊資料點時更新 */
const focusedIndex = defineModel<number>("focusedIndex", { default: 0 });

// ── SVG 幾何 ───────────────────────────────────────────────
const VIEW_W = 340;
const VIEW_H = 180;
// 左邊留給 Y 軸的金額刻度（例如 $1.2m），比純數字寬，要多留一點
const PAD_LEFT = 42;
const PAD_RIGHT = 14;
const PAD_TOP = 18;
const PAD_BOTTOM = 30;
const plotWidth = VIEW_W - PAD_LEFT - PAD_RIGHT;
const plotHeight = VIEW_H - PAD_TOP - PAD_BOTTOM;
const baselineY = PAD_TOP + plotHeight;

function xAt(i: number): number {
  if (props.values.length <= 1) return PAD_LEFT + plotWidth / 2;
  return PAD_LEFT + (plotWidth / (props.values.length - 1)) * i;
}

// 找一個「好看」的上限刻度（1/2/5/10 的倍數），避免折線頂到圖表邊緣
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const exponent = Math.floor(Math.log10(value));
  const magnitude = Math.pow(10, exponent);
  const residual = value / magnitude;
  const niceResidual = residual <= 1 ? 1 : residual <= 2 ? 2 : residual <= 5 ? 5 : 10;
  return niceResidual * magnitude;
}

const yMax = computed(() => niceCeil((Math.max(...props.values, 0) || 1) * 1.15));

function yAt(value: number): number {
  const ratio = Math.min(value / yMax.value, 1);
  return baselineY - ratio * plotHeight;
}

// Y 軸刻度要能一眼看出是金額，不是裸數字：加 $ 字首，破萬用 k、破百萬用 m 縮寫
function formatCompact(value: number): string {
  const trim = (n: number) => {
    const s = n.toFixed(1);
    return s.endsWith(".0") ? s.slice(0, -2) : s;
  };
  if (value >= 1_000_000) return `$${trim(value / 1_000_000)}m`;
  if (value >= 1_000) return `$${trim(value / 1_000)}k`;
  return `$${value.toLocaleString()}`;
}

// 0 / 一半 / 頂端三條參考線，標籤都帶著金額縮寫
const yTicks = computed(() => {
  const max = yMax.value;
  return [0, max / 2, max].map((value) => ({
    value,
    y: yAt(value),
    label: formatCompact(value),
  }));
});

const linePath = computed(() => {
  if (props.values.length < 2) return "";
  return props.values
    .map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
    .join(" ");
});

const areaPath = computed(() => {
  if (props.values.length < 2) return "";
  const last = props.values.length - 1;
  return `${linePath.value} L ${xAt(last).toFixed(1)} ${baselineY} L ${xAt(0).toFixed(1)} ${baselineY} Z`;
});
</script>

<style scoped>
.chart-wrap {
  padding: 8px 4px 0;
}

.trend-svg {
  display: block;
  width: 100%;
  height: auto;
}

.baseline {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 4;
}

/* 上面兩條參考線比 0 那條更淡，視覺上退到背景，不搶折線的注意力 */
.grid-line {
  stroke: var(--border);
  stroke-width: 1;
  stroke-dasharray: 3 4;
  opacity: 0.5;
}

.axis-label {
  font-size: 9px;
  font-weight: 500;
  fill: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.y-axis-label {
  dominant-baseline: middle;
}

.point {
  transition:
    r 0.15s ease,
    fill 0.15s ease;
}

.hit-target {
  cursor: pointer;
}

@media (prefers-reduced-motion: reduce) {
  .point {
    transition: none;
  }
}
</style>
