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
const inviteError = ref("");
const operatingShareId = ref<string | null>(null);


// ── CSV ─────────────────────────────────────────────────────
const csvFileInput = ref<HTMLInputElement | null>(null);
const isImporting = ref(false);

// ── 通知 Modal ────────────────────────────────
const showNotifyModal = ref(false);
const notifyMessage = ref("");
function showNotify(msg: string) {
  notifyMessage.value = msg;
  showNotifyModal.value = true;
}

// ── ImportRow 型別（供匯入確認 Modal 共用）─────────────────
interface ImportRow {
  category_id: string;
  type: "EXPENSE" | "INCOME";
  amount: number;
  note: string;
  date: number;
}

// ── 匯入確認 Modal ─────────────────────────────────────────
const showImportConfirmModal = ref(false);
const importConfirmMain = ref("");
const importConfirmSkip = ref("");
const pendingImportRows = ref<ImportRow[]>([]);

// ── ConfirmModal ─────────────────────────────────────────────
const showClearModal = ref(false);

// ── 共享刪除確認 ────────────────────────────────────────────
const showShareDeleteModal = ref(false);
const pendingDeleteShare = ref<UserShare | null>(null);
const pendingDeleteAction = ref("");

function requestDeleteShare(share: UserShare, actionName: string) {
  pendingDeleteShare.value = share;
  pendingDeleteAction.value = actionName;
  showShareDeleteModal.value = true;
}

async function confirmShareDelete() {
  if (pendingDeleteShare.value) {
    await rejectOrCancelShare(pendingDeleteShare.value, pendingDeleteAction.value);
  }
  showShareDeleteModal.value = false;
  pendingDeleteShare.value = null;
}

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
  await parseCsvFile(file);
}

async function parseCsvFile(file: File) {
  isImporting.value = true;
  try {
    let text = await file.text();
    if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

    const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length < 2) {
      showNotify("匯入失敗：CSV 內容為空");
      return;
    }

    const headers = parseCsvLine(lines[0]!).map((h) => h.trim());
    const missingCols = REQUIRED_COLUMNS.filter(
      (col) => !headers.includes(col),
    );
    if (missingCols.length > 0) {
      showNotify(`匯入失敗：缺少必要欄位 [${missingCols.join("、")}]`);
      return;
    }

    const idx = {} as Record<CsvColKey, number>;
    for (const col of REQUIRED_COLUMNS) {
      idx[col] = headers.indexOf(col);
    }

    const myCategories = transactionStore.visibleCategories;
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
      showNotify(`匯入失敗：${reason}`);
      return;
    }

    pendingImportRows.value = validRows;
    importConfirmMain.value = `本次將新增 ${validRows.length} 筆交易，確認匯入？`;
    importConfirmSkip.value =
      skippedRows.length > 0
        ? `第 ${skippedRows.join("、")} 行因分類不符將被跳過`
        : "";
    showImportConfirmModal.value = true;
  } catch (err) {
    showNotify("匯入失敗：讀取 CSV 發生錯誤");
    console.error("CSV 匯入錯誤:", err);
  } finally {
    isImporting.value = false;
  }
}

async function confirmImport() {
  showImportConfirmModal.value = false;
  const rows = pendingImportRows.value;
  pendingImportRows.value = [];
  isImporting.value = true;
  try {
    for (const row of rows) {
      await transactionStore.addTransaction(row);
    }
    showNotify(`已成功匯入 ${rows.length} 筆交易，請執行同步以上傳資料`);
  } catch (err) {
    showNotify("匯入失敗：寫入資料時發生錯誤");
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

async function sendInvite(): Promise<boolean> {
  inviteError.value = "";
  const email = inviteEmail.value.trim();

  if (!email) {
    inviteError.value = "請輸入 Email 地址";
    return false;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    inviteError.value = "請輸入有效的 Email 地址";
    return false;
  }

  const existingInvite = userShareStore.sentPendingInvites.find(
    (invite) => invite.receiver_email === email,
  );
  if (existingInvite) {
    inviteError.value = "已經邀請過此 Email";
    return false;
  }

  isInviting.value = true;
  try {
    const user = userStore.currentUser;
    if (!user?.id || !user?.email) {
      inviteError.value = "無法取得使用者資訊";
      return false;
    }

    await userShareStore.sendInvite(user.id, user.email, email);
    await userShareStore.loadShares(userStore.currentUserId);
    inviteEmail.value = "";
    return true;
  } catch (error) {
    inviteError.value = "發送邀請失敗，請稍後再試";
    console.error("發送邀請失敗:", error);
    return false;
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
  } catch (error) {
    showNotify("接受邀請失敗");
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
  } catch (error) {
    showNotify(`${actionName}失敗`);
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

// ── 新增邀請 Modal ────────────────────────────────────────
const showInviteModal = ref(false);

function openInviteModal() {
  inviteEmail.value = "";
  inviteError.value = "";
  showInviteModal.value = true;
}

async function handleInviteConfirm() {
  const success = await sendInvite();
  if (success) {
    showInviteModal.value = false;
  }
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

      <!-- ── 個人管理 ────────────────────────────────────── -->
      <section class="section">
        <h2 class="section-label">個人管理</h2>
        <div class="card">
          <!-- 電子信箱 -->
          <div class="info-email">{{ userStore.currentUserEmail || "—" }}</div>

          <!-- 同步資訊 -->
          <div class="info-meta-list">
            <div class="info-meta-row">
              <span class="info-meta-label">尚未同步數量</span>
              <span class="info-meta-value">{{ syncStore.activeQueueCount }}</span>
            </div>
            <div class="info-meta-row">
              <span class="info-meta-label">最後同步游標</span>
              <span class="info-meta-value">{{ syncStore.lastCursor }}</span>
            </div>
            <div class="info-meta-row">
              <span class="info-meta-label">最後同步時間</span>
              <span class="info-meta-value">{{ syncStore.lastSyncAt || "—" }}</span>
            </div>
          </div>

          <!-- 2×2 按鈕格線 -->
          <div class="btn-grid">
            <!-- 立即同步 -->
            <button
              class="btn-grid-item btn-grid-sync"
              :disabled="!syncStatusStore.canSync"
              @click="syncNow"
            >
              {{ syncStatusStore.status === 'syncing' ? '同步中…' : '立即同步' }}
            </button>

            <!-- 清空本機（僅非共享模式） -->
            <button
              v-if="!userStore.isViewingShared"
              class="btn-grid-item btn-grid-clear"
              @click="showClearModal = true"
            >
              清空本機
            </button>

            <!-- 匯入資料（僅非共享模式） -->
            <button
              v-if="!userStore.isViewingShared"
              class="btn-grid-item btn-grid-import"
              :disabled="isImporting"
              @click="triggerCsvImport"
            >
              {{ isImporting ? "匯入中…" : "匯入資料" }}
            </button>

            <!-- 匯出資料（僅非共享模式） -->
            <button
              v-if="!userStore.isViewingShared"
              class="btn-grid-item btn-grid-export"
              :disabled="isImporting"
              @click="exportCsv"
            >
              匯出資料
            </button>
          </div>

          <input
            ref="csvFileInput"
            type="file"
            accept=".csv,text/csv"
            style="display: none"
            @change="handleCsvImport"
          />
        </div>
      </section>

      <!-- ── 共享管理 ────────────────────────────────────── -->
      <section class="section">
        <h2 class="section-label">共享管理</h2>

        <ListGroup>
          <template #header-left>
            <span class="group-header-title">管理清單</span>
          </template>
          <template #header-right>
            <button class="btn-invite" @click="openInviteModal">新增邀請</button>
          </template>

          <!-- 收到的邀請（尚未接受）→ 顯示接受/取消按鈕 -->
          <ListItem
            v-for="share in userShareStore.receivedPendingInvites"
            :key="share.id"
          >
            <div class="share-row">
              <span class="share-email">{{ share.sender_email }}</span>
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
                  取消
                </button>
              </div>
            </div>
          </ListItem>

          <!-- 發出的邀請（邀請中）→ 藍色徽章，可滑動刪除 -->
          <ListItem
            v-for="share in userShareStore.sentPendingInvites"
            :key="share.id"
            :swipeable="true"
            :delete-only="true"
            @delete="requestDeleteShare(share, '取消邀請')"
          >
            <div class="share-row">
              <span class="share-email">{{ share.receiver_email }}</span>
              <span class="share-badge share-badge--pending">邀請中</span>
            </div>
          </ListItem>

          <!-- 已啟用的共享 → 綠色徽章，可滑動刪除 -->
          <ListItem
            v-for="share in userShareStore.activeShares"
            :key="share.id"
            :swipeable="true"
            :delete-only="true"
            @delete="requestDeleteShare(share, '刪除共享')"
          >
            <div class="share-row">
              <span class="share-email">{{ getShareOtherEmail(share) }}</span>
              <span class="share-badge share-badge--active">已啟用</span>
            </div>
          </ListItem>

          <!-- 空清單提示 -->
          <div
            v-if="
              userShareStore.receivedPendingInvites.length === 0 &&
              userShareStore.sentPendingInvites.length === 0 &&
              userShareStore.activeShares.length === 0
            "
            class="share-empty"
          >
            尚無共享記錄
          </div>
        </ListGroup>
      </section>
    </div>

    <!-- ── 清空本機確認 Modal ───────────────────────────── -->
    <ConfirmModal
      :show="showClearModal"
      title="清空本機資料"
      message="確定要清空所有本地資料嗎？此操作無法復原。"
      confirm-text="清空"
      variant="danger"
      @confirm="clearAllData"
      @cancel="showClearModal = false"
    />

    <!-- ── 共享刪除確認 Modal ───────────────────────────── -->
    <ConfirmModal
      :show="showShareDeleteModal"
      :title="pendingDeleteAction"
      :message="`確定要${pendingDeleteAction}嗎？`"
      confirm-text="確認"
      variant="danger"
      @confirm="confirmShareDelete"
      @cancel="showShareDeleteModal = false"
    />

    <!-- ── 新增邀請 Modal ──────────────────────────────── -->
    <ConfirmModal
      :show="showInviteModal"
      title="新增邀請"
      confirm-text="送出"
      :cancel-text="'取消'"
      @confirm="handleInviteConfirm"
      @cancel="showInviteModal = false"
    >
      <input
        v-model="inviteEmail"
        type="email"
        class="invite-input"
        placeholder="輸入要邀請的 Email"
        @keyup.enter="handleInviteConfirm"
      />
      <p v-if="inviteError" class="invite-error">{{ inviteError }}</p>
    </ConfirmModal>
    <!-- ── 匯入確認 Modal ──────────────────────────────── -->
    <ConfirmModal
      :show="showImportConfirmModal"
      title="確認匯入"
      confirm-text="匯入"
      @confirm="confirmImport"
      @cancel="showImportConfirmModal = false"
    >
      <p class="csv-confirm-main">{{ importConfirmMain }}</p>
      <p v-if="importConfirmSkip" class="csv-confirm-skip">{{ importConfirmSkip }}</p>
    </ConfirmModal>

    <!-- ── 通知 Modal ──────────────────────── -->
    <ConfirmModal
      :show="showNotifyModal"
      title="提示"
      :message="notifyMessage"
      confirm-text="確認"
      cancel-text=""
      @confirm="showNotifyModal = false"
      @cancel="showNotifyModal = false"
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
  font-size: 16px;
  font-weight: 700;
  margin: 0;
  padding: 0 2px;
}

/* ── Card ────────────────────────────────────────────────── */

.card {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

/* ── 個人管理：電子信箱 ──────────────────────────────── */

.info-email {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ── 個人管理：同步資訊 ──────────────────────────────── */

.info-meta-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.info-meta-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.info-meta-label {
  font-size: 13px;
  color: var(--text-secondary);
  white-space: nowrap;
  flex-shrink: 0;
}

.info-meta-value {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: right;
}

/* ── 個人管理：2×2 按鈕格線 ──────────────────────────── */

.btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.btn-grid-item {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  padding: 10px 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: opacity 0.15s;
}

.btn-grid-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-grid-item:not(:disabled):active {
  opacity: 0.8;
}

.btn-grid-sync {
  background: var(--janote-expense);
  color: var(--text-primary);
}

.btn-grid-clear {
  background: var(--janote-action);
  color: var(--text-light);
}

.btn-grid-import {
  background: var(--janote-income);
  color: var(--text-light);
}

.btn-grid-export {
  background: var(--janote-income);
  color: var(--text-light);
}

/* ── 共享管理：Header ────────────────────────────────── */

.group-header-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.btn-invite {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  background: var(--janote-expense);
  color: var(--text-primary);
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-invite:active {
  opacity: 0.8;
}

/* ── 共享管理：列表 Item ─────────────────────────────── */

.share-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  gap: 12px;
  min-width: 0;
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

/* ── 共享徽章（有邊框，無 icon） ──────────────────────── */

.share-badge {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 20px;
  font-weight: 600;
  white-space: nowrap;
  flex-shrink: 0;
  border: 2px solid;
}

.share-badge--pending {
  background: var(--janote-income-light, rgba(71, 184, 224, 0.12));
  border-color: var(--janote-income);
  color: var(--janote-income);
}

.share-badge--active {
  background: #dcfce7;
  border-color: #16a34a;
  color: #16a34a;
}

/* ── 共享管理：空狀態 ────────────────────────────────── */

.share-empty {
  padding: 20px 16px;
  text-align: center;
  font-size: 13px;
  color: var(--text-secondary);
}

/* ── 新增邀請 Modal：Input ────────────────────────────── */

.invite-input {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 14px;
  border-radius: 10px;
  border: 2px solid var(--border-primary);
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

/* ── 新增邀請 Modal：驗證錯誤訊息 ──────────────────────── */

.invite-error {
  margin: 8px 0 0;
  font-size: 13px;
  color: var(--janote-action, #ef4444);
  text-align: center;
}

/* ── CSV 確認 Modal：文字 ────────────────────────────── */

.csv-confirm-main {
  margin: 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.csv-confirm-skip {
  margin: 6px 0 0;
  text-align: center;
  color: var(--text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
