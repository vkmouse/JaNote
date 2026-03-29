<script setup lang="ts">
import { ref, computed, watch } from "vue";
import type { Category } from "../types";
import ViewModeToggle from "./ViewModeToggle.vue";
import CategoryGrid from "./CategoryGrid.vue";
import MonthPicker from "./MonthPicker.vue";
import YearPicker from "./YearPicker.vue";
import DateRangePicker from "./DateRangePicker.vue";
import { iconChevronLeft } from "../utils/icons";

type TimeMode = "" | "monthly" | "yearly" | "custom";

const props = defineProps<{
  timeMode: TimeMode;
  year: number;
  month: number;
  startDate: number;
  endDate: number;
  categoryIds: string[];
  categories: Category[];
}>();

const emit = defineEmits<{
  "update:timeMode": [value: TimeMode];
  "update:year": [value: number];
  "update:month": [value: number];
  "update:startDate": [value: number];
  "update:endDate": [value: number];
  "update:categoryIds": [value: string[]];
}>();

// ── Expand / collapse ────────────────────────────────────────────────────────

const isExpanded = ref(false);

// Auto-expand when filter values are present (e.g. from URL)
watch(
  () => [props.timeMode, props.categoryIds.length] as const,
  ([mode, catLen]) => {
    if (mode !== "" || catLen > 0) {
      isExpanded.value = true;
    }
  },
  { immediate: true },
);

// ── Picker modals ────────────────────────────────────────────────────────────

const showMonthPicker = ref(false);
const showYearPicker = ref(false);
const showDateRangePicker = ref(false);

// ── Writable computed proxies (for v-model on pickers) ───────────────────────

const proxyYear = computed({
  get: () => props.year,
  set: (v) => emit("update:year", v),
});

const proxyMonth = computed({
  get: () => props.month,
  set: (v) => emit("update:month", v),
});

const proxyStartDate = computed({
  get: () => props.startDate,
  set: (v) => emit("update:startDate", v),
});

const proxyEndDate = computed({
  get: () => props.endDate,
  set: (v) => emit("update:endDate", v),
});

// ── Time mode toggle adaptor (ViewModeToggle uses "monthly"|"yearly"|"custom") ─

type VMToggleMode = "monthly" | "yearly" | "custom";

const timeModeForToggle = computed<VMToggleMode>({
  get: () => (props.timeMode === "" ? "monthly" : props.timeMode),
  set: (v: VMToggleMode) => emit("update:timeMode", v),
});

function activateTimeMode(mode: VMToggleMode) {
  emit("update:timeMode", mode);
}

// ── Open picker for current time mode ────────────────────────────────────────

function openPicker() {
  if (props.timeMode === "monthly") showMonthPicker.value = true;
  else if (props.timeMode === "yearly") showYearPicker.value = true;
  else if (props.timeMode === "custom") showDateRangePicker.value = true;
}

// ── Time display string ───────────────────────────────────────────────────────

const timeSummary = computed(() => {
  if (props.timeMode === "monthly") {
    return `${props.year}年${props.month}月`;
  } else if (props.timeMode === "yearly") {
    return `${props.year}年`;
  } else if (props.timeMode === "custom") {
    const fmt = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    };
    return `${fmt(props.startDate)} ~ ${fmt(props.endDate)}`;
  }
  return "";
});

// ── Header active summary ─────────────────────────────────────────────────────

const activeSummary = computed(() => {
  const parts: string[] = [];
  if (props.timeMode !== "") parts.push(timeSummary.value);
  if (props.categoryIds.length > 0) parts.push(`${props.categoryIds.length}個分類`);
  return parts.join(" · ");
});

const hasActiveFilter = computed(
  () => props.timeMode !== "" || props.categoryIds.length > 0,
);

// ── Clear helpers ─────────────────────────────────────────────────────────────

function clearTime() {
  emit("update:timeMode", "");
}

function clearCategories() {
  emit("update:categoryIds", []);
}

// ── CategoryGrid proxy ────────────────────────────────────────────────────────

const proxyCategoryIds = computed({
  get: () => props.categoryIds,
  set: (v: string[]) => emit("update:categoryIds", v),
});
</script>

<template>
  <div class="filter-panel" :class="{ expanded: isExpanded }">
    <!-- Header / toggle -->
    <button class="filter-header" @click="isExpanded = !isExpanded">
      <span class="filter-label">
        篩選
        <span v-if="hasActiveFilter" class="active-badge">{{ activeSummary }}</span>
      </span>
      <span
        class="chevron-icon"
        v-html="iconChevronLeft"
        :class="{ 'chevron-down': isExpanded }"
      />
    </button>

    <!-- Body -->
    <div v-show="isExpanded" class="filter-body">
      <!-- Time section -->
      <div class="filter-section">
        <div class="section-header">
          <span class="section-title">時間</span>
          <button v-if="timeMode !== ''" class="clear-link" @click="clearTime">清除</button>
        </div>

        <!-- Mode buttons -->
        <div class="time-mode-row">
          <button
            :class="['mode-btn', { active: timeMode === 'monthly' }]"
            @click="activateTimeMode('monthly')"
          >月</button>
          <button
            :class="['mode-btn', { active: timeMode === 'yearly' }]"
            @click="activateTimeMode('yearly')"
          >年</button>
          <button
            :class="['mode-btn', { active: timeMode === 'custom' }]"
            @click="activateTimeMode('custom')"
          >自訂</button>
        </div>

        <!-- Selected time display — tap to open picker -->
        <button v-if="timeMode !== ''" class="time-display-btn" @click="openPicker">
          {{ timeSummary }}
          <span class="edit-hint">點擊修改</span>
        </button>
      </div>

      <!-- Category section -->
      <div class="filter-section">
        <div class="section-header">
          <span class="section-title">分類</span>
          <button v-if="categoryIds.length > 0" class="clear-link" @click="clearCategories">清除</button>
        </div>
        <CategoryGrid
          :categories="categories"
          :model-value="proxyCategoryIds"
          :multiple="true"
          @update:model-value="(v) => emit('update:categoryIds', v as string[])"
        />
      </div>
    </div>

    <!-- Pickers -->
    <MonthPicker
      :open="showMonthPicker"
      :year="proxyYear"
      :month="proxyMonth"
      @update:open="showMonthPicker = $event"
      @update:year="emit('update:year', $event)"
      @update:month="emit('update:month', $event)"
    />
    <YearPicker
      :open="showYearPicker"
      :year="proxyYear"
      @update:open="showYearPicker = $event"
      @update:year="emit('update:year', $event)"
    />
    <DateRangePicker
      :open="showDateRangePicker"
      :start-date="proxyStartDate"
      :end-date="proxyEndDate"
      @update:open="showDateRangePicker = $event"
      @update:start-date="emit('update:startDate', $event)"
      @update:end-date="emit('update:endDate', $event)"
    />
  </div>
</template>

<style scoped>
.filter-panel {
  border: 1.5px solid var(--border-primary);
  border-radius: 14px;
  background: var(--bg-card, #f9f9f9);
  overflow: hidden;
  transition: border-color 0.15s;
}

.filter-panel.expanded {
  border-color: var(--text-primary);
}

/* ── Header ── */
.filter-header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 14px;
  background: transparent;
  border: none;
  cursor: pointer;
  gap: 8px;
  -webkit-tap-highlight-color: transparent;
}

.filter-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  text-align: left;
}

.active-badge {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary, #666);
  background: var(--bg-page);
  border: 1px solid var(--border-primary);
  border-radius: 20px;
  padding: 1px 8px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
}

.chevron-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  color: var(--text-secondary, #666);
  transform: rotate(-90deg);
  transition: transform 0.2s ease;
  flex-shrink: 0;
}

.chevron-icon :deep(svg) {
  width: 100%;
  height: 100%;
}

.chevron-down {
  transform: rotate(90deg);
}

/* ── Body ── */
.filter-body {
  padding: 0 14px 14px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  border-top: 1px solid var(--border-primary);
}

/* ── Section ── */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 12px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.clear-link {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 12px;
  color: var(--text-secondary, #888);
  padding: 0;
  text-decoration: underline;
}

/* ── Time mode buttons ── */
.time-mode-row {
  display: flex;
  gap: 6px;
}

.mode-btn {
  padding: 5px 16px;
  border: 1.5px solid var(--border-primary);
  border-radius: 20px;
  background: transparent;
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.mode-btn.active {
  background: var(--text-primary);
  color: var(--text-light, #fff);
  border-color: var(--text-primary);
}

/* ── Time display ── */
.time-display-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-page);
  border: 1.5px solid var(--border-primary);
  border-radius: 10px;
  padding: 8px 12px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  width: 100%;
  text-align: left;
}

.edit-hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-disabled);
  margin-left: auto;
}
</style>
