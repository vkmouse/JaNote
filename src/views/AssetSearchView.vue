<template>
  <section class="search-page">
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #right><NavSync /><NavAvatar /></template>
    </TopNavigation>

    <div class="page-content page">
      <div class="search-section">
        <div class="search-bar">
          <span class="search-icon" v-html="iconSearch" />
          <input
            ref="inputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜尋資產名稱"
            autocomplete="off"
          />
          <button
            class="clear-btn"
            :class="{ invisible: !searchQuery }"
            @click="clearSearch"
            aria-label="清除搜尋"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
            >
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
          <button
            class="funnel-btn"
            @click="showFilterModal = true"
            aria-label="篩選"
          >
            <span class="funnel-icon" v-html="iconFunnel" />
            <span v-if="hasTimeOrCategoryFilter" class="filter-dot" />
          </button>
        </div>

        <div v-if="hasTimeOrCategoryFilter" class="filter-summary">
          {{ activeSummary }}
        </div>
      </div>

      <div class="search-results">
        <div v-if="!hasAnyFilter" class="empty-state">
          <p>輸入關鍵字或設定篩選條件</p>
        </div>

        <div v-else-if="groupedResults.length === 0" class="empty-state">
          <p>找不到符合條件的資產紀錄</p>
        </div>

        <div v-else class="daily-groups">
          <ListGroup v-for="group in groupedResults" :key="group.date">
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <ListItem
              v-for="record in group.records"
              :key="record.id"
              :swipeable="!isViewingShared"
              @delete="onSwipeDelete(record.id)"
              @edit="editRecord(record.id)"
            >
              <div class="asset-item">
                <div class="item-left">
                  <CategoryIcon
                    :category-name="categoryName(record.category_id)"
                    color-mode="category"
                  />
                  <div class="item-text">
                    <span class="asset-name">
                      <span
                        v-for="(part, i) in highlightMatch(record.name, searchQuery)"
                        :key="i"
                        :class="{ highlight: part.match }"
                        >{{ part.text }}</span
                      >
                    </span>
                    <span class="asset-category">{{
                      categoryName(record.category_id)
                    }}</span>
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

    <SearchFilterPanel
      :show="showFilterModal"
      v-model:timeMode="timeMode"
      v-model:year="selectedYear"
      v-model:month="selectedMonth"
      v-model:startDate="customStartDate"
      v-model:endDate="customEndDate"
      v-model:categoryIds="selectedCategoryIds"
      :categories="assetStore.visibleCategories"
      @close="showFilterModal = false"
    />

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
import { ref, computed, onMounted, nextTick } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import NavSync from "../components/NavSync.vue";
import NavAvatar from "../components/NavAvatar.vue";
import CategoryIcon from "../components/CategoryIcon.vue";
import ListGroup from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useUserStore } from "../stores/userStore";
import { useAssetStore } from "../stores/assetStore";
import ConfirmModal from "../components/ConfirmModal.vue";
import { useSharedSwipeContext } from "../components/ListGroup.vue";
import SearchFilterPanel from "../components/SearchFilterPanel.vue";
import { iconFunnel, iconSearch } from "../utils/icons";
import { useSearchFilters, highlightMatch } from "../utils/searchFilters";
import { groupRecordsByDate } from "../utils/groupRecordsByDate";

const router = useRouter();
const userStore = useUserStore();
const assetStore = useAssetStore();

useSharedSwipeContext();

const {
  searchQuery,
  timeMode,
  selectedYear,
  selectedMonth,
  customStartDate,
  customEndDate,
  selectedCategoryIds,
  hasAnyFilter,
  hasTimeOrCategoryFilter,
  activeSummary,
  matchesTime,
  matchesCategory,
  matchesText,
  restoreFromUrl,
} = useSearchFilters();

const inputRef = ref<HTMLInputElement | null>(null);
const showFilterModal = ref(false);
const showDeleteConfirm = ref(false);
const deletingRecordId = ref<string | null>(null);

const isViewingShared = computed(() => userStore.isViewingShared);

const categoryName = (categoryId: string) =>
  assetStore.getCategoryName(categoryId);

const searchResults = computed(() => {
  if (!hasAnyFilter.value) return [];

  return assetStore.visibleRecords.filter(
    (r) =>
      matchesTime(new Date(r.date)) &&
      matchesCategory(r.category_id) &&
      matchesText(r.name),
  );
});

const groupedResults = computed(() => groupRecordsByDate(searchResults.value));

const clearSearch = () => {
  searchQuery.value = "";
  nextTick(() => inputRef.value?.focus());
};

const editRecord = (id: string) => {
  if (isViewingShared.value) return;
  router.push(`/assets/${id}/edit`);
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

onMounted(async () => {
  await userStore.loadUser();
  inputRef.value?.focus();
  await restoreFromUrl();
  await Promise.all([assetStore.loadRecords(), assetStore.loadCategories()]);
});
</script>

<style scoped>
.search-page {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  padding-bottom: 24px;
  overflow-y: auto;
}

.search-section {
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.search-bar {
  height: 39px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  background: var(--bg-card);
  border: 2px solid var(--border-primary);
  border-radius: 20px;
  transition: border-color 0.15s;
}

.search-bar:focus-within {
  border-color: var(--text-primary, #333);
}

.search-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.search-icon :deep(svg) {
  width: 24px;
  height: 24px;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 16px;
  color: var(--text-primary);
  outline: none;
  font-family: inherit;
  min-width: 0;
}

.search-input::placeholder {
  color: var(--text-disabled);
}

.clear-btn {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--text-disabled, #bbb);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  padding: 0;
  transition: background 0.15s;
}

.clear-btn.invisible {
  visibility: hidden;
  pointer-events: none;
}

.funnel-btn {
  position: relative;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  color: var(--text-secondary);
  -webkit-tap-highlight-color: transparent;
}

.funnel-icon {
  display: flex;
  align-items: center;
  justify-content: center;
}

.funnel-icon :deep(svg) {
  width: 24px;
  height: 24px;
  stroke: currentColor;
}

.filter-dot {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 8px;
  height: 8px;
  background: var(--state-danger);
  border-radius: 50%;
  border: 1.5px solid var(--bg-card);
}

.filter-summary {
  font-size: 12px;
  color: var(--text-secondary, #888);
  padding: 0 4px;
}

.search-results {
  padding: 0 16px;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 260px;
  color: var(--text-disabled);
  font-size: 14px;
}

.daily-groups {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding-top: 4px;
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

.highlight {
  background: rgba(255, 200, 0, 0.4);
  border-radius: 2px;
}

.item-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
  color: var(--text-primary);
}
</style>
