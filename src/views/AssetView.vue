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
      <!-- Stats Section -->
      <div class="stats-section">
        <div class="chart-section">
          <DonutChart
            :swipeable="true"
            :center-label="'總資產'"
            :center-balance="`$${totalAsset.toLocaleString()}`"
            :slices="chartSlices"
            @swipe-prev="prevMonth"
            @swipe-next="nextMonth"
          />
        </div>
        <div v-if="groupedRecords.length === 0" class="chart-empty-text">
          <p>本月暫無資產記錄</p>
        </div>
      </div>

      <!-- Daily Asset List -->
      <div class="asset-list">
        <div v-if="groupedRecords.length > 0" class="daily-groups">
          <ListGroup v-for="group in groupedRecords" :key="group.date">
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <ListItem
              v-for="record in group.records"
              :key="record.id"
              :swipeable="!isViewingShared"
              @delete="onSwipeDelete(record.id)"
              @edit="editRecord(record.id)"
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
    </div>

    <!-- 新增按鈕（BottomTabBar 的分頁與新增路徑綁定記帳，故獨立實作） -->
    <nav v-show="!drawerOpen" class="bottom-add-bar">
      <div class="inner">
        <div class="tab-spacer" />
        <div class="add-capsule">
          <button
            class="add-btn"
            :disabled="isViewingShared"
            @click="router.push('/assets/new')"
            aria-label="新增"
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>
    </nav>

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
import { ref, computed, onMounted, watch, nextTick, inject } from "vue";
import type { Ref } from "vue";
import { useRouter, useRoute } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import NavSearch from "../components/NavSearch.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import MonthPicker from "../components/MonthPicker.vue";
import DonutChart from "../components/DonutChart.vue";
import type { DonutSlice } from "../components/DonutChart.vue";
import CategoryIcon, { getCategoryColor } from "../components/CategoryIcon.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useSharedSwipeContext } from "../components/ListGroup.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import type { AssetRecord } from "../types";
import { useAssetStore, startOfDay } from "../stores/assetStore";
import { useUserStore } from "../stores/userStore";
import { groupRecordsByDate } from "../utils/groupRecordsByDate";

const router = useRouter();
const route = useRoute();
const assetStore = useAssetStore();
const userStore = useUserStore();
const drawerOpen = inject<Ref<boolean>>("sideDrawerOpen");

const selectedYear = ref(new Date().getFullYear());
const selectedMonth = ref(new Date().getMonth() + 1);
const showMonthPicker = ref(false);

function prevMonth() {
  if (selectedMonth.value === 1) {
    selectedMonth.value = 12;
    selectedYear.value--;
  } else {
    selectedMonth.value--;
  }
}

function nextMonth() {
  if (selectedMonth.value === 12) {
    selectedMonth.value = 1;
    selectedYear.value++;
  } else {
    selectedMonth.value++;
  }
}

useSharedSwipeContext();

const showDeleteConfirm = ref(false);
const deletingRecordId = ref<string | null>(null);

const currentMonthDisplay = computed(
  () => `${selectedYear.value}\u5e74${selectedMonth.value}\u6708`,
);

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

const chartSlices = computed<DonutSlice[]>(() =>
  assetStore.visibleCategories
    .map((c) => ({
      sliceLabel: c.name,
      sliceValue: snapshot.value[c.id] ?? 0,
      sliceColor: getCategoryColor(c.name),
    }))
    .sort((a, b) => b.sliceValue - a.sliceValue),
);

const groupedRecords = computed(() =>
  groupRecordsByDate(
    assetStore.visibleRecords.filter(
      (r) => r.date >= monthStart.value && r.date <= monthEnd.value,
    ),
  ),
);

const editRecord = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/assets/${id}/edit`);
};

// 點擊看同一資產的歷史紀錄，編輯改走左滑
const goToSearch = (record: AssetRecord) => {
  router.push({
    path: "/assets/search",
    query: { cat: record.category_id, q: record.name },
  });
};

const onSwipeDelete = (id: string) => {
  deletingRecordId.value = id;
  showDeleteConfirm.value = true;
};

const confirmDelete = async () => {
  showDeleteConfirm.value = false;
  const id = deletingRecordId.value;
  deletingRecordId.value = null;
  if (!id || isViewingShared.value) return;
  await assetStore.deleteRecord(id);
};

const cancelDelete = () => {
  showDeleteConfirm.value = false;
  deletingRecordId.value = null;
};

// 年月同步到 query，從新增頁返回時能維持原本檢視的月份
const isInitialized = ref(false);

watch([selectedYear, selectedMonth], () => {
  if (!isInitialized.value) return;
  router.replace({
    query: { year: String(selectedYear.value), month: String(selectedMonth.value) },
  });
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

.stats-section {
  background: var(--bg-page);
}

.chart-section {
  background: var(--bg-page);
  padding-bottom: 16px;
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

/* Add button capsule */
.bottom-add-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 1000;
  background: linear-gradient(to bottom, transparent 0%, var(--bg-page) 40%);
  padding-top: 32px;
}

.inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 0 16px calc(24px + env(safe-area-inset-bottom));
}

/* 佔位：尺寸須與 BottomTabBar 的 tab 膠囊一致，「＋」才會和記帳頁同位置 */
.tab-spacer {
  flex-shrink: 0;
  width: calc(4 * 56px + 3 * 6px + 12px);
  height: calc(46px + 12px);
}

.add-capsule {
  display: flex;
  align-items: center;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 999px;
  box-shadow:
    0 4px 16px rgba(0, 0, 0, 0.1),
    0 1px 4px rgba(0, 0, 0, 0.06);
}

.add-btn {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  border: none;
  background: var(--janote-action, #1a1a1a);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.add-btn:active {
  transform: scale(0.91);
  opacity: 0.75;
}

.add-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
  pointer-events: none;
}
</style>
