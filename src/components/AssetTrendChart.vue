<template>
  <div class="trend-chart">
    <div v-if="!hasAnyData" class="chart-empty-text">
      <p>{{ year }} 年尚無資產紀錄</p>
    </div>

    <template v-else>
      <div class="trend-summary">
        <div class="summary-label">{{ focusedPoint?.month ?? "" }}月 {{ currentSeriesLabel }}</div>
        <div class="summary-value">${{ focusedValue.toLocaleString() }}</div>
        <div v-if="deltaInfo" class="summary-delta" :class="deltaInfo.direction">
          <span v-if="deltaInfo.direction !== 'flat'" class="delta-arrow">{{
            deltaInfo.direction === "up" ? "▲" : "▼"
          }}</span>
          <span>{{ deltaInfo.amountText }}</span>
          <span v-if="deltaInfo.percentText" class="delta-percent">({{ deltaInfo.percentText }})</span>
          <span class="delta-caption">較上月</span>
        </div>
        <div v-else class="summary-delta neutral">
          <span class="delta-caption">年度起點</span>
        </div>
      </div>

      <div class="series-chips" role="tablist" aria-label="資產趨勢分類">
        <button
          v-for="opt in seriesOptions"
          :key="opt.key"
          type="button"
          class="series-chip"
          :class="{ active: selectedSeries === opt.key }"
          :style="{ '--chip-color': opt.color }"
          role="tab"
          :aria-selected="selectedSeries === opt.key"
          @click="selectedSeries = opt.key"
        >
          <span class="chip-dot" />
          <span class="chip-label">{{ opt.label }}</span>
        </button>
      </div>

      <div class="chart-wrap">
        <svg class="trend-svg" viewBox="0 0 340 180" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trendAreaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="currentColor" stop-opacity="0.28" />
              <stop offset="100%" :stop-color="currentColor" stop-opacity="0" />
            </linearGradient>
          </defs>

          <line :x1="PAD_LEFT" :y1="baselineY" :x2="VIEW_W - PAD_RIGHT" :y2="baselineY" class="baseline" />

          <path v-if="points.length > 1" :d="areaPath" fill="url(#trendAreaGradient)" />
          <path
            v-if="points.length > 1"
            :d="linePath"
            fill="none"
            :stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />

          <g v-for="(p, i) in points" :key="p.month">
            <circle
              :cx="xAt(i)"
              :cy="yAt(seriesValues[i] ?? 0)"
              r="12"
              fill="transparent"
              class="hit-target"
              @click="focusedIndex = i"
            />
            <circle
              :cx="xAt(i)"
              :cy="yAt(seriesValues[i] ?? 0)"
              :r="focusedIndex === i ? 5 : 3"
              :fill="focusedIndex === i ? currentColor : 'var(--bg-page)'"
              :stroke="currentColor"
              stroke-width="2"
              class="point"
            />
            <text :x="xAt(i)" :y="VIEW_H - 6" class="month-label" text-anchor="middle">{{ p.month }}</text>
          </g>
        </svg>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useAssetStore, startOfDay } from "../stores/assetStore";
import { getCategoryColor } from "./CategoryIcon.vue";

const props = defineProps<{ year: number }>();

const assetStore = useAssetStore();

interface MonthPoint {
  month: number;
  ts: number;
  total: number;
  byCategory: Record<string, number>;
}

// 每個月一點：本月看今天的快照，其餘月份看月底快照（與 AssetView 的邏輯一致）
// 未來年份／未來月份不產生資料點，避免畫出虛構的未來走勢
const points = computed<MonthPoint[]>(() => {
  const now = new Date();
  if (props.year > now.getFullYear()) return [];
  const isCurrentYear = props.year === now.getFullYear();
  const lastMonth = isCurrentYear ? now.getMonth() + 1 : 12;

  const result: MonthPoint[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const isThisMonth = isCurrentYear && m === lastMonth;
    const asOf = isThisMonth ? startOfDay(now.getTime()) : new Date(props.year, m, 0).getTime();
    const snapshot = assetStore.getSnapshot(asOf);
    const byCategory: Record<string, number> = {};
    let total = 0;
    for (const c of assetStore.visibleCategories) {
      const v = snapshot[c.id] ?? 0;
      byCategory[c.id] = v;
      total += v;
    }
    result.push({ month: m, ts: asOf, total, byCategory });
  }
  return result;
});

const hasAnyData = computed(() => points.value.some((p) => p.total > 0));

// 只列出這一年曾經有金額的分類，避免一排空的分類籤全部塞進來
const activeCategories = computed(() =>
  assetStore.visibleCategories.filter((c) => points.value.some((p) => (p.byCategory[c.id] ?? 0) > 0)),
);

const selectedSeries = ref<string>("total");

watch([activeCategories, () => props.year], () => {
  if (selectedSeries.value !== "total" && !activeCategories.value.some((c) => c.id === selectedSeries.value)) {
    selectedSeries.value = "total";
  }
});

const seriesOptions = computed(() => [
  { key: "total", label: "總資產", color: "var(--janote-income)" },
  ...activeCategories.value.map((c) => ({
    key: c.id,
    label: c.name,
    color: getCategoryColor(c.name),
  })),
]);

const currentSeriesLabel = computed(
  () => seriesOptions.value.find((o) => o.key === selectedSeries.value)?.label ?? "總資產",
);
const currentColor = computed(
  () => seriesOptions.value.find((o) => o.key === selectedSeries.value)?.color ?? "var(--janote-income)",
);

const seriesValues = computed(() =>
  points.value.map((p) => (selectedSeries.value === "total" ? p.total : (p.byCategory[selectedSeries.value] ?? 0))),
);

const focusedIndex = ref(0);

// 換系列或換年份時，預設聚焦在最後一個資料點（最新月份）
watch(
  [points, selectedSeries],
  () => {
    focusedIndex.value = points.value.length > 0 ? points.value.length - 1 : 0;
  },
  { immediate: true },
);

const focusedPoint = computed(() => points.value[focusedIndex.value]);
const focusedValue = computed(() => seriesValues.value[focusedIndex.value] ?? 0);

interface DeltaInfo {
  direction: "up" | "down" | "flat";
  amountText: string;
  percentText: string | null;
}

const deltaInfo = computed<DeltaInfo | null>(() => {
  if (focusedIndex.value <= 0) return null;
  const prev = seriesValues.value[focusedIndex.value - 1] ?? 0;
  const curr = focusedValue.value;
  const diff = curr - prev;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const amountText = `$${Math.abs(diff).toLocaleString()}`;
  const percentText = prev > 0 ? `${diff >= 0 ? "+" : "-"}${((Math.abs(diff) / prev) * 100).toFixed(1)}%` : null;
  return { direction, amountText, percentText };
});

// ── SVG 幾何 ───────────────────────────────────────────────
const VIEW_W = 340;
const VIEW_H = 180;
const PAD_LEFT = 14;
const PAD_RIGHT = 14;
const PAD_TOP = 16;
const PAD_BOTTOM = 30;
const plotWidth = VIEW_W - PAD_LEFT - PAD_RIGHT;
const plotHeight = VIEW_H - PAD_TOP - PAD_BOTTOM;
const baselineY = PAD_TOP + plotHeight;

function xAt(i: number): number {
  if (points.value.length <= 1) return PAD_LEFT + plotWidth / 2;
  return PAD_LEFT + (plotWidth / (points.value.length - 1)) * i;
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

const yMax = computed(() => niceCeil((Math.max(...seriesValues.value, 0) || 1) * 1.15));

function yAt(value: number): number {
  const ratio = Math.min(value / yMax.value, 1);
  return baselineY - ratio * plotHeight;
}

const linePath = computed(() => {
  if (points.value.length < 2) return "";
  return points.value
    .map((_, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yAt(seriesValues.value[i] ?? 0).toFixed(1)}`)
    .join(" ");
});

const areaPath = computed(() => {
  if (points.value.length < 2) return "";
  const last = points.value.length - 1;
  return `${linePath.value} L ${xAt(last).toFixed(1)} ${baselineY} L ${xAt(0).toFixed(1)} ${baselineY} Z`;
});
</script>

<style scoped>
.trend-chart {
  display: flex;
  flex-direction: column;
}

.chart-empty-text {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-disabled);
  font-size: 14px;
}

.trend-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 20px 4px;
}

.summary-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.summary-delta {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.summary-delta.up {
  color: var(--janote-income);
}

.summary-delta.down {
  color: var(--janote-expense);
}

.delta-caption {
  margin-left: 2px;
  font-weight: 500;
  color: var(--text-secondary);
}

.summary-delta.neutral .delta-caption {
  color: var(--text-disabled);
}

.series-chips {
  display: flex;
  gap: 8px;
  padding: 12px 20px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.series-chips::-webkit-scrollbar {
  display: none;
}

.series-chip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  background: var(--bg-page);
  color: var(--text-secondary);
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    border-color 0.2s ease,
    background-color 0.2s ease,
    color 0.2s ease;
}

.series-chip:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 2px;
}

.series-chip.active {
  border-color: var(--chip-color);
  background: var(--bg-hover);
  color: var(--text-primary);
}

.chip-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border: 1px solid var(--chart-stroke);
  border-radius: 50%;
  background: var(--chip-color);
}

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

.month-label {
  font-size: 9px;
  font-weight: 500;
  fill: var(--text-secondary);
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
