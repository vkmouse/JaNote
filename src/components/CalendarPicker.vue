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
import { computed, ref, watch } from "vue";
import { iconChevronLeft, iconChevronRight } from "../utils/icons";

interface CalendarDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  date: Date;
}

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

const calendarYearMonth = computed(() => {
  const year = calendarViewDate.value.getFullYear();
  const month = calendarViewDate.value.getMonth() + 1;
  return `${year} 年 ${month} 月`;
});

const calendarDays = computed<CalendarDay[]>(() => {
  const year = calendarViewDate.value.getFullYear();
  const month = calendarViewDate.value.getMonth();

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
});

const updateDate = (date: Date) => {
  date.setHours(0, 0, 0, 0);
  emit("update:modelValue", date.getTime());
  calendarViewDate.value = new Date(date);
};

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
  background: var(--bg-active, #e0e0e0);
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
  color: var(--text-light);
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
