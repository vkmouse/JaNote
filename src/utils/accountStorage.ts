import type { Account, AccountTransfer } from "../types";

// ── LocalStorage 鍵名 ────────────────────────────────────────
const LS_ACCOUNTS_KEY = "janote_accounts";
const LS_TRANSFERS_KEY = "janote_transfers";

// ── 帳戶調色盤（實體 / 邏輯各自循環） ───────────────────────
const PHYSICAL_COLORS = [
  "#94A3B8",
  "#60A5FA",
  "#34D399",
  "#F59E0B",
  "#A78BFA",
  "#FB923C",
  "#E879F9",
];
const LOGICAL_COLORS = [
  "#F87171",
  "#FBBF24",
  "#4ADE80",
  "#38BDF8",
  "#C084FC",
  "#F472B6",
  "#2DD4BF",
];

// ── 帳戶讀寫 ─────────────────────────────────────────────────

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(LS_ACCOUNTS_KEY);
    if (raw) return JSON.parse(raw) as Account[];
  } catch {
    // 忽略 JSON 解析錯誤
  }
  return [];
}

export function saveAccounts(accounts: Account[]): void {
  localStorage.setItem(LS_ACCOUNTS_KEY, JSON.stringify(accounts));
}

// ── 轉帳紀錄讀寫 ─────────────────────────────────────────────

export function loadTransfers(): AccountTransfer[] {
  try {
    const raw = localStorage.getItem(LS_TRANSFERS_KEY);
    if (raw) return JSON.parse(raw) as AccountTransfer[];
  } catch {
    // 忽略 JSON 解析錯誤
  }
  return [];
}

export function saveTransfers(transfers: AccountTransfer[]): void {
  localStorage.setItem(LS_TRANSFERS_KEY, JSON.stringify(transfers));
}

// ── 餘額計算 ──────────────────────────────────────────────────

/**
 * 實體帳戶可用餘額：amount 扣除淨分配給邏輯帳戶的部分。
 * P→P 轉帳直接影響 amount 欄位，不在此計算。
 */
export function getPhysicalBalance(
  account: Account,
  transfers: AccountTransfer[],
): number {
  let netAllocated = 0;
  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.fromAccountId === account.id
    ) {
      netAllocated += t.amount;
    } else if (
      t.transferType === "logical-physical" &&
      t.toAccountId === account.id
    ) {
      netAllocated -= t.amount;
    }
  }
  return account.amount - netAllocated;
}

/**
 * 邏輯帳戶餘額：所有實體轉入減去已轉回。
 */
export function getLogicalBalance(
  account: Account,
  transfers: AccountTransfer[],
): number {
  let balance = 0;
  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.toAccountId === account.id
    ) {
      balance += t.amount;
    } else if (
      t.transferType === "logical-physical" &&
      t.fromAccountId === account.id
    ) {
      balance -= t.amount;
    }
  }
  return balance;
}

/** 根據帳戶類型分流計算餘額 */
export function getAccountBalance(
  account: Account,
  transfers: AccountTransfer[],
): number {
  return account.accountType === "physical"
    ? getPhysicalBalance(account, transfers)
    : getLogicalBalance(account, transfers);
}

/**
 * 實體帳戶已淨分配金額（已分配 - 已歸還），用於修改 amount 時驗證。
 */
export function getNetAllocated(
  physicalId: string,
  transfers: AccountTransfer[],
): number {
  let net = 0;
  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.fromAccountId === physicalId
    ) {
      net += t.amount;
    } else if (
      t.transferType === "logical-physical" &&
      t.toAccountId === physicalId
    ) {
      net -= t.amount;
    }
  }
  return net;
}

// ── 分配／來源分析 ────────────────────────────────────────────

export interface AllocationEntry {
  accountId: string;
  accountName: string;
  sent: number;
  returned: number;
  /** 淨分配（sent - returned） */
  net: number;
}

/**
 * 從實體帳戶的角度，列出分配給各邏輯帳戶的明細。
 * 僅回傳 net > 0 的項目。
 */
export function getLogicalAllocations(
  physicalId: string,
  transfers: AccountTransfer[],
  accounts: Account[],
): AllocationEntry[] {
  const map = new Map<string, { sent: number; returned: number }>();

  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.fromAccountId === physicalId
    ) {
      const e = map.get(t.toAccountId) ?? { sent: 0, returned: 0 };
      e.sent += t.amount;
      map.set(t.toAccountId, e);
    } else if (
      t.transferType === "logical-physical" &&
      t.toAccountId === physicalId
    ) {
      const e = map.get(t.fromAccountId) ?? { sent: 0, returned: 0 };
      e.returned += t.amount;
      map.set(t.fromAccountId, e);
    }
  }

  const result: AllocationEntry[] = [];
  for (const [id, { sent, returned }] of map.entries()) {
    const acc = accounts.find((a) => a.id === id);
    const net = sent - returned;
    if (net > 0) {
      result.push({
        accountId: id,
        accountName: acc?.name ?? "已刪除帳戶",
        sent,
        returned,
        net,
      });
    }
  }
  return result;
}

/**
 * 從邏輯帳戶的角度，列出各實體帳戶的貢獻明細。
 */
export function getPhysicalSources(
  logicalId: string,
  transfers: AccountTransfer[],
  accounts: Account[],
): AllocationEntry[] {
  const map = new Map<string, { sent: number; returned: number }>();

  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.toAccountId === logicalId
    ) {
      const e = map.get(t.fromAccountId) ?? { sent: 0, returned: 0 };
      e.sent += t.amount;
      map.set(t.fromAccountId, e);
    } else if (
      t.transferType === "logical-physical" &&
      t.fromAccountId === logicalId
    ) {
      const e = map.get(t.toAccountId) ?? { sent: 0, returned: 0 };
      e.returned += t.amount;
      map.set(t.toAccountId, e);
    }
  }

  const result: AllocationEntry[] = [];
  for (const [id, { sent, returned }] of map.entries()) {
    const acc = accounts.find((a) => a.id === id);
    result.push({
      accountId: id,
      accountName: acc?.name ?? "已刪除帳戶",
      sent,
      returned,
      net: sent - returned,
    });
  }
  return result;
}

/**
 * 取得曾轉帳給此邏輯帳戶的實體帳戶 ID 集合（用於限定邏輯→實體的轉帳目標）。
 */
export function getTransferSourceIds(
  logicalId: string,
  transfers: AccountTransfer[],
): string[] {
  const ids = new Set<string>();
  for (const t of transfers) {
    if (
      t.transferType === "physical-logical" &&
      t.toAccountId === logicalId
    ) {
      ids.add(t.fromAccountId);
    }
  }
  return Array.from(ids);
}

// ── 顏色工具 ──────────────────────────────────────────────────

export function nextPhysicalColor(accounts: Account[]): string {
  const count = accounts.filter((a) => a.accountType === "physical").length;
  return PHYSICAL_COLORS[count % PHYSICAL_COLORS.length] ?? PHYSICAL_COLORS[0]!;
}

export function nextLogicalColor(accounts: Account[]): string {
  const count = accounts.filter((a) => a.accountType === "logical").length;
  return LOGICAL_COLORS[count % LOGICAL_COLORS.length] ?? LOGICAL_COLORS[0]!;
}
