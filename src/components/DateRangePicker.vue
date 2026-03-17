<template>
  <div v-if="open" class="picker-overlay" @click="handleClose">
    <div class="picker-modal" @click.stop>
      <div class="picker-header">
        <h3 class="picker-title">選擇日期範圍</h3>
        <button class="close-btn" @click="handleClose">✕</button>
      </div>

      <div class="date-range-display">
        <div class="date-field" :class="{ active: selectionStep === 0 }">
          <label class="field-label">開始日期</label>
          <div class="date-value">{{ formatDate(localStartDate) }}</div>
        </div>
        <div class="date-range-arrow">→</div>
        <div class="date-field" :class="{ active: selectionStep === 1 }">
          <label class="field-label">結束日期</label>
          <div class="date-value">
            {{ localEndDate ? formatDate(localEndDate) : "—" }}
          </div>
        </div>
      </div>

      <div class="calendar-container">
        <div class="calendar-header">
          <button class="calendar-nav-btn" @click="previousMonth">
            <span v-html="iconChevronLeft" class="arrow-icon"></span>
          </button>
          <span class="calendar-title">{{ calendarYearMonth }}</span>
          <button class="calendar-nav-btn" @click="nextMonth">
            <span v-html="iconChevronRight" class="arrow-icon"></span>
          </button>
        </div>
        <div class="calendar-weekdays">
          <div v-for="day in weekdays" :key="day" class="weekday">
            {{ day }}
          </div>
        </div>
        <div class="calendar-days">
          <div
            v-for="day in calendarDays"
            :key="`${day.year}-${day.month}-${day.day}`"
            :class="[
              'calendar-day',
              {
                'other-month': !day.isCurrentMonth,
                'selected-start': isStartDate(day),
                'selected-end': isEndDate(day),
                'in-range': isInRange(day),
              },
            ]"
            @click="selectDate(day)"
          >
            {{ day.day }}
          </div>
        </div>
      </div>

      <div class="picker-actions">
        <button class="action-btn cancel-btn" @click="handleClose">取消</button>
        <button
          class="action-btn confirm-btn"
          :disabled="!localEndDate"
          @click="handleConfirm"
        >
          確認
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { iconChevronLeft, iconChevronRight } from "../utils/icons";

interface CalendarDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  date: Date;
}

interface Props {
  open: boolean;
  startDate: number;
  endDate: number;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  "update:startDate": [value: number];
  "update:endDate": [value: number];
}>();

const localStartDate = ref<Date>(new Date(props.startDate));
const localEndDate = ref<Date | null>(new Date(props.endDate));
const calendarViewDate = ref<Date>(new Date(props.startDate));
const selectionStep = ref<0 | 1>(0); // 0 = picking start, 1 = picking end

const weekdays = ["一", "二", "三", "四", "五", "六", "日"];

watch(
  () => props.open,
  (val) => {
    if (val) {
      localStartDate.value = new Date(props.startDate);
      localEndDate.value = new Date(props.endDate);
      calendarViewDate.value = new Date(props.startDate);
      selectionStep.value = 0;
    }
  },
);

const formatDate = (date: Date | null): string => {
  if (!date) return "—";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}/${month}/${day}`;
};

const calendarYearMonth = computed(() => {
  const year = calendarViewDate.value.getFullYear();
  const month = calendarViewDate.value.getMonth() + 1;
  return `${year} 年 ${month} 月`;
});

const generateCalendarDays = (viewDate: Date): CalendarDay[] => {
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  let firstDayOfWeek = firstDay.getDay();
  firstDayOfWeek = firstDayOfWeek === 0 ? 7 : firstDayOfWeek;

  const days: CalendarDay[] = [];

  const prevMonthLastDay = new Date(year, month, 0).getDate();
  for (let i = firstDayOfWeek - 2; i >= 0; i--) {
    const day = prevMonthLastDay - i;
    const prevMonth = month - 1;
    const prevYear = prevMonth < 0 ? year - 1 : year;
    const actualMonth = prevMonth < 0 ? 11 : prevMonth;
    days.push({
      day,
      month: actualMonth,
      year: prevYear,
      isCurrentMonth: false,
      date: new Date(prevYear, actualMonth, day),
    });
  }

  for (let day = 1; day <= lastDay.getDate(); day++) {
    days.push({
      day,
      month,
      year,
      isCurrentMonth: true,
      date: new Date(year, month, day),
    });
  }

  const remainingDays = 42 - days.length;
  for (let day = 1; day <= remainingDays; day++) {
    const nextMonth = month + 1;
    const nextYear = nextMonth > 11 ? year + 1 : year;
    const actualMonth = nextMonth > 11 ? 0 : nextMonth;
    days.push({
      day,
      month: actualMonth,
      year: nextYear,
      isCurrentMonth: false,
      date: new Date(nextYear, actualMonth, day),
    });
  }

  return days;
};

const calendarDays = computed(() =>
  generateCalendarDays(calendarViewDate.value),
);

const previousMonth = () => {
  const newDate = new Date(calendarViewDate.value);
  newDate.setMonth(newDate.getMonth() - 1);
  calendarViewDate.value = newDate;
};

const nextMonth = () => {
  const newDate = new Date(calendarViewDate.value);
  newDate.setMonth(newDate.getMonth() + 1);
  calendarViewDate.value = newDate;
};

const selectDate = (day: CalendarDay) => {
  const selected = new Date(day.year, day.month, day.day);

  if (selectionStep.value === 0) {
    localStartDate.value = selected;
    localEndDate.value = null;
    selectionStep.value = 1;
  } else {
    if (selected < localStartDate.value) {
      localEndDate.value = new Date(localStartDate.value);
      localStartDate.value = selected;
    } else {
      localEndDate.value = selected;
    }
    selectionStep.value = 0;
  }
};

const dayToDate = (day: CalendarDay): Date =>
  new Date(day.year, day.month, day.day);

const isStartDate = (day: CalendarDay): boolean => {
  const d = dayToDate(day);
  return d.toDateString() === localStartDate.value.toDateString();
};

const isEndDate = (day: CalendarDay): boolean => {
  if (!localEndDate.value) return false;
  const d = dayToDate(day);
  return d.toDateString() === localEndDate.value.toDateString();
};

const isInRange = (day: CalendarDay): boolean => {
  if (!localEndDate.value) return false;
  const d = dayToDate(day);
  const start = new Date(
    localStartDate.value.getFullYear(),
    localStartDate.value.getMonth(),
    localStartDate.value.getDate(),
  );
  const end = new Date(
    localEndDate.value.getFullYear(),
    localEndDate.value.getMonth(),
    localEndDate.value.getDate(),
  );
  return d > start && d < end;
};

const handleClose = () => {
  emit("update:open", false);
};

const handleConfirm = () => {
  if (!localEndDate.value) return;
  const start = new Date(localStartDate.value);
  start.setHours(0, 0, 0, 0);
  const end = new Date(localEndDate.value);
  end.setHours(23, 59, 59, 999);
  emit("update:startDate", start.getTime());
  emit("update:endDate", end.getTime());
  handleClose();
};
</script>

<style scoped>
.picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.picker-modal {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  max-width: 400px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.picker-title {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
  color: var(--text-primary);
}

.close-btn {
  background: transparent;
  border: none;
  font-size: 24px;
  color: var(--text-secondary);
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  transition: background 0.2s;
}

.date-range-display {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.date-field {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 12px;
  border-radius: 10px;
  border: 2px solid var(--border-primary);
  transition: border-color 0.2s;
}

.date-field.active {
  border-color: var(--janote-action);
}

.field-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
}

.date-value {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.date-range-arrow {
  font-size: 18px;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.calendar-container {
  padding: 16px;
  background: var(--bg-elevated);
  border-radius: 12px;
  border: 2px solid var(--border-primary);
  margin-bottom: 20px;
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  gap: 12px;
}

.calendar-nav-btn {
  background: transparent;
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  color: var(--text-primary, #333);
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-nav-btn:active {
  background: var(--bg-active, #e0e0e0);
}

.arrow-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
}

.arrow-icon :deep(svg) {
  width: 20px;
  height: 20px;
  display: block;
}

.calendar-title {
  font-size: 16px;
  font-weight: 700;
  flex: 1;
  text-align: center;
  color: var(--text-primary);
}

.calendar-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-bottom: 8px;
}

.weekday {
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  padding: 8px 0;
}

.calendar-days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.calendar-day {
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.15s;
  color: var(--text-primary);
  user-select: none;
}

.calendar-day.other-month {
  color: var(--text-disabled);
}

.calendar-day.selected-start,
.calendar-day.selected-end {
  background: var(--janote-action);
  color: var(--text-light);
  font-weight: 700;
}

.calendar-day.in-range:not(.selected-start):not(.selected-end) {
  background: var(--janote-action-light);
  color: var(--janote-action);
  border-radius: 0;
}

.picker-actions {
  display: flex;
  gap: 12px;
}

.action-btn {
  flex: 1;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.cancel-btn {
  background: #e9ecef;
  color: var(--text-primary);
}

.confirm-btn {
  background: var(--janote-action);
  color: var(--text-light);
}

.confirm-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
</style>
