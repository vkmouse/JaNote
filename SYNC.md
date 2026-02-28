# JaNote 同步功能技術文件

## 1. 概要流程 (High-level Overview)

JaNote 採用 **離線優先 (Offline-first)** 架構，確保使用者在沒有網路的情況下仍能正常記帳，並在恢復連線時自動同步資料。核心原則是 **「伺服器狀態為最終真理 (Server as the Source of Truth)」**。

1.  **變更捕獲 (Capture)**：當使用者在離線或在線狀態下新增、修改、刪除資料時，變更會先存入本地資料庫的「同步佇列 (Sync Queue)」。
2.  **同步發起 (Initiate)**：透過 `performSync` 函式將本地變更包裹為 `PushCommand` 發送至伺服器，並同時帶上 `last_cursor`（上一次同步的進度標記）。
3.  **衝突處理 (Conflict Resolution)**：伺服器根據版本號 (Base Version) 判斷是否接受變更。若伺服器已有更新的版本，則跳過該變更。
4.  **狀態更新 (State Update)**：客戶端先套用伺服器傳回的新變更 (Pull Events)，再根據推播結果更新本地資料的版本號或執行還原 (Rollback)。

---

## 2. 詳細流程說明 (Detailed Process)

### A. 前端：資料變更階段 (Local Mutation)
當 UI 層發起資料變更（如 `transactionService.create`）時：
1.  **寫入實體表**：立即更新本地實體資料庫（如 `transactions` 表），確保使用者介面立即反應。
2.  **寫入佇列**：在 `sync_queue` 中新增一筆記錄，包含：
    *   `mutation_id`: 全球唯一標識符 (UUID)。
    *   `entity_type`: 實體類型 (CAT/TXN/SHR)。
    *   `action`: 動作 (POST/PUT/DELETE)。
    *   `snapshot_before`: **修改前的完整資料快照**（用於失敗時還原）。
    *   `base_version`: 修改前該實體的版本號。

### B. 前端：同步執行階段 (Perform Sync)
執行 `syncService.performSync`：
1.  **讀取進度**：從 `sync_meta` 取得 `last_cursor`（數字，代表伺服器事件 ID）。
2.  **封裝請求**：將 `sync_queue` 中所有待處理變更轉為 `push_commands`。
3.  **發送請求**：POST `/api/sync`，攜帶 `push_commands` 與 `last_cursor`。

### C. 後端：處理請求階段 (Server Processing)
後端 `functions/api/sync.ts` 接收到請求後：
1.  **身份驗證**：檢查使用者 Token 與請求中的 `user_id` 是否匹配。
2.  **處理 Push (階段一)**：
    *   **排序**：依照 `CAT > TXN > SHR` 順序處理，確保外鍵關聯正確。
    *   **冪等性檢查**：檢查 `mutation_id` 是否已處理過，避免重複操作。
    *   **衝突檢查**：比對 `base_version`。
        *   若 `base_version < current_version`：表示客戶端基於舊版本修改，但伺服器已有新版，回傳 `SKIPPED`。
        *   若檢查通過：執行資料庫更新，版本號 +1，並寫入一筆 `sync_events`（同步事件）。
3.  **處理 Pull (階段二)**：
    *   **計算範圍**：找出該使用者自 `last_cursor` 以降的所有 `sync_events`（包含自己產生的與他人分享給自己的）。
    *   **排除重複**：過濾掉本次請求剛剛產生的 `mutation_id`，避免回傳重複資料給發起者。
4.  **回傳結果**：包含 `push_results`（每一筆 push 的狀態）、`pull_events`（伺服器端的新變更）以及 `new_cursor`。

### D. 前端：回應套用階段 (Apply Response)
1.  **優先套用 Pull**：遍歷 `pull_events`。
    *   **強制覆蓋**：伺服器的資料直接寫入本地實體表。
    *   **佇列清理**：若本地佇列中有相同 `entity_id` 的待推播變更，直接刪除該佇列項目（因為伺服器已有最新版，本地舊動作已失效）。
2.  **處理 Push 結果**：
    *   `OK`: 更新本地實體的 `version` 為伺服器核發的新版本。
    *   `SKIPPED`: 直接從佇列移除（已在 Pull 階段被覆蓋）。
    *   `ERROR`: 執行 **Rollback**。利用 `snapshot_before` 將本地實體還原到修改前的狀態，並移除該佇列項目。
3.  **存檔進度**：將 `new_cursor` 存入 `sync_meta`。

---

## 3. 核心技術機制

| 機制名稱 | 說明 |
| :--- | :--- |
| **Mutation ID** | 確保每一筆操作的「唯一性」，用於實作 API 的冪等性 (Idempotency)，防止重複扣款或重複新增。 |
| **Cursor (游標)** | 伺服器端 `sync_events` 表的自動遞增 ID。客戶端紀錄此 ID 即可精準拉取「增量更新」，而非全量下載。 |
| **Optimistic Locking** | 伺服器檢查 `base_version`。若版本不對則不執行更新，保護資料一致性。 |
| **Snapshot Rollback** | 離線優先架構中，前端會先假定操作成功。若同步時被伺服器拒絕，前端能根據快照精確回滾。 |
| **Dependency Sorting** | 確保同步時「分類」永遠先於「交易」被處理，防止資料庫外鍵約束報錯。 |

## 4. 資料模型關聯

*   **實體資料 (Entities)**: `categories`, `transactions`, `user_shares` (均包含 `version` 欄位)。
*   **同步佇列 (Sync Queue)**: 本地暫存的所有待上傳變更。
*   **同步事件 (Sync Events)**: 伺服器端的全域流水帳，紀錄了「誰在什麼時候改了什麼實體」。
*   **同步元資料 (Sync Meta)**: 紀錄 `last_cursor` 與登入狀態。
