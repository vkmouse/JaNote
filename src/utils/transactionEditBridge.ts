// TransactionEditView 與上游頁面（例如快速記帳草稿清單）之間的橋接：
// 上游導頁前註冊回呼，TransactionEditView 新增成功後呼叫，不需要知道彼此細節。
type TransactionCreatedCallback = () => void;

let onCreated: TransactionCreatedCallback | null = null;

/** 註冊「交易新增成功後」要執行的回呼（非必填） */
export function setOnTransactionCreated(cb: TransactionCreatedCallback): void {
  onCreated = cb;
}

/** 執行並清除回呼；沒有註冊過就是 no-op */
export function consumeOnTransactionCreated(): void {
  const cb = onCreated;
  onCreated = null;
  cb?.();
}

/** 捨棄尚未使用的回呼（例如使用者未存檔就離開） */
export function discardOnTransactionCreated(): void {
  onCreated = null;
}
