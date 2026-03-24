import { ref, computed } from "vue";
import { defineStore } from "pinia";
import { useSyncStore } from "./syncStore";
import { useTransactionStore } from "./transactionStore";
import { useBudgetStore } from "./budgetStore";
import { useRecurringStore } from "./recurringStore";

export type SyncButtonStatus = "idle" | "syncing" | "success" | "error";

export const useSyncStatusStore = defineStore("syncStatus", () => {
  const status = ref<SyncButtonStatus>("idle");
  let resetTimer: ReturnType<typeof setTimeout> | null = null;

  const canSync = computed(() => status.value === "idle");

  async function triggerSync(apiBase = "/api") {
    if (!canSync.value) return;

    if (resetTimer !== null) {
      clearTimeout(resetTimer);
      resetTimer = null;
    }

    const syncStore = useSyncStore();
    status.value = "syncing";

    try {
      await syncStore.performSync(apiBase);
      status.value = "success";

      // 同步成功後重新載入所有資料 Store，確保畫面即時更新
      const transactionStore = useTransactionStore();
      const budgetStore = useBudgetStore();
      const recurringStore = useRecurringStore();
      await Promise.all([
        transactionStore.loadTransactions(),
        transactionStore.loadCategories(),
        budgetStore.loadBudgets(),
        recurringStore.loadRecurringTransactions(),
        recurringStore.loadRecurringBudgets(),
      ]);
    } catch {
      status.value = "error";
    }

    resetTimer = setTimeout(() => {
      status.value = "idle";
      resetTimer = null;
    }, 10000);
  }

  return { status, canSync, triggerSync };
});
