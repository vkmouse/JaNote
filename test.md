api 的 sync_events 紀錄的是事實
ui 的 sync_queue 紀錄的是行為

ui 寫入 建立行為
ui 寫入 取消邀請行為
ui 同步
api 處理 發送邀請行為失敗 不寫入事實
api 處理 取消邀請行為成功 寫入事實


以下是我想法，請提供我一些建議


2. sync 回應的 pull_events 就是事實

4. sync 回應新增 push_results，他應該包含甚麼內容？


version 0 不該出現在 pull_events
viewer_id 是空的


幫我把前後端呼叫 sync api 修改
1. sync 請求的 push_events 改為 push_commands
2. sync 回應的 processed_mutation_ids 移除
3. sync 回應新增 push_results，內容如下，然後會改用狀態處理 ，狀態 ok 會用 result.version bump，skipped/delete 不會傳 version 也不用 bump

interface PushResult {
  mutation_id: string
  status: 'OK' | 'ERROR' | 'SKIPPED'
  version?: number | null
  error_code?: string | null
  error_message?: string | null
}

| 情境 | status | 理由 |
|---|---|---|
| DELETE，entity 存在，成功刪除 | ok | server 執行了刪除 |
| DELETE，entity 不存在 | skipped | 目標達成，但 server 沒有動作 |
| POST，entity 已存在 | error | 目標未達成，你想建立但它已經在了 |
| PUT，version 落後 | skipped | server 已有更新的版本，你的變更被忽略 |
| POST，viewer 不存在 | error | 目標未達成，server 拒絕執行 |




# Sync API 設計文件

## 概覽

這是一個 **offline-first** 的同步協議，前端可以在離線狀態下累積操作，連線後一次性同步。
設計上分離「意圖（Command）」和「事實（Event）」，確保部分失敗不影響其他操作。

```
前端                          後端
  │                             │
  │── POST /api/sync ──────────>│
  │   push_commands: [...]      │  逐一處理每個 command
  │   last_cursor: N            │  查詢新的 pull events
  │                             │
  │<── response ────────────────│
      push_results: [...]       │  每個 command 的處理結果
      pull_events: [...]        │  server 確認的事實狀態
      new_cursor: M             │
```

---

## API 介面定義

### Request

```typescript
interface SyncRequest {
  last_cursor: number           // 上次同步的 cursor，初次為 0
  push_commands?: PushCommand[] // 要推送的操作，無則省略
  user?: { id: string; email: string } | null
}

interface PushCommand {
  mutation_id: string   // client 產生的 UUID，用於 idempotency
  entity_type: 'CAT' | 'TXN' | 'SHR'
  entity_id: string     // client 產生的 UUID
  action: 'POST' | 'PUT' | 'DELETE'
  base_version: number  // 操作前的 entity version，POST 為 0
  payload?: unknown     // POST/PUT 的資料內容，DELETE 可省略
}
```

### Response

```typescript
interface SyncResponse {
  new_cursor: number      // 下次同步用的 cursor
  push_results: PushResult[]
  pull_events: PullEvent[]
  user: { id: string; email: string }
}

interface PushResult {
  mutation_id: string
  status: 'ok' | 'error' | 'skipped'
  error?: {
    code: string    // 機器可讀，前端用來決定處理方式
    message: string // 人類可讀，可直接顯示給使用者
  }
  // 注意：不含 version，前端從 pull_events 取得最新狀態
}

interface PullEvent {
  id: number
  mutation_id: string
  entity_type: 'CAT' | 'TXN' | 'SHR'
  entity_id: string
  action: 'PUT' | 'DELETE'
  version: number   // 永遠 >= 1，version 0 不該出現在 pull_events
  payload: string | null
}
```

### PushResult status 語意

| status | 意義 | 前端行為 |
|--------|------|----------|
| `OK` | server 執行了操作，狀態改變 | 從 queue 移除，bump version（若無 pull_event）|
| `SKIPPED` | 目標已達成，server 沒有動作 | 從 queue 移除，不更新狀態 |
| `ERROR` | server 拒絕，目標未達成 | rollback，視 error.code 決定是否提示使用者 |

**SKIPPED 的情境：**
- DELETE 一個不存在的 entity → 目標本來就達成了
- PUT 的 base_version 落後 server → server 有更新的版本，以 pull_event 為準

### Error Code 對照

| code | 情境 | 前端建議處理 |
|------|------|-------------|
| `VIEWER_NOT_FOUND` | 邀請的 email 不存在 | 靜默 rollback，顯示「找不到此使用者」|
| `ALREADY_EXISTS` | POST 一個已存在的 entity | 靜默 rollback |
| `VERSION_CONFLICT` | 版本衝突 | 等 pull_event 取得最新狀態 |
| `PERMISSION_DENIED` | 無權限操作 | rollback，顯示錯誤 |
| `VALIDATION_ERROR` | 欄位驗證失敗 | rollback，顯示欄位錯誤 |

---

## 後端處理邏輯

### 1. 排序 push_commands

```
排序優先順序：
1. entity_type：CAT → TXN → SHR（確保 category 先建立）
2. 同 entity_type 且同 entity_id：按 base_version 升序
```

### 2. 逐一處理，不因單一失敗中斷

```typescript
for (const command of sortedCommands) {
  // idempotency：已處理過直接 skipped
  const existing = await getSyncEventByMutationId(command.mutation_id)
  if (existing) {
    pushResults.push({ mutation_id: command.mutation_id, status: 'skipped' })
    continue
  }

  const result = await handler(command, context)
  pushResults.push(result)
  // 不論成功失敗，繼續處理下一個
}
```

### 3. sync_events 只寫入事實

**重要原則：** sync_events 只存 server 確認後的事實，不存前端的意圖。

```
✅ 正確：處理成功 → 寫入 sync_event
❌ 錯誤：先寫 POST 意圖事件 → 失敗再寫 DELETE 補償事件
```

### 4. SHR 的特殊處理

POST SHR 需要 server lookup viewer_id，處理成功後：
- 寫入 PUT sync_event（含完整 viewer_id 等資訊）給 owner
- 寫入 PUT sync_event 給 viewer（server-generated，使用新的 mutation_id）

失敗時直接回傳 error response，不寫任何 sync_event。

---

## 前端處理邏輯

### 資料結構

```typescript
// sync queue：累積待同步的 commands
interface SyncQueueItem {
  mutation_id: string
  entity_type: 'CAT' | 'TXN' | 'SHR'
  entity_id: string
  action: 'POST' | 'PUT' | 'DELETE'
  base_version: number
  payload: string | null
  snapshot_before: string | null  // 操作前的 entity 快照，用於 rollback
  created_at: number
}
```

### 同步流程

```typescript
async function performSync(apiBase: string) {
  const queue = await syncQueueRepository.getAllOrdered()
  const mutationMap = new Map(queue.map(item => [item.mutation_id, item]))

  const response = await fetch(`${apiBase}/sync`, {
    method: 'POST',
    body: JSON.stringify({
      last_cursor: await syncMetaRepository.getLastCursor(),
      push_commands: queue.map(toCommand),
      user: await userRepository.get(),
    })
  })

  const data: SyncResponse = await response.json()
  const pullEntityIds = new Set(data.pull_events.map(e => e.entity_id))

  // 1. 先 apply pull_events（server 事實優先）
  for (const event of data.pull_events) {
    await applyPullEvent(event)
  }

  // 2. 處理每個 push_result
  for (const result of data.push_results) {
    const entry = mutationMap.get(result.mutation_id)
    if (!entry) continue

    if (result.status === 'ok') {
      await syncQueueRepository.removeByMutationId(result.mutation_id)
      // 沒有對應 pull_event 時，自己 bump version
      if (!pullEntityIds.has(entry.entity_id)) {
        await bumpLocalVersion(entry, entry.base_version + 1)
      }
    }

    if (result.status === 'skipped') {
      await syncQueueRepository.removeByMutationId(result.mutation_id)
      // 不 bump version，entity 狀態不變
    }

    if (result.status === 'error') {
      await syncQueueRepository.removeByMutationId(result.mutation_id)
      await handleError(result, entry, mutationMap, data.push_results, pullEntityIds)
    }
  }

  await syncMetaRepository.setLastCursor(data.new_cursor)
}
```

### Rollback 策略

**核心原則：看最後一個操作的結果，而不是看第一個。**

```typescript
async function handleError(
  errorResult: PushResult,
  entry: SyncQueueItem,
  mutationMap: Map<string, SyncQueueItem>,
  allResults: PushResult[],
  pullEntityIds: Set<string>
) {
  // 找出這個 entity 後續的操作結果
  const laterResults = allResults.filter(r => {
    const e = mutationMap.get(r.mutation_id)
    return e?.entity_id === entry.entity_id && e.created_at > entry.created_at
  })

  const lastResult = laterResults.at(-1)

  // 如果最後的操作成功了，以最後結果為準，不需要 rollback
  if (lastResult?.status === 'ok' || lastResult?.status === 'skipped') {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    // pull_event 已經 apply 過了，或 skipped 代表目標達成
    return
  }

  // 如果有 pull_event，以 pull_event 為準
  if (pullEntityIds.has(entry.entity_id)) {
    await syncQueueRepository.removeByEntityId(entry.entity_id)
    return
  }

  // 真正需要 rollback：回到 snapshot_before 的狀態
  await rollbackEntity(entry)

  // 通知使用者（視 error.code 決定是否顯示）
  if (shouldNotifyUser(errorResult.error?.code)) {
    notifyError(entry.entity_id, errorResult.error)
  }
}
```

### Replay 引擎（處理複雜情境）

比起「怎麼撤銷」，更可靠的做法是「從已確認的狀態重新計算」：

```typescript
async function replayConfirmedState(entityId: string, entityType: string) {
  // 1. 取得最後確認的狀態（來自上次 pull_event）
  const confirmedBase = await getConfirmedEntity(entityId, entityType)

  // 2. 取得剩餘的 pending mutations
  const pendingMutations = await syncQueueRepository.getByEntityId(entityId)

  // 3. 從確認狀態開始，依序套用 pending mutations
  let state = confirmedBase ? { ...confirmedBase } : null
  for (const mutation of pendingMutations) {
    state = applyMutation(state, mutation)
  }

  // 4. 寫回 local DB
  await upsertLocalEntity(entityType, state)
}
```

---

## 複雜情境範例

### 情境：離線期間發送邀請後取消

```
前端離線期間累積：
  m1: POST SHR shr_1 (base_version: 0)  → 邀請 alice@example.com
  m2: POST TXN txn_1 (base_version: 0)  → 新增交易 $100
  m3: DELETE SHR shr_1 (base_version: 1) → 取消邀請
  m4: PUT TXN txn_1 (base_version: 1)   → 修改交易 $200
```

**Server 處理順序**（排序後：TXN 優先，SHR 其次，同 entity 按 base_version）：

```
m2: POST TXN txn_1 → ✅ ok,  version: 1
m4: PUT TXN txn_1  → ✅ ok,  version: 2
m1: POST SHR shr_1 → ❌ error: VIEWER_NOT_FOUND
m3: DELETE SHR shr_1 → ⏭ skipped（entity 不存在）
```

**前端收到 response 後：**

| mutation | status | 前端行為 |
|----------|--------|----------|
| m2 | ok | pull_event 已 apply，txn_1 version 以 server 為準 |
| m4 | ok | pull_event 已 apply，amount=200 confirmed |
| m1 | error | 後續 m3 是 skipped（目標達成），靜默 rollback shr_1 |
| m3 | skipped | queue 清除，shr_1 確實不存在，一致 |

**最終結果：** 交易 $200 成功，邀請因 alice 不存在而靜默失敗，使用者看到「找不到此使用者」提示。

---

## 注意事項

- `pull_events` 中 version 永遠 >= 1，version 0 代表資料有問題
- `mutation_id` 由前端產生，server 用於 idempotency 檢查，重複送出同一個 mutation_id 會回 `skipped`
- SHR 的 `viewer_id` 由 server lookup 後填入，前端 POST 時不需要提供
- `snapshot_before` 是前端 rollback 的關鍵，每次 optimistic update 前必須先儲存



Replay 前端沒實作