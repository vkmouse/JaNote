<script setup lang="ts">
import { ref, onMounted } from "vue";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import NavSync from "../components/NavSync.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import { useUserStore } from "../stores/userStore";
import { useSyncStore } from "../stores/syncStore";
import { useSyncStatusStore } from "../stores/syncStatusStore";
import { useUserShareStore } from "../stores/userShareStore";
import { useTransactionStore } from "../stores/transactionStore";
import type { UserShare } from "../types";

const userStore = useUserStore();
const syncStore = useSyncStore();
const syncStatusStore = useSyncStatusStore();
const userShareStore = useUserShareStore();
const transactionStore = useTransactionStore();

useSharedSwipeContext();

// ── 共享邀請 UI 狀態 ────────────────────────────────────────
const inviteEmail = ref("");
const isInviting = ref(false);
const operatingShareId = ref<string | null>(null);


// ── CSV ─────────────────────────────────────────────────────
const csvFileInput = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);

// ── ConfirmModal ─────────────────────────────────────────────
const showClearModal = ref(false);

// ── CSV 工具函式 ─────────────────────────────────────────────

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

const REQUIRED_COLUMNS = [
  "記帳日期",
  "分類",
  "子分類",
  "金額",
  "更新日期",
  "備註",
] as const;
type CsvColKey = (typeof REQUIRED_COLUMNS)[number];

function triggerCsvImport() {
  csvFileInput.value?.click();
}

async function handleCsvImport(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = "";
  if (!file) return;
  await importCsv(file);
}

async function importCsv(file: File) {
  isImporting.value = true;
  try {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) {
      alert("匯入失敗：CSV 內容為空");
      return;
    }

    const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
    const missingCols = REQUIRED_COLUMNS.filter(
      (col) => !headers.includes(col),
    );
    if (missingCols.length > 0) {
      alert(`匯入失敗：缺少必要欄位 [${missingCols.join("、")}]`);
      return;
    }

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

      const type: "EXPENSE" | "INCOME" =
        typeStr === "收入" ? "INCOME" : "EXPENSE";

      const amount = parseFloat(amountStr);
      if (isNaN(amount) || amount < 0) {
        skippedRows.push(i + 1);
        continue;
      }

      let cat = myCategories.find(
        (c) => c.name === catName && c.type === type,
      );
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
    if (
      !confirm(`本次將新增 ${validRows.length} 筆交易，確認匯入？${skipMsg}`)
    ) {
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

// ── 頁面初始化 ───────────────────────────────────────────────

onMounted(async () => {
  await syncStore.refreshSyncState();
  await userStore.loadUser();
  await userShareStore.loadShares(userStore.currentUserId);
  await transactionStore.loadTransactions();
  await transactionStore.loadCategories();
});

// ── 同步 ────────────────────────────────────────────────────

async function syncNow() {
  await syncStatusStore.triggerSync();
  // 補充 reload Profile 頁專用的資料
  await userStore.loadUser();
  await userShareStore.loadShares(userStore.currentUserId);
}

// ── 清空資料 ────────────────────────────────────────────────

async function clearAllData() {
  try {
    await transactionStore.deleteAllCategories();
    await transactionStore.deleteAllTransactions();
    await userShareStore.deleteAllShares();
    await syncStore.clearSyncData();
    await userStore.clearUser();
  } catch (error) {
    console.error("清空資料失敗:", error);
  } finally {
    showClearModal.value = false;
  }
}

// ── 共享邀請 ────────────────────────────────────────────────

async function sendInvite() {
  const email = inviteEmail.value.trim();

  if (!email) {
    alert("請輸入 Email 地址");
    return;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    alert("請輸入有效的 Email 地址");
    return;
  }

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

function getShareOtherEmail(share: UserShare): string {
  return share.sender_id === userStore.currentUserId
    ? share.receiver_email
    : share.sender_email;
}

function getShareDirection(share: UserShare): string {
  return share.sender_id === userStore.currentUserId ? "共享給" : "來自";
}
</script>

<template>
  <div class="profile-page">
    <TopNavigation>
      <template #left><NavBack /></template>
      <template #center>
        <span class="nav-title">個人檔案</span>
      </template>
      <template #right><NavSync /></template>
    </TopNavigation>

    <div class="page-content">

      <!-- ── 個人資訊 ─────────────────────────────────────── -->
      <section class="section">
        <h2 class="section-label">個人資訊</h2>
        <div class="card">
          <div class="info-row">
            <span class="info-key">電子信箱</span>
            <span class="info-value">
              {{ userStore.currentUserEmail || "—" }}
            </span>
          </div>
        </div>
      </section>

      <!-- ── 共享管理 ─────────────────────────────────────── -->
      <section class="section">
        <h2 class="section-label">共享管理</h2>

        <!-- 發送邀請 -->
        <div class="invite-row">
          <input
            v-model="inviteEmail"
            type="email"
            class="invite-input"
            placeholder="輸入要邀請的 Email"
            @keyup.enter="sendInvite"
          />
          <button
            class="btn-action-sm btn-action-invite"
            :disabled="isInviting"
            @click="sendInvite"
          >
            {{ isInviting ? "發送中…" : "邀請" }}
          </button>
        </div>

        <!-- 收到的邀請 -->
        <ListGroup v-if="userShareStore.receivedPendingInvites.length > 0">
          <template #header-left>
            <span class="group-header-title">收到的邀請</span>
          </template>
          <template #header-right>
            <span class="group-header-count">
              {{ userShareStore.receivedPendingInvites.length }}
            </span>
          </template>
          <ListItem
            v-for="share in userShareStore.receivedPendingInvites"
            :key="share.id"
          >
            <div class="share-row">
              <div class="share-info">
                <span class="share-from">來自</span>
                <span class="share-email">{{ share.sender_email }}</span>
              </div>
              <div class="share-btns">
                <button
                  class="btn-sm btn-accept"
                  :disabled="operatingShareId === share.id"
                  @click="acceptInvitation(share)"
                >
                  接受
                </button>
                <button
                  class="btn-sm btn-reject"
                  :disabled="operatingShareId === share.id"
                  @click="rejectOrCancelShare(share, '拒絕邀請')"
                >
                  拒絕
                </button>
              </div>
            </div>
          </ListItem>
        </ListGroup>

        <!-- 發出的邀請 -->
        <ListGroup v-if="userShareStore.sentPendingInvites.length > 0">
          <template #header-left>
            <span class="group-header-title">發出的邀請</span>
          </template>
          <template #header-right>
            <span class="group-header-count">
              {{ userShareStore.sentPendingInvites.length }}
            </span>
          </template>
          <ListItem
            v-for="share in userShareStore.sentPendingInvites"
            :key="share.id"
            :swipeable="true"
            @delete="rejectOrCancelShare(share, '取消邀請')"
            @edit="rejectOrCancelShare(share, '取消邀請')"
          >
            <div class="share-row">
              <div class="share-info">
                <span class="share-from">邀請</span>
                <span class="share-email">{{ share.receiver_email }}</span>
              </div>
              <span class="share-badge share-badge--pending">邀請中</span>
            </div>
          </ListItem>
        </ListGroup>

        <!-- 已啟用的共享 -->
        <ListGroup v-if="userShareStore.activeShares.length > 0">
          <template #header-left>
            <span class="group-header-title">已啟用的共享</span>
          </template>
          <template #header-right>
            <span class="group-header-count">
              {{ userShareStore.activeShares.length }}
            </span>
          </template>
          <ListItem
            v-for="share in userShareStore.activeShares"
            :key="share.id"
            :swipeable="true"
            @delete="rejectOrCancelShare(share, '刪除共享')"
            @edit="rejectOrCancelShare(share, '刪除共享')"
          >
            <div class="share-row">
              <div class="share-info">
                <span class="share-from">{{ getShareDirection(share) }}</span>
                <span class="share-email">{{ getShareOtherEmail(share) }}</span>
              </div>
              <span class="share-badge share-badge--active">已啟用</span>
            </div>
          </ListItem>
        </ListGroup>


      </section>

      <!-- ── 同步與資料 ─────────────────────────────────────── -->
      <section class="section">
        <h2 class="section-label">同步與資料</h2>
        <!-- 同步狀態 -->
        <div class="card">
          <div class="sync-meta-grid">
            <div class="meta-cell">
              <span class="meta-key">未同步數量</span>
              <strong class="meta-value">{{ syncStore.activeQueueCount }}</strong>
            </div>
            <div class="meta-cell">
              <span class="meta-key">同步游標</span>
              <strong class="meta-value">{{ syncStore.lastCursor }}</strong>
            </div>
            <div class="meta-cell meta-cell--full">
            <span class="meta-key">最後同步時間</span>
            <strong class="meta-value">{{ syncStore.lastSyncAt || "—" }}</strong>
          </div>
        </div>
      </div>
      <!-- 立即同步 -->
      <div class="action-card">
        <div class="action-row">
          <div class="action-info">
            <span class="action-title">立即同步</span>
            <span class="action-desc">將本機變更推送至雲端並拉取最新資料</span>
          </div>
          <button
            class="btn-action-sm btn-action-sync"
            :disabled="!syncStatusStore.canSync"
            @click="syncNow"
          >
            {{ syncStatusStore.status === 'syncing' ? '同步中…' : '同步' }}
          </button>
        </div>
      </div>
      <!-- 匯出／匯入／清空（非共享瀏覽模式才顯示） -->
      <template v-if="!userStore.isViewingShared">
        <div class="action-card">
          <div class="action-row">
            <div class="action-info">
              <span class="action-title">匯出資料</span>
              <span class="action-desc">將本機交易記錄匯出為 CSV 格式</span>
            </div>
            <button
              class="btn-action-sm btn-action-export"
              :disabled="isImporting"
              @click="exportCsv"
            >
              匯出
            </button>
          </div>
        </div>
        <div class="action-card">
          <div class="action-row">
            <div class="action-info">
              <span class="action-title">匯入資料</span>
              <span class="action-desc">從 CSV 匯入交易記錄，匯入後請執行同步</span>
            </div>
            <button
              class="btn-action-sm btn-action-import"
              :disabled="isImporting"
              @click="triggerCsvImport"
            >
              {{ isImporting ? "匯入中…" : "匯入" }}
            </button>
          </div>
        </div>
        <div class="danger-card">
          <div class="danger-row">
            <div class="danger-info">
              <span class="danger-title">清空本機資料</span>
              <span class="danger-desc">移除所有本地記錄與同步狀態，無法復原</span>
            </div>
            <button class="btn-clear" @click="showClearModal = true">
              清空
            </button>
          </div>
        </div>
        <input
          ref="csvFileInput"
          type="file"
          accept=".csv,text/csv"
          style="display: none"
          @change="handleCsvImport"
        />
      </template>
      </section>
    </div>

    <ConfirmModal
      :show="showClearModal"
      title="清空本機資料"
      message="確定要清空所有本地資料嗎？此操作無法復原。"
      confirm-text="清空"
      variant="danger"
      @confirm="clearAllData"
      @cancel="showClearModal = false"
    />
  </div>
</template>

<style scoped>
.profile-page {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.nav-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.page-content {
  flex: 1;
  padding: 20px 16px 120px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── Section ─────────────────────────────────────────────── */

.section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-label {
  font-size: 15px;
  font-weight: 700;
  margin: 0;
  padding: 0 2px;
}

/* ── Card ────────────────────────────────────────────────── */

.card {
  background: var(--bg-page);
  border: 1.5px solid var(--border-primary);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── 個人資訊 ────────────────────────────────────────────── */

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
}

.info-key {
  font-size: 13px;
  color: var(--text-secondary);
}

.info-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
  flex: 1;
  min-width: 0;
}

/* ── 同步 ────────────────────────────────────────────────── */

.sync-meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px 8px;
}

.meta-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.meta-cell--full {
  grid-column: 1 / -1;
}

.meta-key {
  font-size: 13px;
  color: var(--text-secondary);
}

.meta-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── Buttons ─────────────────────────────────────────── */

.action-card {
  border: 1.5px solid var(--border-primary);
  border-radius: 12px;
  padding: 12px 16px;
}

.action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.action-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.action-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.action-desc {
  font-size: 12px;
  color: var(--text-secondary);
  line-height: 1.4;
}

.btn-action-sm {
  font-family: inherit;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: background 0.15s, color 0.15s, opacity 0.15s;
}

.btn-action-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-action-export {
  border: none;
  background: var(--janote-income);
  color: var(--text-light);
}

.btn-action-export:not(:disabled):active {
  opacity: 0.8;
}

.btn-action-import {
  border: none;
  background: var(--janote-income);
  color: var(--text-light);
}

.btn-action-import:not(:disabled):active {
  opacity: 0.8;
}

.btn-action-sync {
  border: none;
  background: var(--janote-expense);
  color: var(--text-primary);
}

.btn-action-sync:not(:disabled):active {
  opacity: 0.8;
}

.btn-action-invite {
  border: none;
  background: var(--janote-expense);
  color: var(--text-primary);
}

.btn-action-invite:not(:disabled):active {
  opacity: 0.8;
}

.danger-card {
  border: 1.5px solid rgba(248, 113, 113, 0.35);
  border-radius: 12px;
  padding: 12px 16px;
  background: rgba(248, 113, 113, 0.04);
}

.danger-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.danger-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.danger-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--janote-action);
}

.danger-desc {
  font-size: 12px;
  color: var(--text-secondary);
}

.btn-clear {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  background: var(--janote-action);
  color: var(--text-light);
  padding: 8px 16px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.15s;
}

.btn-clear:active {
  opacity: 0.8;
}

/* ── Invite form ─────────────────────────────────────────── */

.invite-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.invite-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid var(--border-primary);
  background: var(--bg-page);
  font-family: inherit;
  font-size: 14px;
  color: var(--text-primary);
}

.invite-input::placeholder {
  color: var(--text-disabled);
}

.invite-input:focus {
  outline: none;
  border-color: var(--text-primary);
}

/* ── Share lists ─────────────────────────────────────────── */

.group-header-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.group-header-count {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-card, #f5f5f5);
  padding: 2px 8px;
  border-radius: 20px;
}

.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  min-width: 0;
}

.share-info {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.share-from {
  font-size: 12px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.share-email {
  font-size: 14px;
  color: var(--text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.share-btns {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-sm {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  transition: opacity 0.2s;
}

.btn-sm:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-accept {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.btn-reject {
  background: var(--janote-action);
  color: var(--text-light);
}

.share-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 500;
  white-space: nowrap;
  flex-shrink: 0;
}

.share-badge--pending {
  background: rgba(71, 184, 224, 0.15);
  color: var(--janote-income);
}

.share-badge--active {
  background: rgba(34, 197, 94, 0.15);
  color: rgb(34, 197, 94);
}

/* ── Empty state ─────────────────────────────────────────── */

.empty-state {
  text-align: center;
  padding: 20px;
  color: var(--text-secondary);
  font-size: 14px;
  font-style: italic;
}
</style>
