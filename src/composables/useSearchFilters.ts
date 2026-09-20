import { ref, computed, nextTick, watch } from "vue";
import { useRouter, useRoute } from "vue-router";

export type TimeMode = "" | "monthly" | "yearly" | "custom";

export function useSearchFilters() {
  const router = useRouter();
  const route = useRoute();

  const searchQuery = ref("");
  const timeMode = ref<TimeMode>("");
  const selectedYear = ref(new Date().getFullYear());
  const selectedMonth = ref(new Date().getMonth() + 1);
  const customStartDate = ref(new Date().setHours(0, 0, 0, 0));
  const customEndDate = ref(new Date().setHours(23, 59, 59, 999));
  const selectedCategoryIds = ref<string[]>([]);

  const isInitialized = ref(false);

  const hasAnyFilter = computed(
    () =>
      searchQuery.value.trim() !== "" ||
      timeMode.value !== "" ||
      selectedCategoryIds.value.length > 0,
  );

  // 文字關鍵字不算篩選條件（不顯示篩選標記與摘要）
  const hasTimeOrCategoryFilter = computed(
    () => timeMode.value !== "" || selectedCategoryIds.value.length > 0,
  );

  const activeSummary = computed(() => {
    const parts: string[] = [];
    if (timeMode.value === "monthly") {
      parts.push(`${selectedYear.value}年${selectedMonth.value}月`);
    } else if (timeMode.value === "yearly") {
      parts.push(`${selectedYear.value}年`);
    } else if (timeMode.value === "custom") {
      const fmt = (ts: number) => {
        const d = new Date(ts);
        return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
      };
      parts.push(`${fmt(customStartDate.value)} ~ ${fmt(customEndDate.value)}`);
    }
    if (selectedCategoryIds.value.length > 0) {
      parts.push(`${selectedCategoryIds.value.length}個分類`);
    }
    return parts.join(" · ");
  });

  function matchesTime(date: Date): boolean {
    if (timeMode.value === "monthly") {
      return (
        date.getFullYear() === selectedYear.value &&
        date.getMonth() + 1 === selectedMonth.value
      );
    }
    if (timeMode.value === "yearly") {
      return date.getFullYear() === selectedYear.value;
    }
    if (timeMode.value === "custom") {
      // 端點為整天範圍（00:00 ~ 23:59:59.999），直接比 timestamp
      const ts = date.getTime();
      return ts >= customStartDate.value && ts <= customEndDate.value;
    }
    return true;
  }

  function matchesCategory(categoryId: string): boolean {
    return (
      selectedCategoryIds.value.length === 0 ||
      selectedCategoryIds.value.includes(categoryId)
    );
  }

  function matchesText(text: string): boolean {
    const query = searchQuery.value.trim().toLowerCase();
    return !query || text.toLowerCase().includes(query);
  }

  function buildUrlQuery(): Record<string, string> {
    const q: Record<string, string> = {};
    if (searchQuery.value.trim()) q.q = searchQuery.value.trim();
    if (timeMode.value) q.mode = timeMode.value;
    if (timeMode.value === "monthly" || timeMode.value === "yearly") {
      q.year = String(selectedYear.value);
      if (timeMode.value === "monthly") q.month = String(selectedMonth.value);
    }
    if (timeMode.value === "custom") {
      q.start = String(customStartDate.value);
      q.end = String(customEndDate.value);
    }
    if (selectedCategoryIds.value.length > 0) {
      q.cat = selectedCategoryIds.value.join(",");
    }
    return q;
  }

  watch(
    [
      searchQuery,
      timeMode,
      selectedYear,
      selectedMonth,
      customStartDate,
      customEndDate,
      selectedCategoryIds,
    ],
    () => {
      if (!isInitialized.value) return;
      router.replace({ query: buildUrlQuery() });
    },
    { deep: true },
  );

  async function restoreFromUrl(): Promise<void> {
    // Vue Router 已自動解碼 query 值
    const q = route.query;
    if (typeof q.q === "string") searchQuery.value = q.q;
    if (q.mode === "monthly" || q.mode === "yearly" || q.mode === "custom") {
      timeMode.value = q.mode;
    }
    if (typeof q.year === "string") {
      const y = parseInt(q.year);
      if (!isNaN(y)) selectedYear.value = y;
    }
    if (typeof q.month === "string") {
      const m = parseInt(q.month);
      if (!isNaN(m)) selectedMonth.value = m;
    }
    if (typeof q.start === "string") {
      const s = parseInt(q.start);
      if (!isNaN(s)) customStartDate.value = s;
    }
    if (typeof q.end === "string") {
      const e = parseInt(q.end);
      if (!isNaN(e)) customEndDate.value = e;
    }
    if (typeof q.cat === "string" && q.cat) {
      selectedCategoryIds.value = q.cat
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }

    // 等還原寫入完成再啟用同步，避免把還原中的中間狀態寫回網址
    await nextTick();
    isInitialized.value = true;
  }

  return {
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
  };
}
