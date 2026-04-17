<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import TopNavigation from "../components/TopNavigation.vue";
import NavBack from "../components/NavBack.vue";
import TypeToggle from "../components/TypeToggle.vue";
import DonutChart, { type DonutSlice } from "../components/DonutChart.vue";
import ListGroup, { useSharedSwipeContext } from "../components/ListGroup.vue";
import ListItem from "../components/ListItem.vue";
import ConfirmModal from "../components/ConfirmModal.vue";
import CalendarPicker from "../components/CalendarPicker.vue";
import {
  loadAccounts,
  loadTransfers,
  saveAccounts,
  saveTransfers,
  getPhysicalBalance,
  getLogicalBalance,
  getNetAllocated,
  getLogicalAllocations,
  getPhysicalSources,
  getTransferSourceIds,
} from "../utils/accountStorage";
import type { Account, AccountTransfer } from "../types";

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
  if (!found) { router.replace({ name: "accounts" }); return; }
  account.value = found;
  transferViewMode.value = found.accountType === "logical" ? "logical" : "physical";
});

// 返回上一頁（依帳戶類型還原正確 tab）
function goBack() {
  const type = account.value?.accountType ?? "physical";
  router.push({ name: "accounts", query: { type } });
}

// ── 餘額計算 ─────────────────────────────────────────────────────
const physicalBalance = computed(() =>
  account.value?.accountType === "physical"
    ? getPhysicalBalance(account.value, transfers.value)
    : 0,
);

const logicalBalance = computed(() =>
  account.value?.accountType === "logical"
    ? getLogicalBalance(account.value, transfers.value)
    : 0,
);

// ── 實體帳戶：分配概況 ─────────────────────────────────────────
const allocations = computed(() =>
  account.value?.accountType === "physical"
    ? getLogicalAllocations(account.value.id, transfers.value, accounts.value)
    : [],
);

// ── 邏輯帳戶：資金來源 ─────────────────────────────────────────
const physicalSources = computed(() =>
  account.value?.accountType === "logical"
    ? getPhysicalSources(account.value.id, transfers.value, accounts.value)
    : [],
);

// ── DonutChart 資料 ───────────────────────────────────────────
const detailDonutSlices = computed<DonutSlice[]>(() => {
  if (!account.value) return [];
  if (account.value.accountType === "physical") {
    const slices: DonutSlice[] = allocations.value.map((e) => ({
      sliceLabel: e.accountName,
      sliceValue: Math.max(e.net, 0.01),
      sliceColor: accounts.value.find((a) => a.id === e.accountId)?.color ?? "#94A3B8",
    }));
    if (physicalBalance.value > 0)
      slices.push({ sliceLabel: "未分配", sliceValue: physicalBalance.value, sliceColor: "#E2E8F0" });
    if (slices.length === 0)
      slices.push({ sliceLabel: account.value.name, sliceValue: 0.01, sliceColor: account.value.color });
    return slices;
  } else {
    const slices: DonutSlice[] = physicalSources.value.map((s) => ({
      sliceLabel: s.accountName,
      sliceValue: Math.max(s.net, 0.01),
      sliceColor: accounts.value.find((a) => a.id === s.accountId)?.color ?? "#94A3B8",
    }));
    if (slices.length === 0)
      slices.push({ sliceLabel: account.value.name, sliceValue: 0.01, sliceColor: account.value.color });
    return slices;
  }
});

const detailDonutTotal = computed(() =>
  !account.value ? 0 :
  account.value.accountType === "physical" ? account.value.amount : logicalBalance.value
);

const detailDonutLabel = computed(() =>
  account.value?.accountType === "physical" ? "邏輯帳戶" : "實體帳戶",
);

// ── 格式化金額 ─────────────────────────────────────────────────────
function fmt(amount: number): string {
  return `$${Math.max(amount, 0).toLocaleString()}`;
}

function pct(part: number, total: number): string {
  if (total <= 0) return "0%";
  return `${((part / total) * 100).toFixed(1)}%`;
}

// ── 轉帳紀錄 tab 切換（實體 = P→P；邏輯 = P→L/L→P） ─────────
const transferViewMode = ref<"physical" | "logical">("physical");

const allAccountTransfers = computed(() => {
  if (!account.value) return [];
  return [...transfers.value]
    .filter((t) => t.fromAccountId === account.value!.id || t.toAccountId === account.value!.id)
    .sort((a, b) => b.date - a.date);
});

const filteredTransfers = computed(() => {
  if (transferViewMode.value === "physical")
    return allAccountTransfers.value.filter((t) => t.transferType === "physical-physical");
  return allAccountTransfers.value.filter(
    (t) => t.transferType === "physical-logical" || t.transferType === "logical-physical"
  );
});

const groupedTransfers = computed(() => {
  const result: { dateKey: string; dateDisplay: string; items: AccountTransfer[] }[] = [];
  const map = new Map<string, AccountTransfer[]>();
  for (const t of filteredTransfers.value) {
    const d = new Date(t.date);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    const ex = map.get(key); if (ex) ex.push(t); else map.set(key, [t]);
  }
  const wd = ["日","一","二","三","四","五","六"];
  for (const [key, items] of map.entries()) {
    const d = new Date(key);
    result.push({ dateKey: key, dateDisplay: `${d.getMonth()+1}月${d.getDate()}日(週${wd[d.getDay()]})`, items });
  }
  return result.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
});

function getCounterpartyName(t: AccountTransfer): string {
  if (!account.value) return "";
  const otherId = t.fromAccountId === account.value.id ? t.toAccountId : t.fromAccountId;
  return accounts.value.find((a) => a.id === otherId)?.name ?? "已刪除帳戶";
}

function isIncoming(t: AccountTransfer): boolean {
  return t.toAccountId === account.value?.id;
}

function transferTypeLabel(t: AccountTransfer): string {
  const incoming = isIncoming(t);
  switch (t.transferType) {
    case "physical-physical": return incoming ? "實體轉入" : "實體轉出";
    case "physical-logical": return incoming ? "邏輯轉入" : "邏輯轉出";
    case "logical-physical": return incoming ? "邏輯轉入" : "邏輯轉出";
    default: return incoming ? "轉入" : "轉出";
  }
}

// ── 刪除轉帳 ─────────────────────────────────────────────────────
const showDeleteTransferConfirm = ref(false);
const deletingTransferId = ref<string | null>(null);

function onDeleteTransfer(id: string) {
  deletingTransferId.value = id;
  showDeleteTransferConfirm.value = true;
}

function confirmDeleteTransfer() {
  if (deletingTransferId.value) {
    const t = transfers.value.find((x) => x.id === deletingTransferId.value);
    if (t?.transferType === "physical-physical") {
      const from = accounts.value.find((a) => a.id === t.fromAccountId);
      const to = accounts.value.find((a) => a.id === t.toAccountId);
      if (from && to) {
        accounts.value = accounts.value.map((a) => {
          if (a.id === from.id) return { ...a, amount: a.amount + t.amount };
          if (a.id === to.id) return { ...a, amount: Math.max(a.amount - t.amount, 0) };
          return a;
        });
        saveAccounts(accounts.value);
        const updated = accounts.value.find((a) => a.id === account.value?.id);
        if (updated) account.value = updated;
      }
    }
    transfers.value = transfers.value.filter((x) => x.id !== deletingTransferId.value);
    saveTransfers(transfers.value);
  }
  showDeleteTransferConfirm.value = false;
  deletingTransferId.value = null;
}

function cancelDeleteTransfer() {
  showDeleteTransferConfirm.value = false;
  deletingTransferId.value = null;
}

// ── 編輯實體帳戶金額 Modal ────────────────────────────────────────
const showEditAmountModal = ref(false);
const editAmountStr = ref("");
const editAmountError = ref("");

function openEditAmountModal() {
  editAmountStr.value = String(account.value?.amount ?? 0);
  editAmountError.value = "";
  showEditAmountModal.value = true;
}

function closeEditAmountModal() { showEditAmountModal.value = false; }

function submitEditAmount() {
  const newAmount = parseFloat(editAmountStr.value);
  if (isNaN(newAmount) || newAmount < 0) { editAmountError.value = "請輸入有效金額（不可為負數）"; return; }
  const netAllocated = getNetAllocated(account.value!.id, transfers.value);
  if (newAmount < netAllocated) { editAmountError.value = `金額不可低於已淨分配 ${fmt(netAllocated)}`; return; }
  accounts.value = accounts.value.map((a) => a.id === account.value!.id ? { ...a, amount: newAmount } : a);
  account.value = { ...account.value!, amount: newAmount };
  saveAccounts(accounts.value);
  closeEditAmountModal();
}

// ── 帳戶選單 ─────────────────────────────────────────────────────
const logicalAccountOptions = computed(() => accounts.value.filter((a) => a.accountType === "logical"));

const otherPhysicalAccounts = computed(() =>
  accounts.value.filter((a) => a.accountType === "physical" && a.id !== account.value?.id)
);

const logicalReturnTargets = computed(() => {
  if (account.value?.accountType !== "logical") return [];
  const sourceIds = getTransferSourceIds(account.value.id, transfers.value);
  return accounts.value.filter((a) => a.accountType === "physical" && sourceIds.includes(a.id));
});

// 共用日期狀態
const showCalendar = ref(false);
const activeDateTarget = ref<"alloc" | "transfer" | "return">("alloc");

function openCalendar(target: "alloc" | "transfer" | "return") {
  activeDateTarget.value = target;
  showCalendar.value = true;
}

// ── 分配 Modal（P→L） ──────────────────────────────────────────────
const showAllocModal = ref(false);
const allocTargetId = ref("");
const allocAmount = ref("");
const allocDateMs = ref(Date.now());
const allocNote = ref("");
const allocError = ref("");

const allocDateDisplay = computed(() => {
  const d = new Date(allocDateMs.value);
  const wd = ["日","一","二","三","四","五","六"];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（週${wd[d.getDay()]}）`;
});

function openAllocModal() {
  allocTargetId.value = logicalAccountOptions.value[0]?.id ?? "";
  allocAmount.value = ""; allocDateMs.value = Date.now(); allocNote.value = ""; allocError.value = "";
  showAllocModal.value = true;
}

function closeAllocModal() { showAllocModal.value = false; }

function submitAlloc() {
  const amount = parseFloat(allocAmount.value);
  if (isNaN(amount) || amount <= 0) { allocError.value = "請輸入有效金額"; return; }
  if (!allocTargetId.value) { allocError.value = "請選擇目標邏輯帳戶"; return; }
  const avail = getPhysicalBalance(account.value!, transfers.value);
  if (amount > avail) { allocError.value = `可用餘額不足（${fmt(avail)}）`; return; }
  transfers.value = [{ id: `txf_${Date.now()}`, fromAccountId: account.value!.id, toAccountId: allocTargetId.value, amount, date: allocDateMs.value, note: allocNote.value.trim(), transferType: "physical-logical", createdAt: Date.now() }, ...transfers.value];
  saveTransfers(transfers.value);
  closeAllocModal();
}

// ── 實體轉帳 Modal（P→P） ──────────────────────────────────────────
const showTransferModal = ref(false);
const transferTargetId = ref("");
const transferAmount = ref("");
const transferDateMs = ref(Date.now());
const transferNote = ref("");
const transferError = ref("");

const transferDateDisplay = computed(() => {
  const d = new Date(transferDateMs.value);
  const wd = ["日","一","二","三","四","五","六"];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（週${wd[d.getDay()]}）`;
});

function openTransferModal() {
  transferTargetId.value = otherPhysicalAccounts.value[0]?.id ?? "";
  transferAmount.value = ""; transferDateMs.value = Date.now(); transferNote.value = ""; transferError.value = "";
  showTransferModal.value = true;
}

function closeTransferModal() { showTransferModal.value = false; }

function submitTransfer() {
  const amount = parseFloat(transferAmount.value);
  if (isNaN(amount) || amount <= 0) { transferError.value = "請輸入有效金額"; return; }
  if (!transferTargetId.value) { transferError.value = "請選擇目標帳戶"; return; }
  const avail = getPhysicalBalance(account.value!, transfers.value);
  if (amount > avail) { transferError.value = `可用餘額不足（${fmt(avail)}）`; return; }
  const target = accounts.value.find((a) => a.id === transferTargetId.value);
  if (!target) { transferError.value = "找不到目標帳戶"; return; }
  accounts.value = accounts.value.map((a) => {
    if (a.id === account.value!.id) return { ...a, amount: a.amount - amount };
    if (a.id === target.id) return { ...a, amount: a.amount + amount };
    return a;
  });
  account.value = { ...account.value!, amount: account.value!.amount - amount };
  saveAccounts(accounts.value);
  transfers.value = [{ id: `txf_${Date.now()}`, fromAccountId: account.value!.id, toAccountId: transferTargetId.value, amount, date: transferDateMs.value, note: transferNote.value.trim(), transferType: "physical-physical", createdAt: Date.now() }, ...transfers.value];
  saveTransfers(transfers.value);
  closeTransferModal();
}

// ── 邏輯歸還 Modal（L→P） ──────────────────────────────────────────
const showReturnModal = ref(false);
const returnTargetId = ref("");
const returnAmount = ref("");
const returnDateMs = ref(Date.now());
const returnNote = ref("");
const returnError = ref("");

const returnDateDisplay = computed(() => {
  const d = new Date(returnDateMs.value);
  const wd = ["日","一","二","三","四","五","六"];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日（週${wd[d.getDay()]}）`;
});

function openReturnModal() {
  returnTargetId.value = logicalReturnTargets.value[0]?.id ?? "";
  returnAmount.value = ""; returnDateMs.value = Date.now(); returnNote.value = ""; returnError.value = "";
  showReturnModal.value = true;
}

function closeReturnModal() { showReturnModal.value = false; }

function submitReturn() {
  const amount = parseFloat(returnAmount.value);
  if (isNaN(amount) || amount <= 0) { returnError.value = "請輸入有效金額"; return; }
  if (!returnTargetId.value) { returnError.value = "請選擇目標帳戶"; return; }
  const logBal = getLogicalBalance(account.value!, transfers.value);
  if (amount > logBal) { returnError.value = `餘額不足（可歸還餘額 ${fmt(logBal)}）`; return; }
  transfers.value = [{ id: `txf_${Date.now()}`, fromAccountId: account.value!.id, toAccountId: returnTargetId.value, amount, date: returnDateMs.value, note: returnNote.value.trim(), transferType: "logical-physical", createdAt: Date.now() }, ...transfers.value];
  saveTransfers(transfers.value);
  closeReturnModal();
}

// CalendarPicker 統一回調
const calendarModelValue = computed({
  get() {
    if (activeDateTarget.value === "alloc") return allocDateMs.value;
    if (activeDateTarget.value === "transfer") return transferDateMs.value;
    return returnDateMs.value;
  },
  set(v: number) {
    if (activeDateTarget.value === "alloc") allocDateMs.value = v;
    else if (activeDateTarget.value === "transfer") transferDateMs.value = v;
    else returnDateMs.value = v;
  },
});
</script>

<template>
  <section class="detail-page">
    <TopNavigation>
      <template #left><NavBack :on-back="goBack" /></template>
      <template #center><span class="page-title">{{ account?.name ?? "帳戶" }}</span></template>
    </TopNavigation>

    <div class="page-content" v-if="account">

      <!-- 帳戶類型切換 Tab（右上角，控制轉帳紀錄顯示模式） -->
      <div class="tab-row">
        <TypeToggle v-model="transferViewMode" leftLabel="實體" rightLabel="邏輯" leftValue="physical" rightValue="logical" />
      </div>

      <!-- DonutChart -->
      <div class="chart-card">
        <DonutChart :centerLabel="detailDonutLabel" :centerBalance="fmt(detailDonutTotal)" :slices="detailDonutSlices" />
      </div>

      <!-- 實體帳戶：餘額卡片 -->
      <div v-if="account.accountType === 'physical'" class="balance-card">
        <div class="balance-dot" :style="{ background: account.color }"></div>
        <div class="balance-main">
          <div class="balance-label">總金額</div>
          <div class="balance-amount">{{ fmt(account.amount) }}</div>
        </div>
        <div class="balance-actions">
          <button class="btn-card-action" @click="openEditAmountModal">編輯金額</button>
          <button class="btn-card-action" @click="openAllocModal" :disabled="logicalAccountOptions.length === 0">邏輯轉帳</button>
          <button class="btn-card-action primary" @click="openTransferModal" :disabled="otherPhysicalAccounts.length === 0">實體轉帳</button>
        </div>
      </div>

      <!-- 邏輯帳戶：餘額卡片 -->
      <div v-if="account.accountType === 'logical'" class="balance-card">
        <div class="balance-dot" :style="{ background: account.color }"></div>
        <div class="balance-main">
          <div class="balance-label">帳戶餘額</div>
          <div class="balance-amount">{{ fmt(logicalBalance) }}</div>
        </div>
        <div class="balance-actions">
          <button class="btn-card-action primary" :disabled="logicalReturnTargets.length === 0" @click="openReturnModal">邏輯轉帳</button>
        </div>
      </div>

      <!-- 實體帳戶：邏輯帳戶分配概況 -->
      <section v-if="account.accountType === 'physical'" class="list-section">
        <div class="section-heading">邏輯帳戶</div>
        <ListGroup>
          <template #header-left>
            <span class="group-sub-title">已分配 {{ fmt(getNetAllocated(account.id, transfers)) }}／可用 {{ fmt(physicalBalance) }}</span>
          </template>
          <div v-if="allocations.length === 0" class="empty-state"><p>尚未分配給任何邏輯帳戶</p></div>
          <ListItem v-for="entry in allocations" :key="entry.accountId" :swipeable="false">
            <div class="alloc-row">
              <div class="account-color-dot" :style="{ background: accounts.find(a => a.id === entry.accountId)?.color ?? '#94A3B8' }"></div>
              <div class="alloc-left">
                <span class="alloc-name">{{ entry.accountName }}</span>
                <span class="alloc-pct">{{ pct(entry.net, account.amount) }}</span>
              </div>
              <div class="alloc-right">
                <span class="alloc-net">{{ fmt(entry.net) }}</span>
                <span v-if="entry.returned > 0" class="alloc-detail">已歸還 {{ fmt(entry.returned) }}</span>
              </div>
            </div>
            <div class="proportion-bar-track"><div class="proportion-bar-fill" :style="{ width: pct(entry.net, account.amount) }"></div></div>
          </ListItem>
          <ListItem v-if="physicalBalance > 0" :swipeable="false">
            <div class="alloc-row">
              <div class="account-color-dot" style="background: #E2E8F0"></div>
              <div class="alloc-left"><span class="alloc-name unallocated">未分配</span><span class="alloc-pct">{{ pct(physicalBalance, account.amount) }}</span></div>
              <div class="alloc-right"><span class="alloc-net unallocated">{{ fmt(physicalBalance) }}</span></div>
            </div>
            <div class="proportion-bar-track"><div class="proportion-bar-fill unallocated" :style="{ width: pct(physicalBalance, account.amount) }"></div></div>
          </ListItem>
        </ListGroup>
      </section>

      <!-- 邏輯帳戶：實體帳戶資金來源 -->
      <section v-if="account.accountType === 'logical'" class="list-section">
        <div class="section-heading">實體帳戶</div>
        <ListGroup>
          <template #header-left><span class="group-sub-title">總餘額 {{ fmt(logicalBalance) }}</span></template>
          <div v-if="physicalSources.length === 0" class="empty-state"><p>尚無實體帳戶分配資金</p></div>
          <ListItem v-for="src in physicalSources" :key="src.accountId" :swipeable="false">
            <div class="alloc-row">
              <div class="account-color-dot" :style="{ background: accounts.find(a => a.id === src.accountId)?.color ?? '#94A3B8' }"></div>
              <div class="alloc-left">
                <span class="alloc-name">{{ src.accountName }}</span>
                <span class="alloc-pct">{{ pct(src.net, logicalBalance) }}</span>
              </div>
              <div class="alloc-right">
                <span class="alloc-net">{{ fmt(src.net) }}</span>
                <span v-if="src.returned > 0" class="alloc-detail">已歸還 {{ fmt(src.returned) }}</span>
              </div>
            </div>
            <div class="proportion-bar-track"><div class="proportion-bar-fill" :style="{ width: pct(src.net, logicalBalance) }"></div></div>
          </ListItem>
        </ListGroup>
      </section>

      <!-- 轉帳紀錄（含 tab 切換） -->
      <section class="list-section">
        <div class="section-heading">{{ transferViewMode === 'physical' ? '實體轉帳' : '邏輯轉帳' }}</div>
        <div v-if="filteredTransfers.length > 0" class="transfer-groups">
          <ListGroup v-for="group in groupedTransfers" :key="group.dateKey">
            <template #header-left><span class="date-title">{{ group.dateDisplay }}</span></template>
            <ListItem v-for="item in group.items" :key="item.id" :swipeable="true" :delete-only="true" @delete="onDeleteTransfer(item.id)">
              <div class="transfer-item">
                <div class="transfer-left">
                  <div class="direction-badge" :class="isIncoming(item) ? 'in' : 'out'">{{ transferTypeLabel(item) }}</div>
                  <div class="transfer-info">
                    <span class="list-item-label">{{ getCounterpartyName(item) }}</span>
                    <span v-if="item.note" class="item-note">{{ item.note }}</span>
                  </div>
                </div>
                <div class="transfer-amount" :class="isIncoming(item) ? 'income' : 'expense'">
                  {{ isIncoming(item) ? "+" : "-" }}{{ fmt(item.amount) }}
                </div>
              </div>
            </ListItem>
          </ListGroup>
        </div>
        <div v-else class="empty-state"><p>{{ transferViewMode === 'physical' ? '暫無實體轉帳紀錄' : '暫無邏輯轉帳紀錄' }}</p></div>
      </section>
    </div>

    <!-- 編輯金額 Modal -->
    <Transition name="modal">
      <div v-if="showEditAmountModal" class="modal-overlay" @click="closeEditAmountModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">編輯金額</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">帳戶金額</label>
              <div class="amount-row"><span class="currency-sign">$</span>
                <input v-model="editAmountStr" type="number" inputmode="decimal" min="0" class="form-input amount-input" placeholder="0" @input="editAmountError = ''" />
              </div>
              <p class="form-hint">已淨分配 {{ fmt(getNetAllocated(account!.id, transfers)) }}，新金額不得低於此値</p>
            </div>
            <p v-if="editAmountError" class="form-error">{{ editAmountError }}</p>
          </div>
          <div class="modal-footer">
            <button class="btn-cancel" @click="closeEditAmountModal">取消</button>
            <button class="btn-confirm" @click="submitEditAmount">儲存</button>
          </div>
        </div>
      </div>
    </Transition>

    <!-- 邏輯轉帳 Modal（P→L） -->
    <Transition name="modal">
      <div v-if="showAllocModal" class="modal-overlay" @click="closeAllocModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">邏輯轉帳</h3>
          <div class="modal-body">
            <div class="form-row">
              <label class="form-label">帳戶</label>
              <div class="select-with-balance">
                <select v-model="allocTargetId" class="form-input select-input" @change="allocError = ''">
                  <option v-if="logicalAccountOptions.length === 0" value="" disabled>尚無邏輯帳戶</option>
                  <option v-for="a in logicalAccountOptions" :key="a.id" :value="a.id">{{ a.name }}</option>
                </select>
                <span class="select-balance">餘額 {{ allocTargetId ? fmt(getLogicalBalance(accounts.find(a => a.id === allocTargetId)!, transfers)) : '' }}</span>
              </div>
            </div>
            <div class="form-row"><label class="form-label">金額</label>
              <div class="amount-row"><span class="currency-sign">$</span>
                <input v-model="allocAmount" type="number" inputmode="numeric" min="1" class="form-input amount-input" placeholder="0" @input="allocError = ''" />
              </div>
            </div>
            <div class="form-row"><label class="form-label">日期</label><button class="date-btn" @click="openCalendar('alloc')">{{ allocDateDisplay }}</button></div>
            <div class="form-row"><label class="form-label">備註</label><input v-model="allocNote" type="text" class="form-input" placeholder="選填" maxlength="50" /></div>
            <p v-if="allocError" class="form-error">{{ allocError }}</p>
          </div>
          <div class="modal-footer"><button class="btn-cancel" @click="closeAllocModal">取消</button><button class="btn-confirm" @click="submitAlloc">確認轉帳</button></div>
        </div>
      </div>
    </Transition>

    <!-- 實體轉帳 Modal（P→P） -->
    <Transition name="modal">
      <div v-if="showTransferModal" class="modal-overlay" @click="closeTransferModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">實體轉帳</h3>
          <div class="modal-body">
            <div class="form-row"><label class="form-label">帳戶</label>
              <div class="select-with-balance">
                <select v-model="transferTargetId" class="form-input select-input" @change="transferError = ''">
                  <option v-if="otherPhysicalAccounts.length === 0" value="" disabled>尚無其他實體帳戶</option>
                  <option v-for="a in otherPhysicalAccounts" :key="a.id" :value="a.id">{{ a.name }}</option>
                </select>
                <span class="select-balance">餘額 {{ transferTargetId ? fmt(getPhysicalBalance(accounts.find(a => a.id === transferTargetId)!, transfers)) : '' }}</span>
              </div>
            </div>
            <div class="form-row"><label class="form-label">金額</label>
              <div class="amount-row"><span class="currency-sign">$</span>
                <input v-model="transferAmount" type="number" inputmode="numeric" min="1" class="form-input amount-input" placeholder="0" @input="transferError = ''" />
              </div>
            </div>
            <div class="form-row"><label class="form-label">日期</label><button class="date-btn" @click="openCalendar('transfer')">{{ transferDateDisplay }}</button></div>
            <div class="form-row"><label class="form-label">備註</label><input v-model="transferNote" type="text" class="form-input" placeholder="選填" maxlength="50" /></div>
            <p v-if="transferError" class="form-error">{{ transferError }}</p>
          </div>
          <div class="modal-footer"><button class="btn-cancel" @click="closeTransferModal">取消</button><button class="btn-confirm" @click="submitTransfer">確認轉帳</button></div>
        </div>
      </div>
    </Transition>

    <!-- 邏輯轉帳 Modal（L→P） -->
    <Transition name="modal">
      <div v-if="showReturnModal" class="modal-overlay" @click="closeReturnModal">
        <div class="modal-container" @click.stop>
          <h3 class="modal-title">邏輯轉帳</h3>
          <div class="modal-body">
            <div class="form-row"><label class="form-label">帳戶</label>
              <div class="select-with-balance">
                <select v-model="returnTargetId" class="form-input select-input" @change="returnError = ''">
                  <option v-if="logicalReturnTargets.length === 0" value="" disabled>尚無可歸還的實體帳戶</option>
                  <option v-for="a in logicalReturnTargets" :key="a.id" :value="a.id">{{ a.name }}</option>
                </select>
                <span class="select-balance">餘額 {{ returnTargetId ? fmt(physicalSources.find(s => s.accountId === returnTargetId)?.net ?? 0) : '' }}</span>
              </div>
            </div>
            <div class="form-row"><label class="form-label">金額</label>
              <div class="amount-row"><span class="currency-sign">$</span>
                <input v-model="returnAmount" type="number" inputmode="numeric" min="1" class="form-input amount-input" placeholder="0" @input="returnError = ''" />
              </div>
            </div>
            <div class="form-row"><label class="form-label">日期</label><button class="date-btn" @click="openCalendar('return')">{{ returnDateDisplay }}</button></div>
            <div class="form-row"><label class="form-label">備註</label><input v-model="returnNote" type="text" class="form-input" placeholder="選填" maxlength="50" /></div>
            <p v-if="returnError" class="form-error">{{ returnError }}</p>
          </div>
          <div class="modal-footer"><button class="btn-cancel" @click="closeReturnModal">取消</button><button class="btn-confirm" @click="submitReturn">確認轉帳</button></div>
        </div>
      </div>
    </Transition>

    <CalendarPicker v-model:open="showCalendar" v-model="calendarModelValue" />

    <ConfirmModal :show="showDeleteTransferConfirm" title="刪除紀錄" message="確定要刪除這筆紀錄嗎？此操作無法復原。" confirm-text="刪除" cancel-text="取消" variant="danger" @confirm="confirmDeleteTransfer" @cancel="cancelDeleteTransfer" />
  </section>
</template>

<style scoped>
.detail-page { min-height: 100vh; background: var(--bg-page, #f5f5f5); }
.page-title { font-size: 17px; font-weight: 600; color: var(--text-primary, #1a1a1a); }
.page-content { padding: 16px; padding-bottom: 60px; display: flex; flex-direction: column; gap: 20px; }
.chart-card { background: var(--bg-elevated, #ffffff); border-radius: 12px; padding: 16px 8px; }
.balance-card { background: var(--bg-elevated, #ffffff); border-radius: 12px; padding: 18px 20px; border: 2px solid var(--border-primary, #000); display: flex; align-items: flex-start; gap: 14px; }
.balance-dot { width: 14px; height: 14px; border-radius: 50%; flex-shrink: 0; margin-top: 6px; }
.balance-main { flex: 1; }
.balance-label { font-size: 12px; color: var(--text-secondary, #888); margin-bottom: 3px; }
.balance-amount { font-size: 26px; font-weight: 700; letter-spacing: -0.5px; color: var(--text-primary, #1a1a1a); }
.balance-sub-row { display: flex; gap: 12px; margin-top: 4px; }
.balance-hint { font-size: 12px; color: var(--text-secondary, #888); }
.balance-actions { display: flex; flex-direction: column; gap: 6px; flex-shrink: 0; }
.btn-card-action { font-family: inherit; border: 1.5px solid var(--border-primary); border-radius: 8px; background: transparent; color: var(--text-primary); padding: 6px 12px; font-size: 12px; font-weight: 600; cursor: pointer; white-space: nowrap; transition: opacity 0.15s; }
.btn-card-action.primary { background: var(--text-primary); color: #fff; border-color: transparent; }
.btn-card-action:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-card-action:not(:disabled):active { opacity: 0.75; }
.tab-row { display: flex; justify-content: flex-end; }
.account-color-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.list-section { display: flex; flex-direction: column; gap: 10px; }
.section-heading { font-size: 16px; font-weight: 700; color: var(--text-primary, #1a1a1a); padding: 0 2px; }
.group-sub-title { font-size: 13px; font-weight: 500; color: var(--text-secondary, #888); }
.alloc-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px 4px; gap: 8px; }
.alloc-left { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 0; }
.alloc-name { font-size: 15px; font-weight: 500; color: var(--text-primary, #1a1a1a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.alloc-name.unallocated { color: var(--text-primary, #1a1a1a); }
.alloc-pct { font-size: 12px; color: var(--text-secondary, #888); flex-shrink: 0; }
.alloc-right { display: flex; flex-direction: column; align-items: flex-end; flex-shrink: 0; }
.alloc-net { font-size: 15px; font-weight: 700; color: var(--text-primary, #1a1a1a); }
.alloc-net.unallocated { color: var(--text-primary, #1a1a1a); }
.alloc-detail { font-size: 11px; color: var(--text-secondary, #aaa); }
.proportion-bar-track { margin: 5px 16px 12px; height: 4px; border-radius: 2px; background: var(--bg-hover, #f0f0f0); overflow: hidden; }
.proportion-bar-fill { height: 100%; border-radius: 2px; background: var(--text-primary, #1a1a1a); transition: width 0.3s ease; }
.proportion-bar-fill.unallocated { background: var(--border, #d0d0d0); }
.transfer-groups { display: flex; flex-direction: column; gap: 12px; }
.date-title { font-size: 16px; font-weight: 500; color: var(--text-primary); }
.transfer-item { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; min-height: 56px; gap: 8px; }
.transfer-left { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
.direction-badge { flex-shrink: 0; font-size: 11px; font-weight: 600; padding: 3px 7px; border-radius: 6px; letter-spacing: 0.2px; border: 1.5px solid; white-space: nowrap; }
.direction-badge.out { background: var(--janote-expense-light); color: var(--text-primary); border-color: var(--janote-expense); }
.direction-badge.in { background: var(--janote-income-light); color: var(--text-primary); border-color: var(--janote-income); }
.transfer-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.list-item-label { font-size: 15px; font-weight: 500; color: var(--text-primary, #1a1a1a); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-note { font-size: 12px; color: var(--text-secondary, #888); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.transfer-amount { font-size: 15px; font-weight: 700; flex-shrink: 0; }
.transfer-amount.income { color: var(--janote-income, #47b8e0); }
.transfer-amount.expense { color: var(--janote-action, #f87171); }
.empty-state { text-align: center; padding: 24px 0 12px; color: var(--text-secondary, #888); font-size: 14px; }
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.modal-container { background: var(--bg-page); border-radius: 16px; padding: 24px; min-width: 280px; width: 85%; max-width: 380px; max-height: 85vh; overflow-y: auto; box-shadow: 0 8px 32px rgba(0,0,0,0.2); }
.modal-title { margin: 0 0 16px; text-align: center; font-size: 18px; font-weight: 600; color: var(--text-primary); }
.modal-body { margin-bottom: 20px; display: flex; flex-direction: column; gap: 12px; }
.modal-footer { display: flex; gap: 10px; }
.form-row { display: flex; flex-direction: column; gap: 6px; }
.form-label { font-size: 13px; font-weight: 500; color: var(--text-secondary, #666); }
.form-hint { font-size: 12px; color: var(--text-secondary, #888); margin: 0; }
.form-input { width: 100%; padding: 10px 12px; font-size: 15px; border: 1.5px solid var(--border-primary, #000); border-radius: 10px; background: var(--bg-page, #fff); color: var(--text-primary, #1a1a1a); outline: none; box-sizing: border-box; transition: border-color 0.2s; }
.form-input:focus { border-color: var(--janote-action, #f87171); }
/* select-with-balance：外層容器顯示 select + 右側餘額小字 */
.select-with-balance { position: relative; display: flex; align-items: center; }
.select-with-balance .select-input { flex: 1; padding-right: 80px; appearance: none; -webkit-appearance: none; }
.select-balance { position: absolute; right: 12px; font-size: 12px; color: var(--text-secondary, #aaa); pointer-events: none; white-space: nowrap; }
.amount-row { display: flex; align-items: center; border: 1.5px solid var(--border-primary, #000); border-radius: 10px; background: var(--bg-page, #fff); overflow: hidden; transition: border-color 0.2s; }
.amount-row:focus-within { border-color: var(--janote-action, #f87171); }
.currency-sign { padding: 0 10px; font-size: 15px; font-weight: 600; color: var(--text-secondary, #888); flex-shrink: 0; }
.amount-input { border: none !important; border-radius: 0 !important; background: transparent !important; padding-left: 0 !important; flex: 1; }
.amount-input:focus { border-color: transparent !important; }
.info-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border: 1.5px solid var(--border, #e0e0e0); border-radius: 10px; background: var(--bg-page, #f9f9f9); }
.info-row.highlight { border-color: var(--border-primary, #000); background: var(--bg-elevated, #fff); }
.info-name { font-size: 14px; font-weight: 500; color: var(--text-secondary, #666); }
.info-balance { font-size: 14px; font-weight: 700; color: var(--text-primary, #1a1a1a); }
.date-btn { width: 100%; padding: 10px 12px; text-align: left; font-size: 15px; color: var(--text-primary, #1a1a1a); background: var(--bg-page, #fff); border: 1.5px solid var(--border-primary, #000); border-radius: 10px; cursor: pointer; transition: border-color 0.2s; -webkit-tap-highlight-color: transparent; }
.date-btn:active { border-color: var(--janote-action, #f87171); }
.form-error { font-size: 12px; color: var(--janote-action, #f87171); margin: 0; }
.btn-cancel, .btn-confirm { flex: 1; padding: 12px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; transition: opacity 0.15s; }
.btn-cancel { background: var(--bg-hover, #f3f4f6); color: var(--text-secondary, #6b7280); border: 1.5px solid var(--border, #e5e7eb); }
.btn-confirm { background: var(--text-primary, #1a1a1a); color: #fff; }
.btn-cancel:active, .btn-confirm:active { opacity: 0.75; }
.modal-enter-active, .modal-leave-active { transition: opacity 0.2s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
</style>
