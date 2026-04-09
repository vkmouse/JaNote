import type { Account, AccountBalanceSource, AccountTransfer } from "../types";

// ── LocalStorage 鍵名 ────────────────────────────────────────
const LS_ACCOUNTS_KEY = "janote_accounts";
const LS_TRANSFERS_KEY = "janote_transfers";

// ── 帳戶調色盤（主帳戶固定石板色，其餘循環） ────────────────
const PRIMARY_ACCOUNT_COLOR = "#94A3B8";
const ACCOUNT_COLORS = [
  "#60A5FA",
  "#34D399",
  "#F59E0B",
  "#F87171",
  "#A78BFA",
  "#FB923C",
  "#E879F9",
];

// ── 帳戶讀寫 ─────────────────────────────────────────────────

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(LS_ACCOUNTS_KEY);
    if (raw) {
      // 資料遷移：isDefault → isPrimary
      return (JSON.parse(raw) as any[]).map((a) => ({
        ...a,
        isPrimary: a.isPrimary ?? a.isDefault ?? false,
      })) as Account[];
    }
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

// ── 初始化主帳戶（若尚無任何帳戶） ─────────────────────────

export function ensurePrimaryAccount(): Account[] {
  let accounts = loadAccounts();
  if (accounts.length === 0) {
    const primary: Account = {
      id: "primary",
      name: "主帳戶",
      balanceSources: [],
      color: PRIMARY_ACCOUNT_COLOR,
      isPrimary: true,
      createdAt: Date.now(),
    };
    accounts = [primary];
    saveAccounts(accounts);
  }
  return accounts;
}

// ── 計算帳戶餘額 ──────────────────────────────────────────────

export function getAccountBalance(
  account: Account,
  transfers: AccountTransfer[],
): number {
  let balance: number;

  if (account.isPrimary) {
    // 主帳戶：餘額 = 各來源金額加總
    balance = (account.balanceSources ?? []).reduce(
      (sum, s) => sum + s.amount,
      0,
    );
  } else {
    // 一般帳戶：初始餘額為 0，由轉帳計算
    balance = 0;
  }

  for (const t of transfers) {
    if (t.toAccountId === account.id) {
      balance += t.amount;
    } else if (t.fromAccountId === account.id) {
      balance -= t.amount;
    }
  }
  return Math.max(balance, 0);
}

// ── 取得下一個帳戶顏色（依現有帳戶數量循環） ─────────────────

export function nextAccountColor(accounts: Account[]): string {
  const nonPrimaryCount = accounts.filter((a) => !a.isPrimary).length;
  return ACCOUNT_COLORS[nonPrimaryCount % ACCOUNT_COLORS.length] ?? ACCOUNT_COLORS[0]!;
}

// ── 取得主帳戶 ──────────────────────────────────────────────

export function getPrimaryAccount(accounts: Account[]): Account | undefined {
  return accounts.find((a) => a.isPrimary);
}

// ── 更新主帳戶的餘額來源 ──────────────────────────────────────

export function updateBalanceSources(
  accounts: Account[],
  accountId: string,
  sources: AccountBalanceSource[],
): Account[] {
  return accounts.map((a) =>
    a.id === accountId ? { ...a, balanceSources: sources } : a,
  );
}
