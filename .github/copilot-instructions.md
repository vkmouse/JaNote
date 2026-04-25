## 1. 寫程式前先思考

**不要妄加臆測。不要隱瞞困惑。主動提出權衡方案。**

在實作之前：
- 明確說明你的假設。如果不確定，請開口問。
- 互動式提問當你需要釐清問題或確認細節時，請務必以「互動式按鈕（Interactive buttons）」或「快速選擇（Quick pick）」的方式提供選項讓我點擊。絕對不要要求我重新打字或輸入新的提示詞（Prompt）。
- 如果有多種解讀方式，請將它們列出來（並配合上述互動選項讓我選擇）——不要默默地自己選一個。
- 如果有更簡單的方法，請提出來。必要時請勇於提出不同意見（Push back）。
- 如果有任何不清楚的地方，請停下來。具體指出令人困惑的部分，然後發問。

## 2. 簡單至上

**用最少的程式碼解決問題。不寫任何臆測性（猜測未來可能會用到）的程式碼。**

- 不加入要求之外的任何功能。
- 不為只會使用一次的程式碼建立抽象層。
- 不加入未被要求的「彈性」或「可設定性」。
- 不為不可能發生的情境撰寫錯誤處理。
- 如果你寫了 200 行，但其實 50 行就能搞定，請重寫它。

問問你自己：「資深工程師會不會覺得這太複雜了？」如果是，請簡化它。

## 3. 精準修改

**只動必須改的地方。只清理你自己造成的混亂。**

編輯現有程式碼時：
- 不要順手「改善」周遭相鄰的程式碼、註解或格式。
- 不要重構沒有壞掉的東西。
- 完全配合現有的程式碼風格，即使你自己有不同的寫法。
- 如果你注意到不相關的廢棄程式碼（Dead code），提出來就好——不要直接刪除它。

當你的修改產生了孤兒程式碼（Orphans）時：
- 移除因為「你的修改」而變得不再被使用的 imports、變數或函式。
- 除非被要求，否則不要移除原本就存在的廢棄程式碼。

檢驗標準：每一行修改的程式碼，都應該能直接追溯到使用者的原始要求。

## 4. 目標導向執行

**定義成功標準。反覆執行直到驗證通過。**

將任務轉化為可驗證的目標：
- 「加入驗證」 → 「為無效的輸入撰寫測試，然後讓測試通過」
- 「修復 Bug」 → 「寫一個能重現該 Bug 的測試，然後讓測試通過」
- 「重構 X」 → 「確保重構前與重構後的測試都能通過」

**每次修改程式碼後，必須執行 `npm run type-check` 並確保零錯誤，才算完成實作。**

對於多步驟的任務，請列出簡要計畫：
```text
1. [步驟] → 驗證: [檢查項目]
2. [步驟] → 驗證: [檢查項目]
3. [步驟] → 驗證: [檢查項目]

## 5. 當前專案指南（ootd-it）

**語言**：所有 comment（程式碼註解）與 spec 文件一律使用**繁體中文**，關鍵字（函式名、變數名、HTML 標籤等）可使用英文。

**視覺設計原則（Filled Card）**：
- 以背景色深淺層次區隔介面元素，**不使用框線（border）**。
- **不使用陰影（box-shadow / drop-shadow）**。
- **不撰寫任何 hover 狀態或 transition 動畫**（`button:hover`、`a:hover` 等一概不寫）。
- 所有視覺 token 集中在 `src/assets/base.css`，組件內使用 `<style scoped>`。

**主題切換機制**：
- `:root` 對應 **dark mode**（預設）。
- `body.light` 對應 **light mode**（透過 `document.body.classList.toggle('light')` 切換）。
- 偏好存入 `localStorage`，鍵名 `theme`，值為 `'light'` 或不存在（dark）。

**版面寬度限制**：
- 網頁版最大寬度為 **480px**，不實作超過 480px 寬度的設計或 RWD breakpoint。

**SVG Icon 管理規則**：
- 所有 SVG icon 放置於 `src/assets/icons/`，檔名格式為 `icon-*.svg`（可包含多個 `-`，例如 `icon-arrow-left.svg`）。
- SVG 屬性固定為 `viewBox="0 0 24 24" fill="none" stroke="currentColor"`。
- 所有元件取用 icon 時，必須從 `@/utils/icons` import，不得直接 import SVG 檔案。

# JaNote — Copilot Instructions

JaNote 是一個**離線優先 (Offline-first) 個人記帳管理 PWA**，部署於 Cloudflare Pages + Workers + D1。前端採用 Vue 3 / TypeScript，本地資料庫使用 Dexie (IndexedDB)，後端以 Cloudflare Pages Functions (TypeScript) 實作，認證透過 Cloudflare Access (JWT)。

---

## 目錄結構

```
/
├── .devcontainer/          # VS Code DevContainer 設定
├── .github/
│   └── copilot-instructions.md
├── functions/              # 後端：Cloudflare Pages Functions
│   ├── _middleware.ts      # 全域 JWT 認證中介層
│   ├── types.ts / types.d.ts
│   ├── api/
│   │   ├── sync.ts         # POST /api/sync — 核心同步 API
│   │   ├── health.ts       # GET  /api/health
│   │   └── initdb.ts       # POST /api/initdb — D1 schema 初始化
│   ├── repositories/       # D1 資料庫查詢層（server-side）
│   │   └── ...
│   ├── services/           # 業務邏輯層（server-side）
│   │   └── ...
│   └── utils/
│       └── validators.ts
├── src/                    # 前端：Vue 3 應用程式
│   ├── main.ts
│   ├── App.vue
│   ├── types.ts            # 前端型別定義
│   ├── router/
│   │   └── index.ts        # Vue Router 路由設定
│   ├── stores/             # Pinia 狀態管理
│   │   └── ...
│   ├── views/              # 頁面元件
│   │   └── ...
│   ├── components/         # 可重用 UI 元件
│   ├── db/
│   │   ├── index.ts        # Dexie 資料庫實例（IndexedDB）
│   │   ├── tables.ts       # Dexie schema 定義與版本遷移
│   │   └── repositories/   # Dexie 查詢層（client-side）
│   │       └── ...
│   ├── utils/
│   │   ├── serviceWorkerUpdate.ts  # PWA 更新邏輯
│   │   ├── recurrence.ts
│   │   ├── database.ts
│   │   ├── icons.ts
│   │   └── categoryIcons.ts
│   └── assets/
├── server/
│   └── index.ts            # Cloudflare Worker 入口（wrangler main）
├── public/                 # 靜態資源（PWA icons 等）
├── docker-compose.yml
├── wrangler.jsonc          # Cloudflare Workers / Pages 設定
├── vite.config.ts
└── SYNC.md                 # 同步功能詳細技術文件
```

---

## 技術棧

| 層級       | 技術                                          |
| ---------- | --------------------------------------------- |
| 前端框架   | Vue 3.5、TypeScript 5                         |
| 狀態管理   | Pinia 3                                       |
| 路由       | Vue Router 5                                  |
| 本地資料庫 | Dexie 4（IndexedDB ORM）                      |
| PWA        | vite-plugin-pwa（Workbox，manual SW control） |
| 建置工具   | Vite 7                                        |
| 後端平台   | Cloudflare Pages Functions（TypeScript）      |
| 雲端資料庫 | Cloudflare D1（SQLite）                       |
| 認證       | Cloudflare Access（JWT via `jose`）           |
| 部署       | `wrangler deploy`（Cloudflare Pages）         |

---

## 本機開發

### 方式一：Docker Compose

```bash
docker compose up      # 啟動容器（port 5173 Vite + 8888 Wrangler）
```

容器內會執行 `npm run dev:full`，同時啟動 Vite dev server (5173) 與 Wrangler dev proxy (8888)。  
已啟用 `CHOKIDAR_USEPOLLING=1` 解決 Docker volume 檔案監聽問題。

### 方式二：VS Code DevContainer

開啟 VS Code，在 `.devcontainer/` 設定下重開容器（Reopen in Container），post-create 會自動執行：

```bash
npm ci && npm install -g wait-on
```

接著手動啟動：

```bash
npm run dev:full   # 完整開發模式（Vite + Wrangler proxy）
npm run dev        # 僅 Vite（不含 Wrangler Functions）
```

### 常用指令

```bash
npm run dev          # Vite dev server（前端只）
npm run dev:full     # Vite + Wrangler proxy（完整 stack）
npm run build        # type-check + vite build
npm run type-check   # vue-tsc 型別檢查
npm run deploy       # build + wrangler deploy（部署到 Cloudflare）
npm run cf-typegen   # 重新產生 Cloudflare binding 型別
```

> **D1 binding：** `wrangler.jsonc` 中 D1 資料庫 binding 名稱為 `DB`，本機開發使用 Wrangler 自動建立的本地 SQLite。

---

## 同步功能架構

> 完整技術規格見 [SYNC.md](../SYNC.md)。以下為 Copilot 快速參考。

### 核心概念

- **Offline-first**：所有資料變更先寫入本地 Dexie，再非同步推送至伺服器。
- **Server as Source of Truth**：衝突時以伺服器版本為準。
- **Optimistic Locking**：每筆實體有 `version` 欄位；推送時帶 `base_version`，伺服器若已有更新版本則回傳 `SKIPPED`。
- **Mutation ID（UUID）**：每次本地寫入產生唯一 ID，確保 API 冪等性。
- **Cursor**：`sync_events` 表的自增 ID，客戶端記錄 `last_cursor` 拉取增量更新。

### 資料流

```
UI 呼叫 service.create/update/delete
  → 1. 寫入本地 Dexie entity table（樂觀更新）
  → 2. 寫入 sync_queue（含 snapshot_before, base_version, mutation_id）

syncStore.performSync()
  → 3. 讀取 sync_meta.last_cursor
  → 4. POST /api/sync { push_commands, last_cursor }

後端 functions/api/sync.ts
  → 5. 驗證 Cloudflare Access JWT
  → 6. Push Phase：冪等性 + 版本衝突檢查 → 寫入 D1 + sync_events
  → 7. Pull Phase：撈出 last_cursor 之後的 sync_events（排除本次 mutation）
  → 回傳 { push_results, pull_events, new_cursor }

前端套用回應
  → 8. Pull events：強制覆蓋本地 entity，清除同 entity_id 的佇列項目
  → 9. Push results：OK → 更新 version；SKIPPED → 移除佇列；ERROR → snapshot_before rollback
  → 10. 存入 new_cursor 到 sync_meta
```

### 實體類型

| EntityType | 說明                             |
| ---------- | -------------------------------- |
| `CAT`      | 類別（Category）                 |
| `TXN`      | 交易（Transaction）              |
| `BGT`      | 預算（Budget）                   |
| `SHR`      | 使用者分享（UserShare）          |
| `RTXN`     | 週期交易（RecurringTransaction） |
| `RBGT`     | 週期預算（RecurringBudget）      |

**處理順序**：`CAT > TXN/BGT/RTXN/RBGT > SHR`（確保外鍵約束正確）

### 關鍵檔案

- **前端同步狀態機**：[src/stores/syncStore.ts](../src/stores/syncStore.ts)
- **後端同步 API**：[functions/api/sync.ts](../functions/api/sync.ts)
- **本地 DB schema**：[src/db/tables.ts](../src/db/tables.ts)、[src/db/index.ts](../src/db/index.ts)
- **Dexie repositories**：`src/db/repositories/`
- **D1 repositories**：`functions/repositories/`

### 注意事項

- `sync_queue` 產生的 `snapshot_before` 欄位儲存 **修改前的完整快照** JSON，rollback 時直接還原。
- 軟刪除：所有 entity 使用 `is_deleted = 1` 旗標，不實際刪除資料列。
- `syncStore` 統一管理同步鎖（避免並發呼叫），透過 `syncStatusStore` 對 UI 暴露進度。

---

## PWA 版本更新

> 相關邏輯集中於 [src/utils/serviceWorkerUpdate.ts](../src/utils/serviceWorkerUpdate.ts)。

- PWA 使用 **manual Service Worker 控制**（`skipWaiting: false`）。
- 前端啟動時透過 `vite-plugin-pwa` 提供的 `useRegisterSW` 偵測新 SW 進入 **waiting** 狀態。
- 確認有待更新的 SW 後，透過 `postMessage({ type: 'SKIP_WAITING' })` 觸發 `skipWaiting`。
- 5 秒未啟動則強制 `window.location.reload()`。
- SW controller 切換（`controllerchange` 事件）後自動 reload 頁面。
- Dev 模式下 PWA 強制啟用，方便本機測試更新流程。

---

## 認證

- 所有 `/api/*` 請求由 `functions/_middleware.ts` 攔截，驗證 `Cf-Access-Jwt-Assertion` header 的 JWT。
- JWT 使用 Cloudflare Access JWKS（`TEAM_DOMAIN`）驗證，需設定環境變數 `POLICY_AUD`、`TEAM_DOMAIN`。
- 本機開發若未配置 Cloudflare Access，middleware 回退至 `demo@example.com`。

---

## 架構慣例

- **Repository pattern**：DB 查詢封裝在 `repositories/`，業務邏輯在 `services/`，頁面邏輯在 Pinia `stores/`。
- **前後端各有一套 repositories**：`src/db/repositories/`（Dexie / IndexedDB）和 `functions/repositories/`（D1 / SQLite），命名相同但實作不同。
- **型別定義**：前端共用型別在 `src/types.ts`；後端在 `functions/types.ts`、`functions/types.d.ts`。
- **Dexie schema 升版**：修改 `src/db/tables.ts`，新增 `version().stores()` migration，不修改舊版本。
- **Entity 型別**：交易分類為 `EXPENSE | INCOME`（`EntryType`）。

### 前端資料流

```
views / components
       ↓  呼叫 action / 讀取 computed
    stores（Pinia）
       ↓  呼叫 repository 方法
  repositories（src/db/repositories/）
       ↓  透過 Dexie ORM 存取
      db（IndexedDB）
```

> **重要**：views 與 components **不得**直接 import `src/db/repositories/` 或 `src/db/index.ts`。所有資料存取一律透過對應的 Pinia store。

### Icon 使用規範

- **唯一出口**：所有 SVG icon 以 `?raw` 方式 import 後，**統一在 `src/utils/icons.ts` 匯出**。
- **禁止直接 import**：components 與 views **不得**直接 `import xxx from "...assets/icons/..."?raw`，一律從 `src/utils/icons.ts` 引入。
- **新增 icon**：在 `src/utils/icons.ts` 加入 import 與 export，再於需要的元件中從該檔案引入。

### 備註語言規範

撰寫程式碼備註（comments）時，使用**繁體中文**描述。變數名稱、關鍵字、技術術語（如 `type`、`interface`、`async/await`）除外。

### 修改完成標準

每次修改前端程式碼後，**必須執行 `npm run type-check` 並確認通過**，才算修改完成。
