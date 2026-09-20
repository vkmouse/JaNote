<template>
  <div
    v-if="open"
    class="calendar-overlay"
    @click="$emit('update:open', false)"
  >
    <div class="calendar-modal" @click.stop>
      <div class="calendar-header">
        <button class="calendar-nav-btn" @click="previousMonth">
          <span v-html="iconChevronLeft" class="arrow-icon"></span>
        </button>
        <span class="calendar-title">{{ calendarYearMonth }}</span>
        <button class="calendar-nav-btn" @click="nextMonth">
          <span v-html="iconChevronRight" class="arrow-icon"></span>
        </button>
        <button class="today-btn" @click="selectToday">今日</button>
      </div>
      <div class="calendar-weekdays">
        <div v-for="day in weekdays" :key="day" class="weekday">{{ day }}</div>
      </div>
      <div class="calendar-days">
        <div
          v-for="day in calendarDays"
          :key="`${day.year}-${day.month}-${day.day}`"
          :class="[
            'calendar-day',
            {
              'other-month': !day.isCurrentMonth,
              selected: isSelectedDate(day),
              today: isToday(day),
            },
          ]"
          @click="selectDate(day)"
        >
          {{ day.day }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { iconChevronLeft, iconChevronRight } from "../utils/icons";
import { useMonthGrid, type CalendarDay } from "../composables/useMonthGrid";

const props = defineProps<{ open: boolean; modelValue: number }>();
const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "update:modelValue", value: number): void;
}>();

const calendarViewDate = ref(new Date(props.modelValue));
const weekdays = ["週一", "週二", "週三", "週四", "週五", "週六", "週日"];

watch(
  () => props.modelValue,
  (value) => {
    if (!Number.isNaN(value)) {
      calendarViewDate.value = new Date(value);
    }
  },
);

const { calendarYearMonth, calendarDays, previousMonth, nextMonth } =
  useMonthGrid(calendarViewDate);

const updateDate = (date: Date) => {
  date.setHours(0, 0, 0, 0);
  emit("update:modelValue", date.getTime());
  calendarViewDate.value = new Date(date);
};

const selectToday = () => {
  updateDate(new Date());
  emit("update:open", false);
};

const selectDate = (day: CalendarDay) => {
  const selected = new Date(day.year, day.month, day.day);
  updateDate(selected);
  emit("update:open", false);
};

const isSelectedDate = (day: CalendarDay): boolean => {
  const selected = new Date(props.modelValue);
  return (
    day.day === selected.getDate() &&
    day.month === selected.getMonth() &&
    day.year === selected.getFullYear()
  );
};

const isToday = (day: CalendarDay): boolean => {
  const today = new Date();
  return (
    day.day === today.getDate() &&
    day.month === today.getMonth() &&
    day.year === today.getFullYear()
  );
};
</script>

<style scoped>
.calendar-overlay {
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

.calendar-modal {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 20px;
  max-width: 400px;
  width: 90%;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  gap: 12px;
}

.calendar-nav-btn {
  background: transparent;
  border: none;
  border-radius: 8px;
  width: 36px;
  height: 36px;
  cursor: pointer;
  transition: background-color 0.2s;
  color: var(--text-primary, #333);
  display: flex;
  align-items: center;
  justify-content: center;
}

.calendar-nav-btn:active {
  background: var(--bg-active);
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
}

.today-btn {
  background: var(--text-primary);
  color: var(--bg-page);
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s;
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
  transition: all 0.2s;
}

.calendar-day.other-month {
  color: var(--text-disabled);
}

.calendar-day.today {
  background: var(--janote-action-light);
  color: var(--janote-action);
  font-weight: 700;
}

.calendar-day.selected {
  background: var(--janote-action);
  color: var(--text-light);
  font-weight: 700;
}
</style>
