<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavMenu from "../components/NavMenu.vue";
import DonutChart, { type DonutSlice } from "../components/DonutChart.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import TypeToggle from "../components/TypeToggle.vue";
import {
  loadAccounts,
  loadTransfers,
  saveAccounts,
  getAccountBalance,
  getNetAllocated,
  getLogicalBalance,
  nextPhysicalColor,
  nextLogicalColor,
} from "../utils/accountStorage";
import type { Account } from "../types";

const router = useRouter();
const route = useRoute();

useSharedSwipeContext();

// ── 狀態 ─────────────────────────────────────────────────────
const accounts = ref<Account[]>([]);
const transfers = ref(loadTransfers());
const viewMode = ref<"physical" | "logical">("physical");

// ── 初始化 ────────────────────────────────────────────────────
onMounted(() => {
  accounts.value = loadAccounts();
  transfers.value = loadTransfers();
  const t = route.query.type;
  if (t === "physical" || t === "logical") viewMode.value = t;
  // 初始化時將目前 tab 同步至 URL
  if (!route.query.type) router.replace({ query: { type: viewMode.value } });
});

// ── URL 同步：切換 tab 時更新 query string ────────────────────
watch(viewMode, (val) => {
  router.replace({ query: { type: val } });
});

// ── 過濾帳戶 ──────────────────────────────────────────────────
const physicalAccounts = computed(() =>
  accounts.value.filter((a) => a.accountType === "physical"),
);
const logicalAccounts = computed(() =>
  accounts.value.filter((a) => a.accountType === "logical"),
);

// ── DonutChart 實體：以 amount 為切片大小 ────────────────────
const physicalDonutSlices = computed<DonutSlice[]>(() =>
  physicalAccounts.value.map((acc) => ({
    sliceLabel: acc.name,
    sliceValue: Math.max(acc.amount, 0.01),
    sliceColor: acc.color,
  })),
);

// ── DonutChart 邏輯：以 logicalBalance 為切片大小 ────────────
const logicalDonutSlices = computed<DonutSlice[]>(() =>
  logicalAccounts.value.map((acc) => ({
    sliceLabel: acc.name,
    sliceValue: Math.max(getLogicalBalance(acc, transfers.value), 0.01),
    sliceColor: acc.color,
  })),
);

const physicalTotal = computed(() =>
  physicalAccounts.value.reduce((sum, a) => sum + a.amount, 0),
);
const logicalTotal = computed(() =>
  logicalAccounts.value.reduce(
    (sum, a) => sum + getLogicalBalance(a, transfers.value),
    0,
  ),
);

// ── 格式化金額 ────────────────────────────────────────────────
function fmt(amount: number): string {
  return `$${Math.max(amount, 0).toLocaleString()}`;
}

// ── 導航至帳戶明細 ────────────────────────────────────────────
function goToDetail(accountId: string) {
  router.push({ name: "account-detail", params: { id: accountId } });
}

// ── 新增帳戶 Modal ─────────────────────────────────────────────
const showCreateModal = ref(false);
const createName = ref("");
const createAmountStr = ref("");
const createError = ref("");

function openCreateModal() {
  createName.value = "";
  createAmountStr.value = "";
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

  if (viewMode.value === "physical") {
    const amount = parseFloat(createAmountStr.value);
    if (isNaN(amount) || amount < 0) {
      createError.value = "請輸入有效金額（不可為負數）";
      return;
    }
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      name,
      accountType: "physical",
      amount,
      color: nextPhysicalColor(accounts.value),
      createdAt: Date.now(),
    };
    accounts.value = [...accounts.value, newAccount];
  } else {
    const newAccount: Account = {
      id: `acc_${Date.now()}`,
      name,
      accountType: "logical",
      amount: 0,
      color: nextLogicalColor(accounts.value),
      createdAt: Date.now(),
    };
    accounts.value = [...accounts.value, newAccount];
  }

  saveAccounts(accounts.value);
  closeCreateModal();
}

// ── 編輯帳戶名稱 Modal ─────────────────────────────────────────
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
    a.id === editNameAccountId ? { ...a, name } : a,
  );
  saveAccounts(accounts.value);
  closeEditNameModal();
}

// ── 刪除帳戶 ─────────────────────────────────────────────────
const showDeleteModal = ref(false);
const showDeleteBlockModal = ref(false);
const deleteBlockReason = ref("");
let deleteAccountId = "";

function requestDelete(account: Account) {
  const bal = getAccountBalance(account, transfers.value);
  const net = getNetAllocated(account.id, transfers.value);

  if (account.accountType === "physical") {
    if (account.amount > 0 || net > 0) {
      deleteBlockReason.value =
        account.amount > 0
          ? `此實體帳戶仍有餘額 ${fmt(account.amount)}，無法刪除。請先清空餘額。`
          : `此實體帳戶仍有 ${fmt(net)} 分配給邏輯帳戶，無法刪除。請先讓邏輯帳戶轉回。`;
      showDeleteBlockModal.value = true;
      return;
    }
  } else {
    if (bal > 0) {
      deleteBlockReason.value = `此邏輯帳戶仍有餘額 ${fmt(bal)}，無法刪除。請先轉回實體帳戶。`;
      showDeleteBlockModal.value = true;
      return;
    }
  }

  deleteAccountId = account.id;
  showDeleteModal.value = true;
}

function confirmDelete() {
  accounts.value = accounts.value.filter((a) => a.id !== deleteAccountId);
  saveAccounts(accounts.value);
  showDeleteModal.value = false;
}

function cancelDelete() {
  showDeleteModal.value = false;
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
      <!-- 帳戶類型切換 Tab -->
      <div class="tab-row">
        <TypeToggle
          v-model="viewMode"
          leftLabel="實體"
          rightLabel="邏輯"
          leftValue="physical"
          rightValue="logical"
        />
      </div>

      <!-- DonutChart 總覽 -->
      <div class="chart-card">
        <DonutChart
          :centerLabel="viewMode === 'physical' ? '實體總額' : '邏輯總額'"
          :centerBalance="viewMode === 'physical' ? fmt(physicalTotal) : fmt(logicalTotal)"
          :slices="viewMode === 'physical' ? physicalDonutSlices : logicalDonutSlices"
        />
      </div>

      <!-- 實體帳戶清單 -->
      <ListGroup v-if="viewMode === 'physical'">
        <template #header-left>
          <span class="group-header-title">實體帳戶</span>
        </template>
        <template #header-right>
          <button class="btn-add-account" @click="openCreateModal">新增</button>
        </template>
        <div v-if="physicalAccounts.length === 0" class="empty-state">
          <p>尚無實體帳戶</p>
        </div>
        <ListItem
          v-for="acc in physicalAccounts"
          :key="acc.id"
          :swipeable="true"
          @edit="openEditNameModal(acc)"
          @delete="requestDelete(acc)"
          @item-click="goToDetail(acc.id)"
        >
          <div class="account-row">
            <div class="account-color-dot" :style="{ background: acc.color }"></div>
            <div class="account-info">
              <span class="account-name">{{ acc.name }}</span>

            </div>
            <div class="account-amounts">
              <span class="account-amount">{{ fmt(acc.amount) }}</span>
              <span class="account-balance-hint">可用 {{ fmt(getAccountBalance(acc, transfers)) }}</span>
            </div>
          </div>
        </ListItem>
      </ListGroup>

      <!-- 邏輯帳戶清單 -->
      <ListGroup v-if="viewMode === 'logical'">
        <template #header-left>
          <span class="group-header-title">邏輯帳戶</span>
        </template>
        <template #header-right>
          <button class="btn-add-account logical" @click="openCreateModal">新增</button>
        </template>
        <div v-if="logicalAccounts.length === 0" class="empty-state">
          <p>尚無邏輯帳戶</p>
        </div>
        <ListItem
          v-for="acc in logicalAccounts"
          :key="acc.id"
          :swipeable="true"
          @edit="openEditNameModal(acc)"
          @delete="requestDelete(acc)"
          @item-click="goToDetail(acc.id)"
        >
          <div class="account-row">
            <div class="account-color-dot" :style="{ background: acc.color }"></div>
            <div class="account-info">
              <span class="account-name">{{ acc.name }}</span>

            </div>
            <div class="account-amounts">
              <span class="account-amount">{{ fmt(getAccountBalance(acc, transfers)) }}</span>
            </div>
          </div>
        </ListItem>
      </ListGroup>
    </div>

    <!-- 新增帳戶 Modal -->
    <Transition name="modal">
      <div v-if="showCreateModal" class="modal-overlay" @click="closeCreateModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">{{ viewMode === 'physical' ? '新增實體帳戶' : '新增邏輯帳戶' }}</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">帳戶名稱</label>
              <input
                v-model="createName"
                type="text"
                class="form-input"
                :placeholder="viewMode === 'physical' ? '例：玉山銀行' : '例：旅遊基金'"
                maxlength="20"
                @input="createError = ''"
              />
            </div>
            <div v-if="viewMode === 'physical'" class="form-row">
              <label class="form-label">初始金額</label>
              <div class="amount-row">
                <span class="currency-sign">$</span>
                <input
                  v-model="createAmountStr"
                  type="number"
                  inputmode="decimal"
                  min="0"
                  class="form-input amount-input"
                  placeholder="0"
                  @input="createError = ''"
                />
              </div>
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
          <h3 class="modal-title">編輯帳戶名稱</h3>
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
      message="確定要刪除此帳戶嗎？此操作無法復原。"
      confirm-text="刪除"
      cancel-text="取消"
      variant="danger"
      @confirm="confirmDelete"
      @cancel="cancelDelete"
    />

    <!-- 刪除被阻止提示 -->
    <ConfirmModal
      :show="showDeleteBlockModal"
      title="無法刪除"
      :message="deleteBlockReason"
      confirm-text="知道了"
      cancel-text=""
      variant="danger"
      @confirm="showDeleteBlockModal = false"
      @cancel="showDeleteBlockModal = false"
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

/* ── Tab 切換列 ──────────────────────────────────────────────── */
.tab-row {
  display: flex;
  justify-content: flex-end;
}

/* ── 圖表卡片 ────────────────────────────────────────────────── */
.chart-card {
  background: var(--bg-elevated, #ffffff);
  border-radius: 12px;
  padding: 16px 8px;
}

/* ── 帳戶列 ──────────────────────────────────────────────────── */
.account-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
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

.account-amounts {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  flex-shrink: 0;
  gap: 2px;
}

.account-amount {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary, #1a1a1a);
}

.account-balance-hint {
  font-size: 11px;
  color: var(--text-secondary, #888);
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

.btn-add-account.logical {
  background: var(--janote-income);
  color: var(--text-light);
}

.btn-add-account:active {
  opacity: 0.8;
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
  border-color: var(--janote-action, #f87171);
}

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
  border-color: var(--janote-action, #f87171);
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

.form-error {
  font-size: 12px;
  color: var(--janote-action, #f87171);
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
