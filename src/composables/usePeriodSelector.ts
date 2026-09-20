import { ref, computed } from "vue";

export type PeriodViewMode = "monthly" | "yearly" | "custom";

/**
 * 「月/年/自訂區間」三種檢視模式共用的期間狀態、顯示文字與切換邏輯。
 * TransactionSummaryView、TransactionBudgetView 皆使用同一套規則：
 * - monthly：切換月份，跨年時進位/借位
 * - yearly：切換年份
 * - custom：由 DateRangePicker 選取起訖日期，不支援上一頁/下一頁
 *
 * 不含 URL query 同步邏輯（各頁面對應的其他篩選條件與載入時機不同，維持各自實作）。
 */
export function usePeriodSelector() {
  const viewMode = ref<PeriodViewMode>("monthly");
  const selectedYear = ref(new Date().getFullYear());
  const selectedMonth = ref(new Date().getMonth() + 1);
  const showMonthPicker = ref(false);
  const showYearPicker = ref(false);
  const showDateRangePicker = ref(false);
  const customStartDate = ref(new Date().setHours(0, 0, 0, 0));
  const customEndDate = ref(new Date().setHours(23, 59, 59, 999));

  const currentMonthDisplay = computed(() => {
    if (viewMode.value === "monthly") {
      return `${selectedYear.value}年${selectedMonth.value}月`;
    } else if (viewMode.value === "yearly") {
      return `${selectedYear.value}年`;
    } else {
      const fmt = (d: Date) =>
        `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      return `${fmt(new Date(customStartDate.value))}~${fmt(new Date(customEndDate.value))}`;
    }
  });

  function openPicker(): void {
    if (viewMode.value === "monthly") showMonthPicker.value = true;
    else if (viewMode.value === "yearly") showYearPicker.value = true;
    else showDateRangePicker.value = true;
  }

  function prevPeriod(): void {
    if (viewMode.value === "monthly") {
      if (selectedMonth.value === 1) {
        selectedMonth.value = 12;
        selectedYear.value--;
      } else {
        selectedMonth.value--;
      }
    } else if (viewMode.value === "yearly") {
      selectedYear.value--;
    }
  }

  function nextPeriod(): void {
    if (viewMode.value === "monthly") {
      if (selectedMonth.value === 12) {
        selectedMonth.value = 1;
        selectedYear.value++;
      } else {
        selectedMonth.value++;
      }
    } else if (viewMode.value === "yearly") {
      selectedYear.value++;
    }
  }

  /** 依目前的檢視模式，組出可放進路由 query 的期間參數。 */
  function buildTimeQuery(): Record<string, string> {
    const q: Record<string, string> = {};
    q.mode = viewMode.value;
    if (viewMode.value === "monthly" || viewMode.value === "yearly") {
      q.year = String(selectedYear.value);
      if (viewMode.value === "monthly") q.month = String(selectedMonth.value);
    }
    if (viewMode.value === "custom") {
      q.start = String(customStartDate.value);
      q.end = String(customEndDate.value);
    }
    return q;
  }

  return {
    viewMode,
    selectedYear,
    selectedMonth,
    showMonthPicker,
    showYearPicker,
    showDateRangePicker,
    customStartDate,
    customEndDate,
    currentMonthDisplay,
    openPicker,
    prevPeriod,
    nextPeriod,
    buildTimeQuery,
  };
}
