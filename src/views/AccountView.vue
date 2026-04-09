<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import DonutChart, { type DonutSlice } from "../components/DonutChart.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import {
  ensurePrimaryAccount,
  loadTransfers,
  saveAccounts,
  saveTransfers,
  getAccountBalance,
  nextAccountColor,
} from "../utils/accountStorage";
import type { Account } from "../types";

const router = useRouter();

useSharedSwipeContext();

// ── 狀態 ─────────────────────────────────────────────────────
const accounts = ref<Account[]>([]);
const transfers = ref(loadTransfers());

// ── 計算各帳戶餘額 ────────────────────────────────────────────
const accountBalances = computed(() =>
  accounts.value.map((acc) => ({
    account: acc,
    balance: getAccountBalance(acc, transfers.value),
  }))
);

// ── 總資產 ────────────────────────────────────────────────────
const totalBalance = computed(() =>
  accountBalances.value.reduce((sum, { balance }) => sum + balance, 0)
);

// ── DonutChart 切片 ───────────────────────────────────────────
const donutSlices = computed<DonutSlice[]>(() =>
  accountBalances.value.map(({ account, balance }) => ({
    sliceLabel: account.name,
    sliceValue: Math.max(balance, 0.01),
    sliceColor: account.color,
  }))
);

// ── 初始化 ────────────────────────────────────────────────────
onMounted(() => {
  accounts.value = ensurePrimaryAccount();
  transfers.value = loadTransfers();
});

// ── 格式化金額（不顯示負號） ──────────────────────────────────
function formatAmount(amount: number): string {
  return `$${Math.max(amount, 0).toLocaleString()}`;
}

// ── 導航至帳戶明細 ────────────────────────────────────────────
function goToDetail(accountId: string) {
  router.push({ name: "account-detail", params: { id: accountId } });
}

// ── 建立帳戶 Modal ─────────────────────────────────────────────
const showCreateModal = ref(false);
const createName = ref("");
const createError = ref("");

function openCreateModal() {
  createName.value = "";
  createError.value = "";
  showCreateModal.value = true;
}

function closeCreateModal() {
  showCreateModal.value = false;
}

function submitCreateAccount() {
  const name = createName.value.trim();
  if (!name) {
    createError.value = "請輸入帳戶名稱";
    return;
  }
  const newAccount: Account = {
    id: `acc_${Date.now()}`,
    name,
    color: nextAccountColor(accounts.value),
    isPrimary: false,
    createdAt: Date.now(),
  };
  accounts.value = [...accounts.value, newAccount];
  saveAccounts(accounts.value);
  closeCreateModal();
}

// ── 編輯非主帳戶名稱 Modal ─────────────────────────────────────
const showEditNameModal = ref(false);
const editNameValue = ref("");
const editNameError = ref("");
let editNameAccountId = "";

function openEditNameModal(account: Account) {
  editNameAccountId = account.id;
  editNameValue.value = account.name;
  editNameError.value = "";
  showEditNameModal.value = true;
}

function closeEditNameModal() {
  showEditNameModal.value = false;
}

function submitEditName() {
  const name = editNameValue.value.trim();
  if (!name) {
    editNameError.value = "請輸入帳戶名稱";
    return;
  }
  accounts.value = accounts.value.map((a) =>
    a.id === editNameAccountId ? { ...a, name } : a
  );
  saveAccounts(accounts.value);
  closeEditNameModal();
}

// ── 刪除非主帳戶 ──────────────────────────────────────────────
const showDeleteModal = ref(false);
let deleteAccountId = "";

function requestDelete(account: Account) {
  deleteAccountId = account.id;
  showDeleteModal.value = true;
}

function confirmDeleteAccount() {
  const remaining = transfers.value.filter(
    (t) => t.fromAccountId !== deleteAccountId && t.toAccountId !== deleteAccountId
  );
  transfers.value = remaining;
  accounts.value = accounts.value.filter((a) => a.id !== deleteAccountId);
  saveAccounts(accounts.value);
  saveTransfers(remaining);
  showDeleteModal.value = false;
}

function cancelDeleteAccount() {
  showDeleteModal.value = false;
}

// ── 清除本機資料 ─────────────────────────────────────────────
const showClearLocalModal = ref(false);

function clearLocalData() {
  saveAccounts([]);
  saveTransfers([]);
  accounts.value = ensurePrimaryAccount();
  transfers.value = loadTransfers();
  showClearLocalModal.value = false;
}
</script>

<template>
  <section class="account-page">
    <TopNavigation>
      <template #left>
        <NavMenu />
      </template>
      <template #center>
        <span class="page-title">帳戶</span>
      </template>
    </TopNavigation>

    <div class="page-content">
      <!-- DonutChart 總覽 -->
      <div class="chart-card">
        <DonutChart
          centerLabel="總資產"
          :centerBalance="formatAmount(totalBalance)"
          :slices="donutSlices"
        />
      </div>

      <!-- 本機資料說明卡片 -->
      <div class="local-info-card">
        <p class="local-info-text">
          帳戶為測試功能，所有資料僅儲存於本機裝置，<strong>不會同步至雲端資料庫</strong>。清除後，所有帳戶與轉帳紀錄將從本機移除，此操作無法復原。
        </p>
        <button class="btn-clear-local" @click="showClearLocalModal = true">
          清除本機資料
        </button>
      </div>

      <!-- 帳戶列表 -->
      <ListGroup>
        <template #header-left>
          <span class="group-header-title">帳戶清單</span>
        </template>
        <template #header-right>
          <button class="btn-add-account" @click="openCreateModal">新增帳戶</button>
        </template>
        <ListItem
          v-for="{ account, balance } in accountBalances"
          :key="account.id"
          :swipeable="!account.isPrimary"
          @edit="openEditNameModal(account)"
          @delete="requestDelete(account)"
          @item-click="goToDetail(account.id)"
        >
          <div
            class="account-row"
            :class="{ 'account-row--clickable': account.isPrimary }"
            @click="account.isPrimary ? goToDetail(account.id) : undefined"
          >
            <div class="account-color-dot" :style="{ background: account.color }"></div>
            <div class="account-info">
              <span class="account-name">{{ account.name }}</span>
              <span v-if="account.isPrimary" class="primary-badge">主</span>
            </div>
            <div class="account-balance">
              {{ formatAmount(balance) }}
            </div>
          </div>
        </ListItem>
      </ListGroup>
    </div>

    <!-- 新增帳戶 Modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">新增帳戶</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">帳戶名稱</label>
              <input
                v-model="createName"
                type="text"
                class="form-input"
                placeholder="例：定存帳戶"
                maxlength="20"
                @input="createError = ''"
              />
            </div>
            <p v-if="createError" class="form-error">{{ createError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeCreateModal">取消</button>
            <button class="btn-confirm" @click="submitCreateAccount">建立帳戶</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 編輯帳戶名稱 Modal -->
    <Transition name="modal">
      <div v-if="showEditNameModal" class="modal-overlay" @click="closeEditNameModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">編輯帳戶</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">帳戶名稱</label>
              <input
                v-model="editNameValue"
                type="text"
                class="form-input"
                maxlength="20"
                @input="editNameError = ''"
              />
            </div>
            <p v-if="editNameError" class="form-error">{{ editNameError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeEditNameModal">取消</button>
            <button class="btn-confirm" @click="submitEditName">儲存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 刪除帳戶確認 -->
    <ConfirmModal
      :show="showDeleteModal"
      title="刪除帳戶"
      message="確定要刪除此帳戶嗎？所有相關轉帳紀錄也將一併刪除，此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDeleteAccount"
      @cancel="cancelDeleteAccount"
    />

    <!-- 清除本機資料確認 -->
    <ConfirmModal
      :show="showClearLocalModal"
      title="清除本機資料"
      message="確定要清除所有帳戶及轉帳紀錄嗎？此操作無法復原。"
      confirm-text="清除"
      cancel-text="取消"
      variant="danger"
      @confirm="clearLocalData"
      @cancel="showClearLocalModal = false"
    />
  </section>
</template>

<style scoped>
.account-page {
  min-height: 100vh;
  background: var(--bg-page, #f5f5f5);
}

.page-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
}

.page-content {
  padding: 16px;
  padding-bottom: 60px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.chart-card {
  background: var(--bg-elevated, #ffffff);
  border-radius: 12px;
  padding: 16px 8px;
}

.account-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
}

.account-row--clickable {
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
}

.account-row--clickable:active {
  background: var(--bg-hover, rgba(0, 0, 0, 0.04));
}

.account-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.account-info {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 7px;
  min-width: 0;
}

.account-name {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.primary-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--border-primary, #000);
  color: #fff;
  letter-spacing: 0.3px;
}

.account-balance {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
  flex-shrink: 0;
}

.group-header-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.btn-add-account {
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

.btn-add-account:active {
  opacity: 0.8;
}

/* ── 本機資料說明卡片 ─────────────────────────────────────── */

.local-info-card {
  background: var(--bg-page);
  border: 2px solid var(--border-primary);
  border-radius: 12px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.local-info-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
}

.btn-clear-local {
  font-family: inherit;
  border: none;
  border-radius: 8px;
  background: var(--janote-action);
  color: var(--text-light);
  padding: 10px 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.15s;
  width: 100%;
}

.btn-clear-local:active {
  opacity: 0.8;
}

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
