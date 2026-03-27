<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import { useUserStore } from "../stores/userStore";
import { useSyncStore } from "../stores/syncStore";
import { useUserShareStore } from "../stores/userShareStore";
import { useTransactionStore } from "../stores/transactionStore";
import type { UserShare } from "../types";

const userStore = useUserStore();
const syncStore = useSyncStore();
const userShareStore = useUserShareStore();
const transactionStore = useTransactionStore();

const apiBase = ref("/api");

// 共享邀請相關 UI 狀態
const inviteEmail = ref("");
const isInviting = ref(false);
const operatingShareId = ref<string | null>(null);

const isSyncing = computed(() => syncStore.syncStatus === "syncing");

// CSV 匯出匯入相關狀態
const csvFileInput = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);

// ── CSV 工具函式 ────────────────────────────────────────────

/** 解析單行 CSV，處理引號內含逗號的欄位 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
  }
  result.push(cur);
  return result;
}

/** 將欄位值包裝為 CSV 安全字串 */
function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

/** Unix ms → YYYY/MM/DD */
function msToDateStr(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}/${m}/${day}`;
}

/** YYYY/MM/DD → Unix ms（中午 12:00，避免時區偏移到前一天）*/
function dateStrToMs(str: string): number {
  const parts = str.trim().split(/[/\-]/);
  if (parts.length !== 3) return NaN;
  const [yStr, mStr, dStr] = parts as [string, string, string];
  const y = parseInt(yStr, 10);
  const mo = parseInt(mStr, 10) - 1;
  const d = parseInt(dStr, 10);
  return new Date(y, mo, d, 12, 0, 0).getTime();
}

// ── 匯出 ────────────────────────────────────────────────────

async function exportCsv() {
  const myTransactions = [...transactionStore.visibleTransactions].sort(
    (a, b) => a.date - b.date,
  );
  const categoryMap = new Map(
    transactionStore.visibleCategories.map((c) => [c.id, c]),
  );

  const rows: string[] = ["記帳日期,分類,子分類,金額,更新日期,備註"];

  for (const t of myTransactions) {
    const cat = categoryMap.get(t.category_id);
    const catName = cat ? cat.name : "";
    const typeLabel = t.type === "EXPENSE" ? "支出" : "收入";
    const dateStr = msToDateStr(t.date);
    rows.push(
      [
        dateStr,
        typeLabel,
        escapeCsvField(catName),
        String(t.amount),
        dateStr,
        escapeCsvField(t.note),
      ].join(","),
    );
  }

  const csvContent = "\uFEFF" + rows.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `janote_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── 匯入 ────────────────────────────────────────────────────

const REQUIRED_COLUMNS = ["記帳日期", "分類", "子分類", "金額", "更新日期", "備註"] as const;
type CsvColKey = (typeof REQUIRED_COLUMNS)[number];

function triggerCsvImport() {
  csvFileInput.value?.click();
}

async function handleCsvImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = ""; // 重置 input 以允許重複選同一檔案
  if (!file) return;
  await importCsv(file);
}

async function importCsv(file: File) {
  isImporting.value = true;
  try {
    let text = await file.text();
    // 去除 UTF-8 BOM
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) {
      alert("匯入失敗：CSV 內容為空");
      return;
    }

    // 確認必要欄位都存在
    const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
    const missingCols = REQUIRED_COLUMNS.filter((col) => !headers.includes(col));
    if (missingCols.length > 0) {
      alert(`匯入失敗：缺少必要欄位 [${missingCols.join("、")}]`);
      return;
    }

    // 建立欄位索引（多餘欄位自動忽略）
    const idx = {} as Record<CsvColKey, number>;
    for (const col of REQUIRED_COLUMNS) {
      idx[col] = headers.indexOf(col);
    }

    const myCategories = transactionStore.visibleCategories;

    interface ImportRow {
      category_id: string;
      type: "EXPENSE" | "INCOME";
      amount: number;
      note: string;
      date: number;
    }
    const validRows: ImportRow[] = [];
    const skippedRows: number[] = [];

    for (let i = 1; i < lines.length; i++) {
      const fields = parseCsvLine(lines[i]!);
      const dateStr = fields[idx["記帳日期"]]?.trim() ?? "";
      const typeStr = fields[idx["分類"]]?.trim() ?? "";
      const catName = fields[idx["子分類"]]?.trim() ?? "";
      const amountStr = fields[idx["金額"]]?.trim() ?? "";
      const note = fields[idx["備註"]]?.trim() ?? "";

      const date = dateStrToMs(dateStr);
      if (isNaN(date)) {
        skippedRows.push(i + 1);
        continue;
      }

      const type: "EXPENSE" | "INCOME" = typeStr === "收入" ? "INCOME" : "EXPENSE";

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount < 0) {
        skippedRows.push(i + 1);
        continue;
      }

      // 比對子分類：name + type 完全相符，fallback「其他」同類型
      let cat = myCategories.find((c) => c.name === catName && c.type === type);
      if (!cat) {
        cat = myCategories.find((c) => c.name === "其他" && c.type === type);
      }
      if (!cat) {
        skippedRows.push(i + 1);
        continue;
      }

      validRows.push({ category_id: cat.id, type, amount, note, date });
    }

    if (validRows.length === 0) {
      const reason =
        skippedRows.length > 0
          ? `所有資料列都無法對應分類（第 ${skippedRows.join("、")} 行）`
          : "沒有可匯入的資料";
      alert(`匯入失敗：${reason}`);
      return;
    }

    const skipMsg =
      skippedRows.length > 0
        ? `\n（第 ${skippedRows.join("、")} 行因分類不符將被跳過）`
        : "";
    if (!confirm(`本次將新增 ${validRows.length} 筆交易，確認匯入？${skipMsg}`)) {
      return;
    }

    for (const row of validRows) {
      await transactionStore.addTransaction(row);
    }

    alert(`已成功匯入 ${validRows.length} 筆交易，請執行同步以上傳資料`);
  } catch (err) {
    alert("匯入失敗：讀取 CSV 發生錯誤");
    console.error("CSV 匯入錯誤:", err);
  } finally {
    isImporting.value = false;
  }
}

onMounted(() => {
  refreshLocalState();
});

async function refreshLocalState() {
  await syncStore.refreshSyncState();
  await userStore.loadUser();
  await userShareStore.loadShares(userStore.currentUserId);
  await transactionStore.loadTransactions();
  await transactionStore.loadCategories();
}

async function syncNow() {
  try {
    await syncStore.performSync(apiBase.value);
    await userStore.loadUser();
    await userShareStore.loadShares(userStore.currentUserId);
  } catch (error) {
    console.error("同步失敗:", error);
  }
}

async function clearAllData() {
  if (!confirm("確定要清空所有本地資料嗎？此操作無法復原。")) {
    return;
  }

  try {
    await transactionStore.deleteAllCategories();
    await transactionStore.deleteAllTransactions();
    await userShareStore.deleteAllShares();
    await syncStore.clearSyncData();
    await userStore.clearUser();

    alert("已清空所有本地資料");
  } catch (error) {
    alert("清空資料失敗");
    console.error(error);
  }
}

async function sendInvite() {
  const email = inviteEmail.value.trim();

  if (!email) {
    alert("請輸入 Email 地址");
    return;
  }

  // 簡單的 email 驗證
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("請輸入有效的 Email 地址");
    return;
  }

  // 檢查是否已經邀請過
  const existingInvite = userShareStore.sentPendingInvites.find(
    (invite) => invite.receiver_email === email,
  );
  if (existingInvite) {
    alert("已經邀請過此 Email");
    return;
  }

  isInviting.value = true;

  try {
    const user = userStore.currentUser;
    if (!user?.id || !user?.email) {
      alert("無法取得使用者資訊");
      return;
    }

    await userShareStore.sendInvite(user.id, user.email, email);
    await userShareStore.loadShares(userStore.currentUserId);
    inviteEmail.value = "";

    alert("邀請已發送，請執行同步");
  } catch (error) {
    alert("發送邀請失敗");
    console.error("發送邀請失敗:", error);
  } finally {
    isInviting.value = false;
  }
}

async function acceptInvitation(share: UserShare) {
  if (operatingShareId.value) return;

  operatingShareId.value = share.id;

  try {
    await userShareStore.acceptInvitation(share);
    await userShareStore.loadShares(userStore.currentUserId);
    alert("已接受邀請，請執行同步");
  } catch (error) {
    alert("接受邀請失敗");
    console.error("接受邀請失敗:", error);
  } finally {
    operatingShareId.value = null;
  }
}

async function rejectOrCancelShare(share: UserShare, actionName: string) {
  if (operatingShareId.value) return;

  if (!confirm(`確定要${actionName}嗎？`)) {
    return;
  }

  operatingShareId.value = share.id;

  try {
    await userShareStore.rejectOrCancelShare(share);
    await userShareStore.loadShares(userStore.currentUserId);
    alert(`已${actionName}，請執行同步`);
  } catch (error) {
    alert(`${actionName}失敗`);
    console.error(`${actionName}失敗:`, error);
  } finally {
    operatingShareId.value = null;
  }
}
</script>

<template>
  <section class="sync-page">
    <TopNavigation>
      <template #left><NavBack /></template>
    </TopNavigation>

    <div class="page-content">
      <header class="hero">
        <div class="brand">
          <p class="eyebrow">Sync Management</p>
          <h1>同步管理</h1>
          <p class="subtitle">管理本地與伺服器的同步狀態</p>
        </div>
        <div class="status-card">
          <div class="status-row">
            <span class="status-dot" :class="syncStore.syncStatus"></span>
            <span class="status-text">
              {{
                syncStore.syncStatus === "syncing"
                  ? "同步中"
                  : syncStore.syncStatus === "success"
                    ? "就緒"
                    : syncStore.syncStatus === "error"
                      ? "同步失敗"
                      : "待命"
              }}
            </span>
          </div>
          <div class="status-meta">
            <div>
              <span>Email</span>
              <strong class="email-text">{{
                userStore.currentUserEmail || "-"
              }}</strong>
            </div>
            <div>
              <span>Cursor</span>
              <strong>{{ syncStore.lastCursor }}</strong>
            </div>
            <div>
              <span>Queue</span>
              <strong>{{ syncStore.activeQueueCount }}</strong>
            </div>
            <div>
              <span>Last Sync</span>
              <strong class="sync-time">{{
                syncStore.lastSyncAt || "-"
              }}</strong>
            </div>
          </div>
        </div>
      </header>

      <section class="csv-section" v-if="!userStore.isViewingShared">
        <h2>資料匯出 / 匯入</h2>
        <p class="csv-desc">匯出或匯入本機交易記錄（CSV 格式）。匯入後請執行同步以上傳資料。</p>
        <div class="csv-actions">
          <button class="btn-primary" :disabled="isImporting" @click="exportCsv">
            匯出 CSV
          </button>
          <button
            class="btn-primary btn-import"
            :disabled="isImporting"
            @click="triggerCsvImport"
          >
            {{ isImporting ? "匯入中..." : "匯入 CSV" }}
          </button>
        </div>
        <input
          ref="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          style="display: none"
          @change="handleCsvImport"
        />
      </section>

      <section class="controls">
        <div class="control">
          <label>API Base</label>
          <input v-model="apiBase" placeholder="/api" />
        </div>
        <div class="control actions">
          <button class="btn-primary" :disabled="isSyncing" @click="syncNow">
            {{ isSyncing ? "同步中..." : "立即同步" }}
          </button>
          <button class="btn-primary btn-danger" @click="clearAllData">
            清空本機資料
          </button>
        </div>
      </section>

      <section class="share-section">
        <h2>共享邀請</h2>
        <div class="invite-form">
          <input
            v-model="inviteEmail"
            type="email"
            placeholder="輸入要邀請的 Email"
            @keyup.enter="sendInvite"
          />
          <button
            class="btn-primary btn-invite"
            :disabled="isInviting"
            @click="sendInvite"
          >
            {{ isInviting ? "發送中..." : "發送邀請" }}
          </button>
        </div>

        <!-- 收到的邀請 -->
        <div
          v-if="userShareStore.receivedPendingInvites.length > 0"
          class="invites-list"
        >
          <h3>
            收到的邀請 ({{ userShareStore.receivedPendingInvites.length }})
          </h3>
          <div class="invite-items">
            <div
              v-for="share in userShareStore.receivedPendingInvites"
              :key="share.id"
              class="invite-item received"
            >
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">來自</span>
                  <span class="email-address">{{ share.sender_email }}</span>
                </div>
                <span class="status-badge pending">待接受</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-accept"
                  :disabled="operatingShareId === share.id"
                  @click="acceptInvitation(share)"
                >
                  接受
                </button>
                <button
                  class="btn-action btn-reject"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '拒絕邀請')"
                >
                  拒絕
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 發出的邀請 (作為 owner) -->
        <div
          v-if="userShareStore.sentPendingInvites.length > 0"
          class="invites-list"
        >
          <h3>發出的邀請 ({{ userShareStore.sentPendingInvites.length }})</h3>
          <div class="invite-items">
            <div
              v-for="share in userShareStore.sentPendingInvites"
              :key="share.id"
              class="invite-item sent"
            >
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">邀請</span>
                  <span class="email-address">{{ share.receiver_email }}</span>
                </div>
                <span class="status-badge pending">邀請中</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-cancel"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '取消邀請')"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 活躍的共享 -->
        <div v-if="userShareStore.activeShares.length > 0" class="invites-list">
          <h3>活躍的共享 ({{ userShareStore.activeShares.length }})</h3>
          <div class="invite-items">
            <div
              v-for="share in userShareStore.activeShares"
              :key="share.id"
              class="invite-item active"
            >
              <div class="invite-info">
                <div class="invite-email">
                  <span class="label">{{
                    share.sender_id === userStore.currentUserId
                      ? "共享給"
                      : "來自"
                  }}</span>
                  <span class="email-address">
                    {{
                      share.sender_id === userStore.currentUserId
                        ? share.receiver_email
                        : share.sender_email
                    }}
                  </span>
                </div>
                <span class="status-badge active">已啟用</span>
              </div>
              <div class="invite-actions">
                <button
                  class="btn-action btn-remove"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '刪除共享')"
                >
                  刪除
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="
            userShareStore.sentPendingInvites.length === 0 &&
            userShareStore.receivedPendingInvites.length === 0 &&
            userShareStore.activeShares.length === 0
          "
          class="empty-state"
        >
          <p>暫無共享記錄</p>
        </div>
      </section>
    </div>
  </section>
</template>

<style scoped>
.sync-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.page-content {
  flex: 1;
  background: var(--bg-page);
  color: var(--text-primary);
  padding: 20px 12px 40px;
  position: relative;
}

.hero {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 28px;
}

.brand h1 {
  font-size: 28px;
  margin: 4px 0 6px;
}

.eyebrow {
  text-transform: uppercase;
  letter-spacing: 0.12em;
  font-size: 12px;
  color: var(--text-secondary);
}

.subtitle {
  margin: 0;
  color: var(--text-secondary);
}

.status-card {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 18px;
  padding: 14px 16px;
  width: 100%;
  min-width: 0;
  flex-shrink: 0;
}

.status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-disabled);
  flex-shrink: 0;
}

.status-dot.syncing {
  background: var(--janote-income);
  box-shadow: 0 0 12px rgba(71, 184, 224, 0.6);
}

.status-dot.success {
  background: var(--janote-expense);
  box-shadow: 0 0 12px rgba(255, 201, 82, 0.6);
}

.status-dot.error {
  background: var(--janote-action);
  box-shadow: 0 0 12px rgba(248, 113, 113, 0.6);
}

.status-text {
  font-weight: 600;
}

.status-meta {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px 8px;
}

.status-meta > div {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.status-meta span {
  font-size: 12px;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.status-meta strong {
  display: block;
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.email-text {
  max-width: 100%;
  font-size: 11px !important;
}

.sync-time {
  font-size: 10px !important;
}

.controls {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 28px;
}

.control {
  display: flex;
  flex-direction: column;
}

.control label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-secondary);
  margin-bottom: 6px;
  display: block;
}

.page-content input,
.page-content select {
  width: 100%;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid #e0e0e0;
  background: var(--bg-page);
  font-size: 14px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  justify-content: flex-end;
}

.csv-section {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  padding: 14px;
  margin-bottom: 28px;
}

.csv-section h2 {
  font-size: 20px;
  margin: 0 0 8px 0;
  color: var(--text-primary);
}

.csv-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0 0 14px 0;
  line-height: 1.5;
}

.csv-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.btn-import {
  background: var(--janote-income);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(71, 184, 224, 0.3);
}

.share-section {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 16px;
  padding: 16px;
  margin-bottom: 28px;
}

.share-section h2 {
  font-size: 20px;
  margin: 0 0 16px 0;
  color: var(--text-primary);
}

.share-section h3 {
  font-size: 14px;
  margin: 0 0 12px 0;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.invite-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 20px;
}

.invite-form input {
  flex: 1;
  width: 100%;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-primary);
  background: var(--bg-page);
  font-size: 14px;
  color: var(--text-primary);
}

.invite-form input::placeholder {
  color: var(--text-disabled);
}

.btn-invite {
  padding: 12px 24px;
  white-space: nowrap;
  width: 100%;
}

.invites-list {
  margin-top: 20px;
}

.invite-items {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.invite-item {
  display: flex;
  align-items: stretch;
  flex-direction: column;
  background: rgba(71, 184, 224, 0.06);
  border: 1px solid rgba(71, 184, 224, 0.2);
  border-radius: 12px;
  padding: 10px 12px;
  gap: 10px;
}

.invite-item.received {
  background: rgba(255, 201, 82, 0.06);
  border-color: rgba(255, 201, 82, 0.2);
}

.invite-item.sent {
  background: rgba(71, 184, 224, 0.06);
  border-color: rgba(71, 184, 224, 0.2);
}

.invite-item.active {
  background: rgba(34, 197, 94, 0.06);
  border-color: rgba(34, 197, 94, 0.2);
}

.invite-info {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.invite-email {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
}

.invite-email .label {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.email-address {
  font-size: 14px;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-badge {
  font-size: 11px;
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
  font-weight: 500;
  flex-shrink: 0;
}

.status-badge.pending {
  color: var(--janote-income);
  background: rgba(71, 184, 224, 0.15);
}

.status-badge.active {
  color: rgb(34, 197, 94);
  background: rgba(34, 197, 94, 0.15);
}

.invite-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  width: 100%;
}

.btn-action {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  flex: 1;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
}

.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-accept {
  background: var(--janote-expense);
  color: var(--text-primary);
  box-shadow: 0 2px 6px rgba(255, 201, 82, 0.3);
}

.btn-reject,
.btn-cancel,
.btn-remove {
  background: var(--janote-action);
  color: var(--text-light);
  box-shadow: 0 2px 6px rgba(248, 113, 113, 0.3);
}

.status-pending {
  font-size: 12px;
  color: var(--janote-income);
  background: rgba(71, 184, 224, 0.15);
  padding: 4px 10px;
  border-radius: 6px;
  white-space: nowrap;
}

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-style: italic;
}

.page-content button {
  font-family: inherit;
  border: none;
  border-radius: 12px;
  padding: 14px 20px;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease,
    opacity 0.2s ease;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  width: 100%;
}

.btn-primary {
  background: var(--janote-expense);
  color: var(--text-primary);
  box-shadow: 0 2px 8px rgba(255, 201, 82, 0.3);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  box-shadow: none;
}

.btn-danger {
  background: var(--janote-action);
  color: var(--text-light);
  box-shadow: 0 2px 8px rgba(248, 113, 113, 0.3);
}
</style>
