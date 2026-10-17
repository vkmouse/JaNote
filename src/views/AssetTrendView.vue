<template>
  <section class="asset-trend-page">
    <TopNavigation>
      <template #left>
        <NavMenu />
        <NavSearch to="/assets/search" />
      </template>
      <template #center>
        <div class="year-display" @click="showYearPicker = true">
          <span>{{ selectedYear }}年</span>
        </div>
      </template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <YearPicker v-model:open="showYearPicker" v-model:year="selectedYear" />

    <div class="page-content page">
      <!-- 含不可動用徽章：綠色＝已計入，灰色＝只看可動用；與資產總覽頁共用同一個狀態 -->
      <div class="header-section">
        <button
          type="button"
          :class="['page-badge', showLocked ? 'recurring-badge-active' : 'recurring-badge-inactive']"
          :aria-pressed="showLocked"
          @click="toggleShowLocked"
        >
          <span class="page-badge-icon" v-html="iconLock"></span>
          <span class="page-badge-label">含不可動用</span>
        </button>
      </div>

      <div v-if="!hasAnyData" class="chart-empty-text">
        <p>{{ selectedYear }} 年尚無資產紀錄</p>
      </div>

      <template v-else>
        <!-- 摘要：聚焦月份的金額與較上月的變化，選了分類就換成該分類 -->
        <div class="trend-summary">
          <div class="summary-label">{{ focusedPoint?.month ?? "" }}月 {{ seriesLabel }}</div>
          <div class="summary-value">${{ focusedValue.toLocaleString() }}</div>
          <div class="summary-delta" :class="summaryDelta.direction">
            <template v-if="summaryDelta.empty">
              <span>—</span>
            </template>
            <template v-else>
              <span v-if="summaryDelta.direction !== 'flat'" class="delta-arrow">{{
                summaryDelta.direction === "up" ? "▲" : "▼"
              }}</span>
              <span>{{ summaryDelta.amountText }}</span>
              <span>({{ summaryDelta.percentText ?? "—" }})</span>
            </template>
            <span class="delta-caption">較上月</span>
          </div>
        </div>

        <AssetTrendChart
          v-model:focused-index="focusedIndex"
          :labels="chartLabels"
          :values="seriesValues"
          :color="seriesColor"
        />

        <!-- 分類列表：點擊切換折線圖的系列，再點一次回到總資產 -->
        <div class="category-list">
          <ListGroup>
            <template #header-left>
              <span class="header-label">資產分類</span>
            </template>
            <template #header-right />
            <ListItem v-for="row in categoryRows" :key="row.id">
              <div
                class="category-item"
                :class="{ selected: row.selected }"
                :style="{ '--cat-color': row.color }"
                role="button"
                tabindex="0"
                :aria-pressed="row.selected"
                @click="toggleCategory(row.id)"
                @keydown.enter.prevent="toggleCategory(row.id)"
                @keydown.space.prevent="toggleCategory(row.id)"
              >
                <div class="item-left">
                  <CategoryIcon :category-name="row.name" color-mode="category" />
                  <span class="category-name">{{ row.name }}</span>
                </div>
                <div class="item-right">
                  <span class="item-amount">${{ row.value.toLocaleString() }}</span>
                  <span class="item-delta" :class="row.delta.direction">
                    <template v-if="row.delta.empty">—</template>
                    <template v-else>
                      <span v-if="row.delta.direction !== 'flat'">{{
                        row.delta.direction === "up" ? "▲" : "▼"
                      }}</span>
                      {{ row.delta.amountText }} ({{ row.delta.percentText ?? "—" }})
                    </template>
                  </span>
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
      </template>
    </div>

    <AssetBottomBar />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import YearPicker from "../components/YearPicker.vue";
import AssetBottomBar from "../components/AssetBottomBar.vue";
import AssetTrendChart from "../components/AssetTrendChart.vue";
import CategoryIcon, { getCategoryColor } from "../components/CategoryIcon.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useAssetStore, startOfDay } from "../stores/assetStore";
import { useUserStore } from "../stores/userStore";
import { iconLock } from "../utils/icons";
import { showLocked, toggleShowLocked } from "../composables/useLockedAssets";

const router = useRouter();
const route = useRoute();
const userStore = useUserStore();
const assetStore = useAssetStore();

const selectedYear = ref(new Date().getFullYear());
const showYearPicker = ref(false);

// ── 每月快照 ───────────────────────────────────────────────
interface MonthPoint {
  month: number;
  total: number;
  byCategory: Record<string, number>;
}

function buildPoint(month: number, asOf: number): MonthPoint {
  const snapshot = assetStore.getSnapshot(asOf);
  const byCategory: Record<string, number> = {};
  let total = 0;
  for (const c of assetStore.visibleCategories) {
    const v = snapshot[c.id] ?? 0;
    byCategory[c.id] = v;
    total += v;
  }
  return { month, total, byCategory };
}

// 每個月一點：本月看今天的快照，其餘月份看月底快照（與 AssetView 的邏輯一致）
// 未來年份／未來月份不產生資料點，避免畫出虛構的未來走勢
const points = computed<MonthPoint[]>(() => {
  const now = new Date();
  if (selectedYear.value > now.getFullYear()) return [];
  const isCurrentYear = selectedYear.value === now.getFullYear();
  const lastMonth = isCurrentYear ? now.getMonth() + 1 : 12;

  const result: MonthPoint[] = [];
  for (let m = 1; m <= lastMonth; m++) {
    const isThisMonth = isCurrentYear && m === lastMonth;
    const asOf = isThisMonth ? startOfDay(now.getTime()) : new Date(selectedYear.value, m, 0).getTime();
    result.push(buildPoint(m, asOf));
  }
  return result;
});

// 1 月的「上月」是前一年 12 月底，只用來算差異，不畫在折線上
const baseline = computed<MonthPoint>(() => buildPoint(12, new Date(selectedYear.value, 0, 0).getTime()));

const hasAnyData = computed(() => points.value.some((p) => p.total > 0));

// ── 選取狀態 ───────────────────────────────────────────────
const selectedCategoryId = ref<string | null>(null);

// 所選分類若已不存在（例如換使用者），自然回到總資產
const activeCategory = computed(
  () => assetStore.visibleCategories.find((c) => c.id === selectedCategoryId.value) ?? null,
);

function toggleCategory(id: string) {
  selectedCategoryId.value = selectedCategoryId.value === id ? null : id;
}

const focusedIndex = ref(0);

// 換年份、或資料載入後點數改變時，預設聚焦在最後一個資料點（最新月份）。
// 不監聽 showLocked 與分類選取：切換它們時保留使用者正在看的月份
watch(
  [() => points.value.length, selectedYear],
  () => {
    focusedIndex.value = points.value.length > 0 ? points.value.length - 1 : 0;
  },
  { immediate: true },
);

const safeIndex = computed(() => Math.min(focusedIndex.value, Math.max(points.value.length - 1, 0)));
const focusedPoint = computed<MonthPoint | undefined>(() => points.value[safeIndex.value]);
const prevPoint = computed<MonthPoint>(() => (safeIndex.value > 0 ? points.value[safeIndex.value - 1]! : baseline.value));

// ── 系列（折線圖與摘要）───────────────────────────────────
// 只看可動用時，合計並不含不可動用的資產，標籤要如實標示
const totalLabel = computed(() => (showLocked.value ? "總資產" : "可動用資產"));
const seriesLabel = computed(() => activeCategory.value?.name ?? totalLabel.value);
const seriesColor = computed(() =>
  activeCategory.value ? getCategoryColor(activeCategory.value.name) : "var(--janote-income)",
);

function valueOf(p: MonthPoint | undefined): number {
  if (!p) return 0;
  return activeCategory.value ? (p.byCategory[activeCategory.value.id] ?? 0) : p.total;
}

const seriesValues = computed(() => points.value.map((p) => valueOf(p)));
const chartLabels = computed(() => points.value.map((p) => `${p.month}月`));
const focusedValue = computed(() => valueOf(focusedPoint.value));

// ── 差異 ───────────────────────────────────────────────────
interface DeltaInfo {
  direction: "up" | "down" | "flat";
  amountText: string;
  percentText: string | null;
  /** 本月與上月都是 0，沒有變化可講 */
  empty: boolean;
}

function buildDelta(curr: number, prev: number): DeltaInfo {
  const diff = curr - prev;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const percentText = prev > 0 ? `${diff >= 0 ? "+" : "-"}${((Math.abs(diff) / prev) * 100).toFixed(1)}%` : null;
  return {
    direction,
    amountText: `$${Math.abs(diff).toLocaleString()}`,
    percentText,
    empty: curr === 0 && prev === 0,
  };
}

const summaryDelta = computed(() => buildDelta(focusedValue.value, valueOf(prevPoint.value)));

// ── 分類列 ─────────────────────────────────────────────────
const categoryRows = computed(() =>
  assetStore.visibleCategories.map((c) => {
    const value = focusedPoint.value?.byCategory[c.id] ?? 0;
    const prev = prevPoint.value.byCategory[c.id] ?? 0;
    return {
      id: c.id,
      name: c.name,
      color: getCategoryColor(c.name),
      value,
      delta: buildDelta(value, prev),
      selected: activeCategory.value?.id === c.id,
    };
  }),
);

// ── 年份同步到 query ───────────────────────────────────────
// 重新整理或從其他頁返回時能維持原本檢視的年份
const isInitialized = ref(false);

watch(selectedYear, (year) => {
  if (!isInitialized.value) return;
  router.replace({ query: { year: String(year) } });
});

onMounted(async () => {
  if (typeof route.query.year === "string") {
    const y = parseInt(route.query.year);
    if (!isNaN(y)) selectedYear.value = y;
  }
  await nextTick();
  isInitialized.value = true;
  await userStore.loadUser();
  await Promise.all([assetStore.loadCategories(), assetStore.loadRecords()]);
});
</script>

<style scoped>
.asset-trend-page {
  display: flex;
  flex-direction: column;
}

.year-display {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  cursor: pointer;
  user-select: none;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 100px;
}

.header-section {
  display: flex;
  align-items: center;
  padding: 13px 12px;
}

.chart-empty-text {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: var(--text-disabled);
  font-size: 14px;
}

/* 摘要 */
.trend-summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 8px 20px 4px;
  text-align: center;
}

.summary-label {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.summary-value {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.summary-delta {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: -4px;
  font-size: 14px;
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

/* 分類列表 */
.category-list {
  padding: 16px 16px 0;
}

.header-label {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.category-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  background: var(--bg-page);
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.2s ease;
}

/* 選中：用分類色做淡底與內框，不改變列高避免版面跳動 */
.category-item.selected {
  background: color-mix(in srgb, var(--cat-color) 16%, var(--bg-page));
  box-shadow: inset 0 0 0 2px var(--cat-color);
}

.category-item:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: -2px;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.category-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  flex-shrink: 0;
  margin-left: 16px;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.item-delta {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-disabled);
  font-variant-numeric: tabular-nums;
}

.item-delta.up {
  color: var(--janote-income);
}

.item-delta.down {
  color: var(--janote-expense);
}

@media (prefers-reduced-motion: reduce) {
  .category-item {
    transition: none;
  }
}
</style>
