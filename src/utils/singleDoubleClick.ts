import { onBeforeUnmount } from "vue";

const DOUBLE_CLICK_DELAY = 250;

export function useSingleDoubleClick(
  onSingle: () => void,
  onDouble: () => void,
): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;

  // 單擊得等一個雙擊間隔才能確定不是雙擊，所以 onSingle 會延遲一個間隔
  function handleClick(): void {
    if (timer) {
      clearTimeout(timer);
      timer = null;
      onDouble();
      return;
    }
    timer = setTimeout(() => {
      timer = null;
      onSingle();
    }, DOUBLE_CLICK_DELAY);
  }

  // 等待期間元件卸載（例如切換分頁）時取消，避免事後才觸發單擊動作
  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  return handleClick;
}
