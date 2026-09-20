import { ref } from "vue";

/**
 * 「滑動刪除 → 二次確認 Modal → 執行刪除」的共用流程。
 * T 是待刪除目標的識別資訊：多數情況是 id 字串；若刪除還需要額外資訊
 * （例如同時要知道刪除的是交易還是預算），可以傳入物件，例如
 * `{ type: "TRANSACTION" | "BUDGET"; id: string }`。
 *
 * onConfirm 內應包含各頁面原本在刪除前的守衛條件（例如共享檢視模式下禁止刪除），
 * 呼叫端需自行複製既有邏輯，此 composable 不預設任何守衛規則。
 */
export function useDeleteConfirm<T>(
  onConfirm: (target: T) => void | Promise<void>,
) {
  const showDeleteConfirm = ref(false);
  const pendingTarget = ref<T | null>(null);

  function requestDelete(target: T): void {
    pendingTarget.value = target;
    showDeleteConfirm.value = true;
  }

  async function confirmDelete(): Promise<void> {
    showDeleteConfirm.value = false;
    const target = pendingTarget.value;
    pendingTarget.value = null;
    if (target === null) return;
    await onConfirm(target);
  }

  function cancelDelete(): void {
    showDeleteConfirm.value = false;
    pendingTarget.value = null;
  }

  return {
    showDeleteConfirm,
    pendingTarget,
    requestDelete,
    confirmDelete,
    cancelDelete,
  };
}
