<template>
  <section class="assets-page">
    <!-- Top Navigation Bar -->
    <TopNavigation>
      <template #left>
        <NavMenu />
        <NavSearch to="/assets/search" />
      </template>
      <template #center>
        <div class="month-display" @click="showMonthPicker = true">
          <span>{{ currentMonthDisplay }}</span>
        </div>
      </template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <MonthPicker
      v-model:open="showMonthPicker"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
    />

    <div class="page-content page">
      <!-- 右：紀錄/明細 toggle，靠右 -->
      <div class="header-section">
        <TypeToggle
          v-model="listMode"
          left-label="紀錄"
          right-label="明細"
          left-value="records"
          right-value="holdings"
        />
      </div>

      <!-- Stats Section -->
      <div class="stats-section">
        <div class="chart-section">
          <DonutChart
            :swipeable="true"
            :selectable="true"
            :active-label="activeItem?.name ?? null"
            :center-label="activeItem ? activeItem.name : '總資產'"
            :center-balance="`$${(activeItem ? activeItem.value : totalAsset).toLocaleString()}`"
            :center-sub="activeItem ? formatPercent(activeItem.percent) : undefined"
            :slices="chartSlices"
            @slice-click="toggleCategory"
            @swipe-prev="prevMonth"
            @swipe-next="nextMonth"
          />
          <ul v-if="allocation.length > 0" class="legend" aria-label="資產分類比例">
            <li v-for="item in allocation" :key="item.id">
              <button
                type="button"
                class="legend-chip"
                :class="{
                  active: activeItem?.id === item.id,
                  dimmed: activeItem && activeItem.id !== item.id,
                }"
                :aria-label="`${item.name} ${formatPercent(item.percent)}`"
                :aria-pressed="activeItem?.id === item.id"
                :title="item.name"
                @click="toggleCategory(item.name)"
              >
                <span class="legend-dot" :style="{ backgroundColor: item.color }" />
                <span class="legend-percent">{{ formatPercent(item.percent) }}</span>
              </button>
            </li>
          </ul>
        </div>
      </div>

      <!-- Daily Asset List（紀錄模式） -->
      <div v-if="listMode === 'records'" class="asset-list">
        <div v-if="groupedRecords.length === 0" class="chart-empty-text">
          <p>{{ activeItem ? "本月此分類暫無資產記錄" : "本月暫無資產記錄" }}</p>
        </div>
        <div v-if="groupedRecords.length > 0" class="daily-groups">
          <ListGroup v-for="group in groupedRecords" :key="group.date">
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <ListItem
              v-for="record in group.records"
              :key="record.id"
              :swipeable="!isViewingShared"
              :copyable="true"
              @delete="onSwipeDelete(record.id)"
              @edit="editRecord(record.id)"
              @copy="copyRecord(record)"
              @item-click="goToSearch(record)"
            >
              <div class="asset-item" @click="isViewingShared && goToSearch(record)">
                <div class="item-left">
                  <CategoryIcon
                    :category-name="categoryName(record.category_id)"
                    color-mode="category"
                  />
                  <div class="item-text">
                    <span class="asset-name">{{ record.name }}</span>
                    <span class="asset-category">{{ categoryName(record.category_id) }}</span>
                  </div>
                </div>
                <div class="item-amount">
                  ${{ record.amount.toLocaleString() }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
      </div>

      <!-- Asset Holdings（明細模式）：依分類分組，每組標題顯示小計 -->
      <div v-else class="asset-list">
        <div v-if="holdingGroups.length === 0" class="chart-empty-text">
          <p>{{ activeItem ? "此日期該分類尚無資產明細" : "此日期尚無資產明細" }}</p>
        </div>
        <div v-else class="daily-groups">
          <ListGroup v-for="group in holdingGroups" :key="group.id">
            <template #header-left>
              <span class="date-title">{{ group.name }}</span>
            </template>
            <template #header-right>
              <span class="group-subtotal">${{ group.subtotal.toLocaleString() }}</span>
            </template>
            <ListItem v-for="record in group.records" :key="record.id">
              <div class="asset-item asset-item--link" @click="goToSearch(record)">
                <div class="item-left">
                  <CategoryIcon :category-name="group.name" color-mode="category" />
                  <div class="item-text">
                    <span class="asset-name">{{ record.name }}</span>
                    <span class="asset-category">更新於 {{ formatRecordDate(record.date) }}</span>
                  </div>
                </div>
                <div class="item-amount">
                  ${{ record.amount.toLocaleString() }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
      </div>
    </div>

    <AssetBottomBar />

    <!-- Delete Confirm Modal -->
    <ConfirmModal
      :show="showDeleteConfirm"
      title="刪除資產紀錄"
      message="確定要刪除這筆資產紀錄嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import TypeToggle from "../components/TypeToggle.vue";
import AssetBottomBar from "../components/AssetBottomBar.vue";
import CategoryIcon, { getCategoryColor } from "../components/CategoryIcon.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useSharedSwipeContext } from "../composables/useSharedSwipeContext";
import { useMonthNavigation } from "../composables/useMonthNavigation";
import { useDeleteConfirm } from "../composables/useDeleteConfirm";
import ConfirmModal from "../components/ConfirmModal.vue";
import type { AssetRecord } from "../types";
import { useAssetStore, startOfDay } from "../stores/assetStore";
import { useUserStore } from "../stores/userStore";
import { groupRecordsByDate } from "../utils/groupRecordsByDate";

const router = useRouter();
const route = useRoute();
const assetStore = useAssetStore();
const userStore = useUserStore();

const {
  selectedYear,
  selectedMonth,
  showMonthPicker,
  currentMonthDisplay,
  prevMonth,
  nextMonth,
} = useMonthNavigation();

useSharedSwipeContext();

const isViewingShared = computed(() => userStore.isViewingShared);

const monthStart = computed(() =>
  new Date(selectedYear.value, selectedMonth.value - 1, 1).getTime(),
);
const monthEnd = computed(() =>
  new Date(selectedYear.value, selectedMonth.value, 0).getTime(),
);

// 快照基準日：當月取今天，其他月份取月底
const snapshotDate = computed(() => {
  const now = new Date();
  const isCurrentMonth =
    now.getFullYear() === selectedYear.value &&
    now.getMonth() + 1 === selectedMonth.value;
  return isCurrentMonth ? startOfDay(now.getTime()) : monthEnd.value;
});

const snapshot = computed(() => assetStore.getSnapshot(snapshotDate.value));

const categoryName = (categoryId: string) =>
  assetStore.getCategoryName(categoryId);

const totalAsset = computed(() =>
  assetStore.visibleCategories.reduce(
    (sum, c) => sum + (snapshot.value[c.id] ?? 0),
    0,
  ),
);

interface AllocationItem {
  id: string;
  name: string;
  value: number;
  percent: number;
  color: string;
}

// 圖與圖例共用這份資料，順序和顏色才不會分岔。
// 百分比必須用原始金額算：DonutChart 會把過小的切片放大，圖上的角度不等於實際占比。
const allocation = computed<AllocationItem[]>(() => {
  const items = assetStore.visibleCategories
    .map((c) => ({
      id: c.id,
      name: c.name,
      value: snapshot.value[c.id] ?? 0,
      color: getCategoryColor(c.name),
    }))
    .filter((item) => item.value > 0);
  const total = items.reduce((sum, item) => sum + item.value, 0);
  return items
    .map((item) => ({ ...item, percent: (item.value / total) * 100 }))
    .sort((a, b) => b.value - a.value);
});

const chartSlices = computed<DonutSlice[]>(() =>
  allocation.value.map((item) => ({
    sliceLabel: item.name,
    sliceValue: item.value,
    sliceColor: item.color,
  })),
);

const selectedName = ref<string | null>(null);

// 換月後若所選分類已無餘額，會自然回到「總資產」，不必額外重設
const activeItem = computed(
  () =>
    allocation.value.find((item) => item.name === selectedName.value) ?? null,
);

const toggleCategory = (name: string) => {
  selectedName.value = selectedName.value === name ? null : name;
};

const formatPercent = (percent: number) =>
  percent > 0 && percent < 0.1 ? "<0.1%" : `${percent.toFixed(1)}%`;

// 紀錄：依日期列出每一筆；明細：列出每項資產的最新一筆，用來對帳總資產
type ListMode = "records" | "holdings";
const listMode = ref<ListMode>("records");

// 兩個模式共用同一個分類篩選（activeItem），選了分類就只留該分類
const groupedRecords = computed(() =>
  groupRecordsByDate(
    assetStore.visibleRecords.filter(
      (r) =>
        r.date >= monthStart.value &&
        r.date <= monthEnd.value &&
        (!activeItem.value || r.category_id === activeItem.value.id),
    ),
  ),
);

interface HoldingGroup {
  id: string;
  name: string;
  subtotal: number;
  records: AssetRecord[];
}

// 明細與上方總資產共用 getSnapshotRecords 這份資料，小計加起來就是總資產。
// 只列 visibleCategories 內的分類（與 totalAsset 的加總範圍一致）；
// 金額為 0 的資產（賣光、還清）不列，與甜甜圈圖只畫 value > 0 的行為一致。
// 分類依小計由大到小排，與圖例順序相同。
const holdingGroups = computed<HoldingGroup[]>(() => {
  const byCategory = new Map<string, AssetRecord[]>();
  for (const r of assetStore.getSnapshotRecords(snapshotDate.value)) {
    if (r.amount === 0) continue;
    const list = byCategory.get(r.category_id);
    if (list) list.push(r);
    else byCategory.set(r.category_id, [r]);
  }

  return assetStore.visibleCategories
    .filter(
      (c) =>
        byCategory.has(c.id) && (!activeItem.value || c.id === activeItem.value.id),
    )
    .map((c) => {
      const records = [...byCategory.get(c.id)!].sort(
        (a, b) => b.amount - a.amount,
      );
      return {
        id: c.id,
        name: c.name,
        subtotal: records.reduce((sum, r) => sum + r.amount, 0),
        records,
      };
    })
    .sort((a, b) => b.subtotal - a.subtotal);
});

const formatRecordDate = (ts: number) => {
  const d = new Date(ts);
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}/${m}/${day}`;
};

const editRecord = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/assets/${id}/edit`);
};

const copyRecord = (record: AssetRecord) => {
  if (isViewingShared.value) return;
  // 不帶 date，新增頁會預設為今天
  router.push({
    name: "asset-new",
    state: {
      prefill: {
        name: record.name,
        amount: record.amount,
        category_id: record.category_id,
      },
    },
  });
};

// 點擊看同一資產的歷史紀錄，編輯改走左滑
const goToSearch = (record: AssetRecord) => {
  router.push({
    path: "/assets/search",
    query: { cat: record.category_id, q: record.name },
  });
};

const {
  showDeleteConfirm,
  requestDelete: onSwipeDelete,
  confirmDelete,
  cancelDelete,
} = useDeleteConfirm<string>(async (id) => {
  if (isViewingShared.value) return;
  await assetStore.deleteRecord(id);
});

// 年月與列表模式同步到 query，從新增頁或歷史頁返回時能維持原本的檢視
const isInitialized = ref(false);

watch([selectedYear, selectedMonth, listMode], () => {
  if (!isInitialized.value) return;
  const query: Record<string, string> = {
    year: String(selectedYear.value),
    month: String(selectedMonth.value),
  };
  if (listMode.value === "holdings") query.mode = "holdings";
  router.replace({ query });
});

onMounted(async () => {
  await userStore.loadUser();
  await Promise.all([assetStore.loadCategories(), assetStore.loadRecords()]);
  const q = route.query;
  if (typeof q.year === "string") {
    const y = parseInt(q.year);
    if (!isNaN(y)) selectedYear.value = y;
  }
  if (typeof q.month === "string") {
    const m = parseInt(q.month);
    if (!isNaN(m)) selectedMonth.value = m;
  }
  if (q.mode === "holdings") listMode.value = "holdings";
  await nextTick();
  isInitialized.value = true;
});
</script>

<style scoped>
.assets-page {
  display: flex;
  flex-direction: column;
}

.month-display {
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

/* 紀錄/明細 toggle：靠右，與分類總覽頁的支出/收入切換相同位置 */
.header-section {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding: 13px 12px;
}

.stats-section {
  background: var(--bg-page);
}

.chart-section {
  background: var(--bg-page);
  padding-bottom: 16px;
}

/* 分類圖例：只有色點與百分比。不換行、每顆等寬並隨螢幕縮小，手機上固定同一排 */
.legend {
  display: flex;
  flex-wrap: nowrap;
  justify-content: center;
  gap: 4px;
  margin: 0;
  padding: 0 12px;
  list-style: none;
}

.legend > li {
  flex: 1 1 0;
  min-width: 0;
  max-width: 76px;
}

.legend-chip {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  width: 100%;
  min-height: 36px;
  padding: 0;
  border: 1.5px solid var(--border);
  border-radius: 999px;
  background: var(--bg-page);
  color: var(--text-primary);
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition:
    opacity 0.2s ease,
    background-color 0.2s ease,
    border-color 0.2s ease;
}

.legend-chip:focus-visible {
  outline: 2px solid var(--text-primary);
  outline-offset: 2px;
}

.legend-chip.active {
  border-color: var(--text-primary);
  background: var(--bg-hover);
}

.legend-chip.dimmed {
  opacity: 0.45;
}

.legend-dot {
  flex-shrink: 0;
  width: 10px;
  height: 10px;
  border: 1px solid var(--chart-stroke);
  border-radius: 50%;
}

.legend-percent {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--text-secondary);
}

.legend-chip.active .legend-percent {
  color: var(--text-primary);
}

@media (prefers-reduced-motion: reduce) {
  .legend-chip {
    transition: none;
  }
}

.chart-empty-text {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px 0 8px;
  color: var(--text-disabled);
  font-size: 14px;
}

/* Asset List */
.asset-list {
  padding: 0 16px;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.date-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

/* 明細模式：分類小計，放在組標題右側 */
.group-subtotal {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
}

/* 明細列可點擊跳到歷史紀錄 */
.asset-item--link {
  cursor: pointer;
}

.asset-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  background: var(--bg-page);
  gap: 8px;
}

.item-left {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.item-text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.asset-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.asset-category {
  font-size: 12px;
  color: var(--text-secondary);
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--text-primary);
}
</style>
