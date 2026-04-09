<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import {
  loadAccounts,
  loadTransfers,
  saveAccounts,
  saveTransfers,
  getAccountBalance,
  getPrimaryAccount,
} from "../utils/accountStorage";
import type { Account, AccountTransfer, AccountBalanceSource } from "../types";

const route = useRoute();
const router = useRouter();

useSharedSwipeContext();

// ── 狀態 ─────────────────────────────────────────────────────
const accounts = ref<Account[]>([]);
const transfers = ref<AccountTransfer[]>([]);
const account = ref<Account | null>(null);

// ── 初始化 ────────────────────────────────────────────────────
onMounted(() => {
  accounts.value = loadAccounts();
  transfers.value = loadTransfers();
  const id = route.params.id as string;
  const found = accounts.value.find((a) => a.id === id);
  if (!found) {
    router.replace({ name: "accounts" });
    return;
  }
  account.value = found;
});

// ── 帳戶餘額 ──────────────────────────────────────────────────
const balance = computed(() =>
  account.value ? getAccountBalance(account.value, transfers.value) : 0
);

// ── 格式化金額（不顯示負號） ──────────────────────────────────
function formatAmount(amount: number): string {
  return `$${Math.max(amount, 0).toLocaleString()}`;
}

// ── 此帳戶的轉帳紀錄（依時間降冪） ───────────────────────────
const accountTransfers = computed(() => {
  if (!account.value) return [];
  return [...transfers.value]
    .filter(
      (t) =>
        t.fromAccountId === account.value!.id ||
        t.toAccountId === account.value!.id,
    )
    .sort((a, b) => b.date - a.date);
});

// ── 依日期分組 ────────────────────────────────────────────────
const groupedTransfers = computed(() => {
  const result: { dateKey: string; dateDisplay: string; items: AccountTransfer[] }[] = [];
  const map = new Map<string, AccountTransfer[]>();
  for (const t of accountTransfers.value) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const existing = map.get(key);
    if (existing) existing.push(t);
    else map.set(key, [t]);
  }
  for (const [key, items] of map.entries()) {
    const d = new Date(key);
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    result.push({
      dateKey: key,
      dateDisplay: `${d.getMonth() + 1}月${d.getDate()}日（週${weekdays[d.getDay()]}）`,
      items,
    });
  }
  return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
});

// ── 取得對方帳戶名稱 ──────────────────────────────────────────
function getCounterpartyName(t: AccountTransfer): string {
  if (!account.value) return "";
  const otherId = t.fromAccountId === account.value.id ? t.toAccountId : t.fromAccountId;
  return accounts.value.find((a) => a.id === otherId)?.name ?? "未知帳戶";
}

function isIncoming(t: AccountTransfer): boolean {
  return t.toAccountId === account.value?.id;
}

// ── 刪除轉帳 ──────────────────────────────────────────────────
const showDeleteTransferConfirm = ref(false);
const deletingTransferId = ref<string | null>(null);

function onDeleteTransfer(id: string) {
  deletingTransferId.value = id;
  showDeleteTransferConfirm.value = true;
}

function confirmDeleteTransfer() {
  if (deletingTransferId.value) {
    transfers.value = transfers.value.filter((t) => t.id !== deletingTransferId.value);
    saveTransfers(transfers.value);
  }
  showDeleteTransferConfirm.value = false;
  deletingTransferId.value = null;
}

function cancelDeleteTransfer() {
  showDeleteTransferConfirm.value = false;
  deletingTransferId.value = null;
}

// ── 新增轉帳 Modal（所有帳戶共用） ──────────────────────────
const primaryAccount = computed(() => getPrimaryAccount(accounts.value));
const nonPrimaryAccounts = computed(() => accounts.value.filter((a) => !a.isPrimary));

const showTransferModal = ref(false);
const showTransferCalendar = ref(false);
const transferAmount = ref("");
const transferDateMs = ref(Date.now());
const transferNote = ref("");
const transferError = ref("");
// 主帳戶專用：選擇目標子帳戶
const transferTargetId = ref("");

// 目標子帳戶餘額（主帳戶用）
const transferTargetBalance = computed(() => {
  if (!transferTargetId.value) return 0;
  const target = accounts.value.find((a) => a.id === transferTargetId.value);
  if (!target) return 0;
  return getAccountBalance(target, transfers.value);
});

const transferTargetName = computed(() => {
  if (!transferTargetId.value) return "";
  return accounts.value.find((a) => a.id === transferTargetId.value)?.name ?? "";
});

const transferDateDisplay = computed(() => {
  const d = new Date(transferDateMs.value);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（週${weekdays[d.getDay()]}）`;
});

function openTransferModal() {
  transferAmount.value = "";
  transferDateMs.value = Date.now();
  transferNote.value = "";
  transferError.value = "";
  // 主帳戶預設選第一個子帳戶
  if (account.value?.isPrimary) {
    transferTargetId.value = nonPrimaryAccounts.value[0]?.id ?? "";
  }
  showTransferModal.value = true;
}

function closeTransferModal() {
  showTransferModal.value = false;
}

function submitTransfer() {
  const amount = parseFloat(transferAmount.value);
  if (isNaN(amount) || amount <= 0) {
    transferError.value = "請輸入有效金額（必須大於 0）";
    return;
  }

  let fromId: string;
  let toId: string;

  if (account.value!.isPrimary) {
    // 主帳戶 → 子帳戶
    const targetId = transferTargetId.value;
    if (!targetId) {
      transferError.value = "請選擇目標帳戶";
      return;
    }
    const curBalance = getAccountBalance(account.value!, transfers.value);
    if (curBalance - amount < 0) {
      transferError.value = `主帳戶餘額不足（目前 ${formatAmount(curBalance)}）`;
      return;
    }
    fromId = account.value!.id;
    toId = targetId;
  } else {
    // 子帳戶 → 主帳戶
    if (!primaryAccount.value) {
      transferError.value = "找不到主帳戶";
      return;
    }
    const curBalance = getAccountBalance(account.value!, transfers.value);
    if (curBalance - amount < 0) {
      transferError.value = `本帳戶餘額不足（目前 ${formatAmount(curBalance)}）`;
      return;
    }
    fromId = account.value!.id;
    toId = primaryAccount.value.id;
  }

  const newTransfer: AccountTransfer = {
    id: `txf_${Date.now()}`,
    fromAccountId: fromId,
    toAccountId: toId,
    amount,
    date: transferDateMs.value,
    note: transferNote.value.trim(),
    createdAt: Date.now(),
  };
  transfers.value = [newTransfer, ...transfers.value];
  saveTransfers(transfers.value);
  closeTransferModal();
}

// ── 餘額來源管理（主帳戶用） ──────────────────────────────────
const balanceSources = computed(() => account.value?.balanceSources ?? []);

const sourcesTotal = computed(() =>
  balanceSources.value.reduce((sum, s) => sum + s.amount, 0)
);

function saveSourcesUpdate(newSources: AccountBalanceSource[]) {
  if (!account.value) return;
  const updated: Account = { ...account.value, balanceSources: newSources };
  account.value = updated;
  accounts.value = accounts.value.map((a) => (a.id === updated.id ? updated : a));
  saveAccounts(accounts.value);
}

// 新增 / 編輯來源 Modal
const showSourceModal = ref(false);
const sourceModalMode = ref<"add" | "edit">("add");
const sourceName = ref("");
const sourceAmountStr = ref("");
const sourceError = ref("");
let editingSourceId = "";

function openAddSourceModal() {
  sourceModalMode.value = "add";
  sourceName.value = "";
  sourceAmountStr.value = "";
  sourceError.value = "";
  showSourceModal.value = true;
}

function openEditSourceModal(source: AccountBalanceSource) {
  sourceModalMode.value = "edit";
  editingSourceId = source.id;
  sourceName.value = source.name;
  sourceAmountStr.value = String(source.amount);
  sourceError.value = "";
  showSourceModal.value = true;
}

function closeSourceModal() {
  showSourceModal.value = false;
}

function submitSource() {
  const name = sourceName.value.trim();
  if (!name) {
    sourceError.value = "請輸入來源名稱";
    return;
  }
  const amount = parseFloat(sourceAmountStr.value);
  if (isNaN(amount) || amount < 0) {
    sourceError.value = "金額不可為負數";
    return;
  }

  let newSources: AccountBalanceSource[];
  if (sourceModalMode.value === "add") {
    newSources = [
      ...balanceSources.value,
      { id: `src_${Date.now()}`, name, amount },
    ];
  } else {
    newSources = balanceSources.value.map((s) =>
      s.id === editingSourceId ? { ...s, name, amount } : s
    );
  }
  saveSourcesUpdate(newSources);
  closeSourceModal();
}

// 刪除來源 Confirm
const showDeleteSourceConfirm = ref(false);
let deletingSourceId = "";

function requestDeleteSource(id: string) {
  deletingSourceId = id;
  showDeleteSourceConfirm.value = true;
}

function confirmDeleteSource() {
  saveSourcesUpdate(balanceSources.value.filter((s) => s.id !== deletingSourceId));
  showDeleteSourceConfirm.value = false;
  deletingSourceId = "";
}

function cancelDeleteSource() {
  showDeleteSourceConfirm.value = false;
  deletingSourceId = "";
}
</script>

<template>
  <section class="detail-page">
    <!-- 頂部導覽列 -->
    <TopNavigation>
      <template #left>
        <NavBack />
      </template>
      <template #center>
        <span class="page-title">{{ account?.name ?? "帳戶" }}</span>
      </template>
    </TopNavigation>

    <div class="page-content" v-if="account">
      <!-- 餘額卡片 -->
      <div class="balance-card">
        <div class="balance-dot" :style="{ background: account.color }"></div>
        <div class="balance-main">
          <div class="balance-label">帳戶餘額</div>
          <div class="balance-amount">{{ formatAmount(balance) }}</div>
        </div>
        <div v-if="account.isPrimary" class="balance-sub">
          <div class="balance-label">來源數量</div>
          <div class="balance-sub-value">{{ balanceSources.length }} 筆</div>
        </div>
      </div>

      <!-- ─ 主帳戶：餘額來源清單 ─────────────────────────────── -->
      <section v-if="account.isPrimary" class="list-section">
        <div class="section-header-row">
          <span class="section-heading">餘額來源</span>
          <button class="btn-header-action" @click="openAddSourceModal">新增來源</button>
        </div>
        <ListGroup>
          <template #header-left>
            <span class="group-sub-title">合計 {{ formatAmount(sourcesTotal) }}</span>
          </template>
          <div v-if="balanceSources.length === 0" class="empty-state">
            <p>尚無餘額來源</p>
          </div>
          <ListItem
            v-for="source in balanceSources"
            :key="source.id"
            :swipeable="true"
            @edit="openEditSourceModal(source)"
            @delete="requestDeleteSource(source.id)"
            @item-click="openEditSourceModal(source)"
          >
            <div class="list-item-row">
              <span class="list-item-label">{{ source.name }}</span>
              <span class="list-item-value">{{ formatAmount(source.amount) }}</span>
            </div>
          </ListItem>
        </ListGroup>
      </section>

      <!-- ─ 轉帳紀錄（所有帳戶共用） ───────────────────────────── -->
      <section class="list-section">
        <div class="section-header-row">
          <span class="section-heading">轉帳紀錄</span>
          <button class="btn-header-action" @click="openTransferModal">新增轉帳</button>
        </div>
        <div v-if="accountTransfers.length > 0" class="transfer-groups">
          <ListGroup
            v-for="group in groupedTransfers"
            :key="group.dateKey"
          >
            <template #header-left>
              <span class="date-title">{{ group.dateDisplay }}</span>
            </template>
            <ListItem
              v-for="item in group.items"
              :key="item.id"
              :swipeable="true"
              :delete-only="true"
              @delete="onDeleteTransfer(item.id)"
            >
              <div class="transfer-item">
                <div class="transfer-left">
                  <div class="direction-badge" :class="isIncoming(item) ? 'in' : 'out'">
                    {{ isIncoming(item) ? "轉入" : "轉出" }}
                  </div>
                  <div class="transfer-info">
                    <span class="list-item-label">{{ getCounterpartyName(item) }}</span>
                    <span v-if="item.note" class="item-note">{{ item.note }}</span>
                  </div>
                </div>
                <div class="transfer-amount" :class="isIncoming(item) ? 'income' : 'expense'">
                  {{ isIncoming(item) ? "+" : "" }}{{ formatAmount(item.amount) }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
        <div v-if="accountTransfers.length === 0" class="empty-state">
          <p>暫無轉帳紀錄</p>
        </div>
      </section>
    </div>

    <!-- ── 新增/編輯餘額來源 Modal ──────────────────────────────── -->
    <Transition name="modal">
      <div v-if="showSourceModal" class="modal-overlay" @click="closeSourceModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">{{ sourceModalMode === "add" ? "新增來源" : "編輯來源" }}</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">來源名稱</label>
              <input
                v-model="sourceName"
                type="text"
                class="form-input"
                placeholder="例：玉山銀行"
                maxlength="20"
                @input="sourceError = ''"
              />
            </div>
            <div class="form-row">
              <label class="form-label">金額</label>
              <div class="amount-row">
                <span class="currency-sign">$</span>
                <input
                  v-model="sourceAmountStr"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  class="form-input amount-input"
                  placeholder="0"
                  @input="sourceError = ''"
                />
              </div>
            </div>
            <p v-if="sourceError" class="form-error">{{ sourceError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeSourceModal">取消</button>
            <button class="btn-confirm" @click="submitSource">儲存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- ── 新增轉帳 Modal ────────────────────────────────────── -->
    <Transition name="modal">
      <div v-if="showTransferModal" class="modal-overlay" @click="closeTransferModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">新增轉帳</h3>
          <div class="modal-body">
            <!-- 主帳戶：選擇子帳戶 + 子帳戶餘額 -->
            <div v-if="account!.isPrimary" class="form-row">
              <label class="form-label">轉出至</label>
              <select
                v-model="transferTargetId"
                class="form-input"
                @change="transferError = ''"
              >
                <option v-for="a in nonPrimaryAccounts" :key="a.id" :value="a.id">
                  {{ a.name }}
                </option>
              </select>
              <div v-if="transferTargetId" class="info-row">
                <span class="info-name">{{ transferTargetName }}</span>
                <span class="info-balance">{{ formatAmount(transferTargetBalance) }}</span>
              </div>
              <p v-if="nonPrimaryAccounts.length === 0" class="form-error">
                尚無子帳戶可選擇
              </p>
            </div>
            <!-- 非主帳戶：顯示轉入主帳戶資訊 -->
            <div v-if="!account!.isPrimary" class="form-row">
              <label class="form-label">轉入至</label>
              <div class="info-row">
                <span class="info-name">{{ primaryAccount?.name ?? "主帳戶" }}</span>
                <span class="info-balance">{{ formatAmount(primaryAccount ? getAccountBalance(primaryAccount, transfers) : 0) }}</span>
              </div>
            </div>
            <!-- 金額 -->
            <div class="form-row">
              <label class="form-label">金額</label>
              <div class="amount-row">
                <span class="currency-sign">$</span>
                <input
                  v-model="transferAmount"
                  type="number"
                  inputmode="numeric"
                  min="1"
                  class="form-input amount-input"
                  placeholder="0"
                  @input="transferError = ''"
                />
              </div>
            </div>
            <!-- 日期 -->
            <div class="form-row">
              <label class="form-label">日期</label>
              <button class="date-btn" @click="showTransferCalendar = true">
                {{ transferDateDisplay }}
              </button>
            </div>
            <!-- 備註 -->
            <div class="form-row">
              <label class="form-label">備註</label>
              <input
                v-model="transferNote"
                type="text"
                class="form-input"
                placeholder="選填"
                maxlength="50"
              />
            </div>
            <p v-if="transferError" class="form-error">{{ transferError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeTransferModal">取消</button>
            <button class="btn-confirm" @click="submitTransfer">確認轉帳</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- CalendarPicker（轉帳日期，置於 modal 外避免 z-index 問題） -->
    <CalendarPicker
      v-model:open="showTransferCalendar"
      v-model="transferDateMs"
    />

    <!-- 刪除來源確認 -->
    <ConfirmModal
      :show="showDeleteSourceConfirm"
      title="刪除餘額來源"
      message="確定要刪除此餘額來源嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDeleteSource"
      @cancel="cancelDeleteSource"
    />

    <!-- 刪除轉帳確認 -->
    <ConfirmModal
      :show="showDeleteTransferConfirm"
      title="刪除轉帳紀錄"
      message="確定要刪除這筆轉帳紀錄嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDeleteTransfer"
      @cancel="cancelDeleteTransfer"
    />
  </section>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: var(--bg-page, #f5f5f5);
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

/* ── 主內容 ──────────────────────────────────────────────────── */
.page-content {
  padding: 16px;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

/* ── 餘額卡片 ────────────────────────────────────────────────── */
.balance-card {
  background: var(--bg-elevated, #ffffff);
  border-radius: 12px;
  padding: 18px 20px;
  border: 2px solid var(--border-primary, #000);
  display: flex;
  align-items: center;
  gap: 14px;
}

.balance-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  flex-shrink: 0;
}

.balance-main {
  flex: 1;
}

.balance-label {
  font-size: 12px;
  color: var(--text-secondary, #888);
  margin-bottom: 3px;
}

.balance-amount {
  font-size: 26px;
  font-weight: 700;
  letter-spacing: -0.5px;
  color: var(--text-primary, #1a1a1a);
}

.balance-sub {
  text-align: right;
  flex-shrink: 0;
}

.balance-sub-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-secondary, #888);
}

/* ── 區段標題列 ──────────────────────────────────────────────── */
.list-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2px;
}

.section-heading {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.btn-header-action {
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

.btn-header-action:active {
  opacity: 0.8;
}

.group-sub-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #888);
}

/* ── 通用列表行 ──────────────────────────────────────────────── */
.list-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.list-item-label {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex: 1;
  min-width: 0;
}

.list-item-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  flex-shrink: 0;
}

/* ── 轉帳清單 ────────────────────────────────────────────────── */
.transfer-groups {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.date-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary);
}

.transfer-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  min-height: 56px;
  gap: 8px;
}

.transfer-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}

.direction-badge {
  flex-shrink: 0;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  letter-spacing: 0.3px;
  border: 1.5px solid;
}

.direction-badge.out {
  background: var(--janote-expense-light);
  color: var(--text-primary);
  border-color: var(--janote-expense);
}

.direction-badge.in {
  background: var(--janote-income-light);
  color: var(--text-primary);
  border-color: var(--janote-income);
}

.transfer-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.item-note {
  font-size: 12px;
  color: var(--text-secondary, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.transfer-amount {
  font-size: 16px;
  font-weight: 700;
  flex-shrink: 0;
}

.transfer-amount.income {
  color: var(--janote-income, #47B8E0);
}

.transfer-amount.expense {
  color: var(--janote-action, #F87171);
}

/* ── 空狀態 ──────────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 32px 0 16px;
  color: var(--text-secondary, #888);
  font-size: 14px;
}

/* ── Modal ───────────────────────────────────────────────────── */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-container {
  background: var(--bg-page);
  border-radius: 16px;
  padding: 24px;
  min-width: 280px;
  width: 85%;
  max-width: 380px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-title {
  margin: 0 0 16px;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-body {
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.modal-footer {
  display: flex;
  gap: 10px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary, #666);
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  font-size: 15px;
  border: 1.5px solid var(--border-primary, #000);
  border-radius: 10px;
  background: var(--bg-page, #fff);
  color: var(--text-primary, #1a1a1a);
  outline: none;
  box-sizing: border-box;
  transition: border-color 0.2s;
}

.form-input:focus {
  border-color: var(--janote-action, #F87171);
}

/* 金額輸入列 */
.amount-row {
  display: flex;
  align-items: center;
  border: 1.5px solid var(--border-primary, #000);
  border-radius: 10px;
  background: var(--bg-page, #fff);
  overflow: hidden;
  transition: border-color 0.2s;
}

.amount-row:focus-within {
  border-color: var(--janote-action, #F87171);
}

.currency-sign {
  padding: 0 10px;
  font-size: 15px;
  font-weight: 600;
  color: var(--text-secondary, #888);
  flex-shrink: 0;
}

.amount-input {
  border: none !important;
  border-radius: 0 !important;
  background: transparent !important;
  padding-left: 0 !important;
  flex: 1;
}

.amount-input:focus {
  border-color: transparent !important;
}

/* 資訊列（顯示主帳戶資訊） */
.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border: 1.5px solid var(--border, #e0e0e0);
  border-radius: 10px;
  background: var(--bg-page, #f9f9f9);
}

.info-name {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.info-balance {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary, #888);
}

/* 日期按鈕 */
.date-btn {
  width: 100%;
  padding: 10px 12px;
  text-align: left;
  font-size: 15px;
  font-weight: 400;
  color: var(--text-primary, #1a1a1a);
  background: var(--bg-page, #fff);
  border: 1.5px solid var(--border-primary, #000);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s;
  -webkit-tap-highlight-color: transparent;
}

.date-btn:active {
  border-color: var(--janote-action, #F87171);
}

.form-error {
  font-size: 12px;
  color: var(--janote-action, #F87171);
  margin: 0;
}

.btn-cancel,
.btn-confirm {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
}

.btn-cancel {
  background: var(--bg-hover, #f3f4f6);
  color: var(--text-secondary, #6b7280);
  border: 1.5px solid var(--border, #e5e7eb);
}

.btn-confirm {
  background: var(--text-primary, #1a1a1a);
  color: #fff;
}

.btn-cancel:active,
.btn-confirm:active {
  opacity: 0.75;
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
