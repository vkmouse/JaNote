import { ref, computed } from "vue";

/**
 * 「年 + 月」單一月份的切換狀態，供只需要月曆導覽（無年度/自訂區間模式）的頁面使用。
 * TransactionView、AssetView 皆使用同一套邏輯：上一月/下一月會在跨年時進位/借位。
 */
export function useMonthNavigation() {
  const selectedYear = ref(new Date().getFullYear());
  const selectedMonth = ref(new Date().getMonth() + 1);
  const showMonthPicker = ref(false);

  function prevMonth(): void {
    if (selectedMonth.value === 1) {
      selectedMonth.value = 12;
      selectedYear.value--;
    } else {
      selectedMonth.value--;
    }
  }

  function nextMonth(): void {
    if (selectedMonth.value === 12) {
      selectedMonth.value = 1;
      selectedYear.value++;
    } else {
      selectedMonth.value++;
    }
  }

  const currentMonthDisplay = computed(
    () => `${selectedYear.value}年${selectedMonth.value}月`,
  );

  return {
    selectedYear,
    selectedMonth,
    showMonthPicker,
    currentMonthDisplay,
    prevMonth,
    nextMonth,
  };
}
