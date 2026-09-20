import { computed, type Ref } from "vue";

export interface CalendarDay {
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  date: Date;
}

/**
 * Given a ref holding the currently-viewed month (any Date within that
 * month), produces the standard 6-week (42-cell) calendar grid — including
 * the leading/trailing days from the previous/next month — plus month
 * navigation helpers. Shared by CalendarPicker and DateRangePicker so both
 * stay in sync.
 */
export function useMonthGrid(viewDate: Ref<Date>) {
  const calendarYearMonth = computed(() => {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth() + 1;
    return `${year} 年 ${month} 月`;
  });

  const calendarDays = computed<CalendarDay[]>(() => {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();

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

  const previousMonth = () => {
    const newDate = new Date(viewDate.value);
    newDate.setMonth(newDate.getMonth() - 1);
    viewDate.value = newDate;
  };

  const nextMonth = () => {
    const newDate = new Date(viewDate.value);
    newDate.setMonth(newDate.getMonth() + 1);
    viewDate.value = newDate;
  };

  return { calendarYearMonth, calendarDays, previousMonth, nextMonth };
}
