<script setup lang="ts">
import { ref, watch } from "vue";
import type { Category } from "../types";
import ViewModeToggle from "./ViewModeToggle.vue";
import CategoryGrid from "./CategoryGrid.vue";
import MonthPicker from "./MonthPicker.vue";
import YearPicker from "./YearPicker.vue";
import DateRangePicker from "./DateRangePicker.vue";

type TimeMode = "" | "monthly" | "yearly" | "custom";
type VMToggleMode = "monthly" | "yearly" | "custom";

const props = defineProps<{
  show: boolean;
  timeMode: TimeMode;
  year: number;
  month: number;
  startDate: number;
  endDate: number;
  categoryIds: string[];
  categories: Category[];
}>();

const emit = defineEmits<{
  close: [];
  "update:timeMode": [value: TimeMode];
  "update:year": [value: number];
  "update:month": [value: number];
  "update:startDate": [value: number];
  "update:endDate": [value: number];
  "update:categoryIds": [value: string[]];
}>();

// ── Draft state (only committed on Apply) ────────────────────────────────────

const draftTimeMode = ref<TimeMode>(props.timeMode);
const draftYear = ref(props.year);
const draftMonth = ref(props.month);
const draftStartDate = ref(props.startDate);
const draftEndDate = ref(props.endDate);
const draftCategoryIds = ref<string[]>([...props.categoryIds]);

// When modal opens, copy current props into draft
watch(
  () => props.show,
  (isOpen) => {
    if (isOpen) {
      draftTimeMode.value = props.timeMode;
      draftYear.value = props.year;
      draftMonth.value = props.month;
      draftStartDate.value = props.startDate;
      draftEndDate.value = props.endDate;
      draftCategoryIds.value = [...props.categoryIds];
    }
  },
);

// ── Picker visibility ────────────────────────────────────────────────────────

const showMonthPicker = ref(false);
const showYearPicker = ref(false);
const showDateRangePicker = ref(false);

// ── ViewModeToggle adaptor (cannot be "" for the toggle) ─────────────────────

function onTimeModeChange(v: VMToggleMode) {
  draftTimeMode.value = v;
}

function openPicker() {
  if (draftTimeMode.value === "monthly") showMonthPicker.value = true;
  else if (draftTimeMode.value === "yearly") showYearPicker.value = true;
  else if (draftTimeMode.value === "custom") showDateRangePicker.value = true;
}

// ── Time display string ───────────────────────────────────────────────────────

function timeSummary(): string {
  if (draftTimeMode.value === "monthly") {
    return `${draftYear.value}年${draftMonth.value}月`;
  } else if (draftTimeMode.value === "yearly") {
    return `${draftYear.value}年`;
  } else if (draftTimeMode.value === "custom") {
    const fmt = (ts: number) => {
      const d = new Date(ts);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
    };
    return `${fmt(draftStartDate.value)} ~ ${fmt(draftEndDate.value)}`;
  }
  return "";
}

// ── Apply ─────────────────────────────────────────────────────────────────────

function applyFilters() {
  emit("update:timeMode", draftTimeMode.value);
  emit("update:year", draftYear.value);
  emit("update:month", draftMonth.value);
  emit("update:startDate", draftStartDate.value);
  emit("update:endDate", draftEndDate.value);
  emit("update:categoryIds", [...draftCategoryIds.value]);
  emit("close");
}

// ── Clear all ─────────────────────────────────────────────────────────────────

function clearAll() {
  emit("update:timeMode", "");
  emit("update:year", new Date().getFullYear());
  emit("update:month", new Date().getMonth() + 1);
  emit("update:startDate", new Date().setHours(0, 0, 0, 0));
  emit("update:endDate", new Date().setHours(23, 59, 59, 999));
  emit("update:categoryIds", []);
  emit("close");
}

// ── Dismiss (discard) ─────────────────────────────────────────────────────────

function dismiss() {
  emit("close");
}
</script>

<template>
  <Transition name="modal">
    <div v-if="show" class="modal-overlay" @click.self="dismiss">
      <div class="modal-container" @click.stop>
        <div class="modal-body">
          <!-- Time section -->
          <div class="filter-section">
            <div class="section-header">
              <span class="section-title">時間</span>
              <button
                v-if="draftTimeMode !== ''"
                class="clear-link"
                @click="draftTimeMode = ''"
              >清除</button>
            </div>

            <ViewModeToggle
              :model-value="draftTimeMode === '' ? 'monthly' : draftTimeMode"
              @update:model-value="onTimeModeChange"
            />

            <button
              v-if="draftTimeMode !== ''"
              class="time-display-btn"
              @click="openPicker"
            >
              {{ timeSummary() }}
              <span class="edit-hint">點擊修改</span>
            </button>
          </div>

          <!-- Category section -->
          <div class="filter-section">
            <div class="section-header">
              <span class="section-title">分類</span>
              <button
                v-if="draftCategoryIds.length > 0"
                class="clear-link"
                @click="draftCategoryIds = []"
              >清除</button>
            </div>
            <CategoryGrid
              :categories="categories"
              :model-value="draftCategoryIds"
              :multiple="true"
              @update:model-value="(v) => (draftCategoryIds = v as string[])"
            />
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-clear-all" @click="clearAll">清除全部</button>
          <button class="btn-apply" @click="applyFilters">套用</button>
        </div>
      </div>

      <!-- Pickers rendered at modal level with higher z-index -->
      <MonthPicker
        :open="showMonthPicker"
        :year="draftYear"
        :month="draftMonth"
        @update:open="showMonthPicker = $event"
        @update:year="draftYear = $event"
        @update:month="draftMonth = $event"
      />
      <YearPicker
        :open="showYearPicker"
        :year="draftYear"
        @update:open="showYearPicker = $event"
        @update:year="draftYear = $event"
      />
      <DateRangePicker
        :open="showDateRangePicker"
        :start-date="draftStartDate"
        :end-date="draftEndDate"
        @update:open="showDateRangePicker = $event"
        @update:start-date="draftStartDate = $event"
        @update:end-date="draftEndDate = $event"
      />
    </div>
  </Transition>
</template>

<style scoped>
/* ── Modal overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  width: 85%;
  max-width: 380px;
  max-height: 85vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 0;
}

.modal-title {
  margin: 0 0 16px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

/* ── Modal body ── */
.modal-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 20px;
}

/* ── Filter sections ── */
.filter-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

/* ── Time display ── */
.time-display-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg-card, #f5f5f5);
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

/* ── Footer ── */
.modal-footer {
  display: flex;
  gap: 10px;
}

.btn-clear-all,
.btn-apply {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-clear-all {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
  border: 1px solid var(--border-primary, #e5e7eb);
}

.btn-apply {
  background: var(--text-primary);
  color: var(--text-light);
}

/* ── Picker z-index override (must render above this modal) ── */
:deep(.month-picker-overlay),
:deep(.year-picker-overlay),
:deep(.picker-overlay) {
  z-index: 1100;
}

/* ── Modal transition ── */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
